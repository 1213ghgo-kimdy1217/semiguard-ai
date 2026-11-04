import { useEffect, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { MessageCircle, Send, X } from "lucide-react";
import { Link, useLocation } from "wouter";
import {
  tr,
  useProductLanguage,
  type ProductLanguage,
} from "../lib/productLanguage";
import { trpc } from "../lib/trpc";
import {
  createBoothLearningContext,
  type BoothLearningContext,
  type LearningAssistantResult,
} from "../../../shared/learningAssistant";
import {
  BOOTH_SIGNALS,
  type BoothSnapshot,
} from "../../../shared/boothExperience";
import "./learning-assistant.css";

type BoothContextSource = {
  snapshot: BoothSnapshot;
  stage: "brief" | "experience" | "review";
};
type Exchange = {
  question: string;
  result: LearningAssistantResult | null;
  context?: BoothLearningContext;
};
const scenarioNames: Record<
  BoothLearningContext["scenarioId"],
  [string, string, string]
> = {
  combined: ["복합 공정 이상", "Combined process fault", "複合プロセス異常"],
  "gas-delivery": [
    "가스·압력 불균형",
    "Gas / pressure imbalance",
    "ガス・圧力の不均衡",
  ],
  "exhaust-restriction": ["압력 상승", "Rising pressure", "圧力上昇"],
  "rf-matching": ["RF 출력 불안정", "Unstable RF output", "RF出力の不安定"],
};
export default function LearningAssistant() {
  const [path] = useLocation();
  const [language] = useProductLanguage();
  const auth = trpc.auth.me.useQuery();
  // /live renders one contextual instance inside the model dashboard.
  if (!/^\/(?:training(?:\/|$)|learn$|dashboard(?:\/|$))/.test(path))
    return null;
  return (
    <Assistant
      key={`${auth.data?.id ?? "guest"}:${language}`}
      userId={auth.data?.id ?? null}
      language={language}
    />
  );
}

export function BoothLearningAssistant(booth: BoothContextSource) {
  const [language] = useProductLanguage();
  const readiness = trpc.learning.status.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: true,
    staleTime: 30_000,
  });
  const auth = trpc.auth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: true,
    enabled: readiness.data?.loginReady !== false,
  });
  return (
    <Assistant
      key={`${auth.data?.id ?? "guest"}:${language}`}
      userId={auth.data?.id ?? null}
      language={language}
      booth={booth}
      authPending={auth.isPending}
      authFailed={auth.isError}
      onAuthRetry={() => {
        void auth.refetch();
      }}
      serviceState={
        readiness.isPending
          ? "checking"
          : readiness.isError
            ? "error"
            : readiness.data?.loginReady && readiness.data.aiReady
              ? "ready"
              : "unavailable"
      }
      onServiceRetry={() => {
        void readiness.refetch();
      }}
    />
  );
}

function Assistant({
  userId,
  language,
  booth,
  authPending = false,
  authFailed = false,
  onAuthRetry,
  serviceState = "ready",
  onServiceRetry,
}: {
  userId: number | null;
  language: ProductLanguage;
  booth?: BoothContextSource;
  authPending?: boolean;
  authFailed?: boolean;
  onAuthRetry?: () => void;
  serviceState?: "checking" | "ready" | "unavailable" | "error";
  onServiceRetry?: () => void;
}) {
  const l = (ko: string, en: string, ja: string) => tr(language, ko, en, ja);
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [consent, setConsent] = useState(false);
  const [exchanges, setExchanges] = useState<Exchange[]>([]);
  const [notice, setNotice] = useState("");
  const [waiting, setWaiting] = useState(false);
  const ask = trpc.learning.ask.useMutation({ retry: false });
  const mounted = useRef(true);
  const generation = useRef(0);
  const input = useRef<HTMLTextAreaElement>(null);
  const end = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      generation.current++;
    };
  }, []);
  useEffect(() => {
    if (open) end.current?.scrollIntoView({ block: "nearest" });
  }, [exchanges, open, waiting]);
  useEffect(() => {
    // Let the terminal result dialog take focus; chat history stays with this run.
    if (booth?.stage === "review") setOpen(false);
  }, [booth?.stage]);
  const send = async () => {
    const text = question.trim();
    if (
      serviceState !== "ready" ||
      !userId ||
      !consent ||
      waiting ||
      text.length < 2 ||
      text.length > 800
    )
      return;
    // Capture exactly the displayed run (including frozen review data) on Send.
    let context: BoothLearningContext | undefined;
    try {
      context = booth
        ? createBoothLearningContext(booth.snapshot, booth.stage)
        : undefined;
    } catch {
      setNotice(
        l(
          "체험 상태가 바뀌었어요. 잠시 후 질문을 다시 보내주세요.",
          "The run changed. Send your question again shortly.",
          "体験の状態が変わりました。少し待って再送してください。"
        )
      );
      return;
    }
    const sequence = ++generation.current;
    setNotice("");
    setWaiting(true);
    setQuestion("");
    setExchanges(items => [
      ...items.slice(-9),
      { question: text, result: null, ...(context ? { context } : {}) },
    ]);
    try {
      const result = await ask.mutateAsync({
        consent: true,
        language,
        question: text,
        ...(context ? { boothContext: context } : {}),
      });
      if (!mounted.current || generation.current !== sequence) return;
      setExchanges(items =>
        items.map((item, index) =>
          index === items.length - 1 ? { ...item, result } : item
        )
      );
      if (result.status === "unavailable") setQuestion(text);
    } catch {
      if (mounted.current && generation.current === sequence) {
        setQuestion(text);
        setNotice(
          l(
            "답변을 받지 못했습니다. 잠시 후 질문을 다시 보내세요.",
            "Could not receive an answer. Send your question again later.",
            "回答を受け取れませんでした。後で質問を再送してください。"
          )
        );
      }
    } finally {
      if (mounted.current && generation.current === sequence) setWaiting(false);
    }
  };
  const routeLabel = (destination: string) =>
    destination === "learn"
      ? l("8대 공정 학습", "Process learning", "8大工程学習")
      : destination === "live"
        ? l("자유 분석", "Free analysis", "自由分析")
        : destination === "dashboard"
          ? l(
              "4센서 대시보드",
              "Four-sensor dashboard",
              "4センサーダッシュボード"
            )
          : l("연습 선택", "Choose practice", "練習を選ぶ");
  const openFrom = (element: HTMLElement) => {
    opener.current = element;
    setOpen(true);
  };
  const contextLabel = booth
    ? l(
        "공정 체험 AI 도우미",
        "Process experience AI helper",
        "プロセス体験AIアシスタント"
      )
    : l(
        "SemiGuard 학습 도우미",
        "SemiGuard learning assistant",
        "SemiGuard学習アシスタント"
      );
  const starters = [
    l(
      "지금 무엇부터 확인하면 좋을까?",
      "What should I check first?",
      "今は何から確認するとよいですか？"
    ),
    l(
      "유량과 압력은 어떤 관계야?",
      "How are flow and pressure related?",
      "流量と圧力はどのような関係ですか？"
    ),
    l(
      "복구가 아직 완료되지 않는 이유는?",
      "Why is recovery not complete yet?",
      "まだ復旧完了にならないのはなぜですか？"
    ),
  ];
  return (
    <Dialog.Root open={open} onOpenChange={setOpen} modal={false}>
      {booth && (
        <button
          type="button"
          className="sg-assistant-inline"
          onClick={event => openFrom(event.currentTarget)}
          aria-haspopup="dialog"
          aria-expanded={open}
        >
          <MessageCircle size={17} aria-hidden="true" />
          <span>
            {l(
              "막혔나요? AI에게 질문",
              "Need help? Ask AI",
              "困ったらAIに質問"
            )}
          </span>
        </button>
      )}
      <Dialog.Trigger asChild>
        <button
          type="button"
          className={"sg-assistant-trigger" + (booth ? " is-booth" : "")}
          onClick={event => {
            opener.current = event.currentTarget;
          }}
          aria-label={
            booth
              ? l(
                  "공정 체험 AI에게 질문",
                  "Ask process experience AI",
                  "プロセス体験AIに質問"
                )
              : l(
                  "학습 도우미 열기",
                  "Open learning assistant",
                  "学習アシスタントを開く"
                )
          }
        >
          <MessageCircle aria-hidden="true" size={24} />
          {booth && <span>{l("AI 질문", "Ask AI", "AI質問")}</span>}
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Content
          className="sg-assistant-panel"
          onOpenAutoFocus={event => {
            event.preventDefault();
            input.current?.focus();
          }}
          onCloseAutoFocus={event => {
            if (opener.current) {
              event.preventDefault();
              opener.current.focus();
            }
          }}
          onInteractOutside={event => event.preventDefault()}
        >
          <div className="sg-assistant-head">
            <Dialog.Title>{contextLabel}</Dialog.Title>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label={l(
                  "질문 창 닫기",
                  "Close questions",
                  "質問画面を閉じる"
                )}
              >
                <X size={20} />
              </button>
            </Dialog.Close>
          </div>
          <Dialog.Description className="sg-assistant-note">
            {booth
              ? l(
                  "현재 모의값을 참고해 관찰 순서와 화면 조절 방법을 물어보세요.",
                  "Ask what to observe or adjust on screen using the displayed simulated values.",
                  "表示された模擬値をもとに、観察の順序や画面の調整方法を質問できます。"
                )
              : l(
                  "개념과 가상 기록 비교를 물어보세요. 실제 장비 진단·제어는 하지 않습니다.",
                  "Ask about concepts and virtual-record comparisons, not real equipment diagnosis or control.",
                  "概念や仮想記録の比較を質問できます。実装置の診断・制御はしません。"
                )}
          </Dialog.Description>
          {booth && (
            <div
              className="sg-assistant-starters"
              aria-label={l("질문 예시", "Example questions", "質問例")}
            >
              {starters.map(starter => (
                <button
                  type="button"
                  key={starter}
                  disabled={waiting || serviceState !== "ready" || !userId}
                  onClick={() => {
                    setQuestion(starter);
                    input.current?.focus();
                  }}
                >
                  {starter}
                </button>
              ))}
            </div>
          )}
          <div
            className="sg-assistant-messages"
            role="log"
            aria-label={l("질문과 답변", "Questions and answers", "質問と回答")}
            aria-live="polite"
          >
            {!exchanges.length ? (
              <>
                <p>
                  {booth
                    ? l(
                        "어디서 막혔는지 적어주세요. 질문을 보낼 때 선택한 상황과 그때의 모의값을 함께 전달해요.",
                        "Describe where you are stuck. Sending captures the selected scenario and its displayed simulation values.",
                        "困っている点を書いてください。送信時の状況と模擬値を一緒に送ります。"
                      )
                    : l(
                        "예: 정상 범위 안인데도 이전 기록과 비교해야 하는 이유는?",
                        "Example: Why compare previous records even within the normal range?",
                        "例：正常範囲内でも以前の記録と比較するのはなぜですか？"
                      )}
                </p>
                <p className="sg-assistant-note">
                  {booth
                    ? l(
                        "질문과 화면의 모의값만 전송해요. 카메라 영상·복기 글·이전 대화는 보내지 않아요. 대화는 새로고침·계정·언어 변경 시 지워져요.",
                        "Only this question and displayed simulation values are sent, without video, reflection writing or prior chat. Chat clears on refresh, account or language change.",
                        "現在の質問と画面の模擬値だけを送信します。映像・振り返り文・過去の会話は送りません。更新・アカウントや言語の変更で会話は消えます。"
                      )
                    : l(
                        "대화는 이 화면의 메모리에만 남습니다. 새로고침·계정 또는 언어 변경 시 지워집니다. 매번 현재 질문만 보내며 이전 대화·답안·개인 기록을 자동으로 읽지 않습니다.",
                        "Chat stays only in this screen's memory and clears on refresh, account or language change. Only the current question is sent; prior chat, answers and personal records are not read automatically.",
                        "会話はこの画面のメモリーだけに残り、更新・アカウントや言語の変更で消えます。現在の質問のみ送信し、過去の会話・回答・個人記録は自動で読みません。"
                      )}
                </p>
              </>
            ) : null}
            {exchanges.map((item, index) => (
              <article key={index}>
                <p className="sg-assistant-question">{item.question}</p>
                {item.context && (
                  <details className="sg-assistant-context">
                    <summary>
                      {l(...scenarioNames[item.context.scenarioId])} ·{" "}
                      {l(
                        "질문 시점 모의값",
                        "Simulation values when asked",
                        "質問時点の模擬値"
                      )}{" "}
                      ·{" "}
                      {new Date(item.context.capturedAtMs).toLocaleTimeString(
                        language === "ko"
                          ? "ko-KR"
                          : language === "ja"
                            ? "ja-JP"
                            : "en-US",
                        {
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        }
                      )}
                      {" · " +
                        (item.context.stage === "review"
                          ? l("종료 기록", "Final record", "終了記録")
                          : item.context.stage === "brief"
                            ? l("시작 전", "Before start", "開始前")
                            : l("체험 중", "During run", "体験中"))}
                    </summary>
                    <dl>
                      {BOOTH_SIGNALS.map(signal => (
                        <div key={signal.key}>
                          <dt>
                            {signal.number} {signal.label}
                          </dt>
                          <dd>
                            {item.context!.values[signal.key].toFixed(
                              signal.key === "rfPower" ? 0 : 1
                            )}{" "}
                            {signal.unit}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </details>
                )}
                {item.result?.status === "ready" ? (
                  <>
                    <p className="sg-assistant-answer">{item.result.answer}</p>
                    <small>
                      NVIDIA ·{" "}
                      {l(
                        "AI 답변은 참고용입니다. 근거를 다시 확인하세요.",
                        "AI answers are a learning aid. Check the evidence.",
                        "AI回答は参考です。根拠を再確認してください。"
                      )}
                    </small>
                    {item.result.destination !== "none" ? (
                      booth ? (
                        <a
                          href={`/${item.result.destination}`}
                          onClick={() => setOpen(false)}
                        >
                          {routeLabel(item.result.destination)} →
                        </a>
                      ) : (
                        <Link
                          href={`/${item.result.destination}`}
                          onClick={() => setOpen(false)}
                        >
                          {routeLabel(item.result.destination)} →
                        </Link>
                      )
                    ) : null}
                  </>
                ) : item.result ? (
                  <p>
                    {item.result.reason === "cooldown"
                      ? l(
                          "요청 간격이 짧습니다. 15초 정도 기다린 뒤 다시 질문하세요.",
                          "Please wait about 15 seconds before asking again.",
                          "15秒ほど待ってから再度質問してください。"
                        )
                      : item.result.reason === "not-configured"
                        ? l(
                            "AI 연결이 아직 설정되지 않았어요. 사이트의 AI 연결 설정을 확인한 뒤 다시 보내주세요.",
                            "AI is not configured yet. Check the site's AI connection settings, then resend.",
                            "AI接続がまだ設定されていません。サイトのAI接続設定を確認してから再送してください。"
                          )
                        : l(
                            "현재 AI 답변을 받지 못했어요. 질문은 입력 칸에 남겨뒀으니 잠시 후 다시 보내주세요.",
                            "AI did not return an answer. Your question is back in the input; resend it later.",
                            "AIの回答を受け取れませんでした。入力欄に質問を戻したので、後で再送してください。"
                          )}
                  </p>
                ) : null}
              </article>
            ))}
            {waiting ? (
              <p role="status">
                {l(
                  "NVIDIA 답변을 기다리는 중…",
                  "Waiting for NVIDIA…",
                  "NVIDIAの回答を待っています…"
                )}
              </p>
            ) : null}
            {notice ? <p role="alert">{notice}</p> : null}
            <div ref={end} />
          </div>
          {serviceState !== "ready" ? (
            <div className="sg-assistant-service-state" role="status">
              <p>
                {serviceState === "checking"
                  ? l(
                      "AI 연결을 확인하고 있어요…",
                      "Checking the AI connection…",
                      "AI接続を確認しています…"
                    )
                  : serviceState === "unavailable"
                    ? l(
                        "이 화면의 AI 연결을 준비 중이에요. 모형 체험은 계속할 수 있어요.",
                        "AI is being prepared for this screen. You can continue the model experience.",
                        "この画面のAI接続は準備中です。模型の体験は続けられます。"
                      )
                    : l(
                        "AI 연결을 확인하지 못했어요. 잠시 후 다시 확인해주세요.",
                        "Could not check the AI connection. Try again shortly.",
                        "AI接続を確認できませんでした。少し待って再確認してください。"
                      )}
              </p>
              {serviceState === "error" && (
                <button type="button" onClick={onServiceRetry}>
                  {l(
                    "연결 다시 확인",
                    "Check connection again",
                    "接続を再確認"
                  )}
                </button>
              )}
            </div>
          ) : !userId ? (
            authPending ? (
              <p role="status">
                {l(
                  "로그인 상태 확인 중…",
                  "Checking sign-in…",
                  "ログイン状態を確認中…"
                )}
              </p>
            ) : authFailed ? (
              <div className="sg-assistant-auth-error">
                <p role="alert">
                  {l(
                    "AI 질문에 필요한 로그인 서버에 연결하지 못했어요. 사이트 서버 설정과 연결을 확인해주세요.",
                    "Could not reach the sign-in server needed for AI questions. Check the site's server configuration and connection.",
                    "AI質問に必要なログインサーバーに接続できませんでした。サイトのサーバー設定と接続を確認してください。"
                  )}
                </p>
                <button type="button" onClick={onAuthRetry}>
                  {l(
                    "연결 다시 확인",
                    "Check connection again",
                    "接続を再確認"
                  )}
                </button>
              </div>
            ) : (
              <a
                href="/login"
                target={booth ? "_blank" : undefined}
                rel={booth ? "noopener" : undefined}
              >
                {booth
                  ? l(
                      "AI 질문 로그인 · 새 탭에서 로그인 후 이 창으로 돌아오세요",
                      "Sign in for AI · use the new tab, then return here",
                      "AI質問にログイン・新しいタブでログイン後、この画面に戻ってください"
                    )
                  : l(
                      "AI 질문은 로그인 후 사용할 수 있어요.",
                      "Sign in to ask AI questions.",
                      "AIへの質問にはログインしてください。"
                    )}
              </a>
            )
          ) : (
            <form
              onSubmit={event => {
                event.preventDefault();
                void send();
              }}
            >
              <label className="sg-assistant-consent">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={e => setConsent(e.target.checked)}
                />
                {booth
                  ? l(
                      "질문과 화면의 모의값을 NVIDIA로 보내는 데 동의합니다. 개인정보·회사 자료를 넣지 마세요.",
                      "I agree to send my question and displayed simulation values to NVIDIA. No personal/company information.",
                      "質問と画面の模擬値をNVIDIAへ送信することに同意します。個人情報や会社資料を入れないでください。"
                    )
                  : l(
                      "작성한 질문을 NVIDIA로 보내는 데 동의합니다. 개인정보·회사 자료를 넣지 마세요.",
                      "I agree to send my question to NVIDIA. No personal/company information.",
                      "質問をNVIDIAへ送信することに同意します。個人情報や会社資料を入れないでください。"
                    )}
              </label>
              <label htmlFor="learning-question">
                {l("궁금한 점", "Your question", "質問")}
              </label>
              <textarea
                id="learning-question"
                ref={input}
                rows={3}
                maxLength={800}
                value={question}
                onChange={e => setQuestion(e.target.value)}
                disabled={waiting}
                onKeyDown={event => {
                  if (
                    event.key === "Enter" &&
                    (event.ctrlKey || event.metaKey) &&
                    !event.nativeEvent.isComposing
                  ) {
                    event.preventDefault();
                    void send();
                  }
                }}
              />
              <div className="sg-assistant-send">
                <span>{question.length}/800</span>
                <button
                  type="submit"
                  disabled={!consent || waiting || question.trim().length < 2}
                >
                  <Send size={16} />
                  {l("질문 보내기", "Send question", "質問を送信")}
                </button>
              </div>
            </form>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
