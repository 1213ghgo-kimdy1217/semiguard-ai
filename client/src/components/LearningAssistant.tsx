import { useEffect, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { MessageCircle, Send, X } from "lucide-react";
import { Link, useLocation } from "wouter";
import { tr, useProductLanguage, type ProductLanguage } from "../lib/productLanguage";
import { trpc } from "../lib/trpc";
import type { LearningAssistantResult } from "../../../shared/learningAssistant";
import "./learning-assistant.css";

type Exchange = { question: string; result: LearningAssistantResult | null };
export default function LearningAssistant() {
  const [path] = useLocation();
  const [language] = useProductLanguage();
  const auth = trpc.auth.me.useQuery();
  if (!/^\/(?:training(?:\/|$)|learn$|live$|dashboard(?:\/|$))/.test(path)) return null;
  return <Assistant key={`${auth.data?.id ?? "guest"}:${language}`} userId={auth.data?.id ?? null} language={language} />;
}

function Assistant({ userId, language }: { userId: number | null; language: ProductLanguage }) {
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
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; generation.current++; }; }, []);
  useEffect(() => { if (open) end.current?.scrollIntoView({ block: "nearest" }); }, [exchanges, open, waiting]);
  const send = async () => {
    const text = question.trim();
    if (!userId || !consent || waiting || text.length < 2 || text.length > 800) return;
    const sequence = ++generation.current;
    setNotice(""); setWaiting(true); setQuestion("");
    setExchanges(items => [...items.slice(-9), { question: text, result: null }]);
    try {
      const result = await ask.mutateAsync({ consent: true, language, question: text });
      if (!mounted.current || generation.current !== sequence) return;
      setExchanges(items => items.map((item, index) => index === items.length - 1 ? { ...item, result } : item));
    } catch {
      if (mounted.current && generation.current === sequence) setNotice(l("답변을 받지 못했습니다. 잠시 후 질문을 다시 보내세요.", "Could not receive an answer. Send your question again later.", "回答を受け取れませんでした。後で質問を再送してください。"));
    } finally { if (mounted.current && generation.current === sequence) setWaiting(false); }
  };
  const routeLabel = (destination: string) => destination === "learn" ? l("8대 공정 학습", "Process learning", "8大工程学習")
    : destination === "live" ? l("자유 분석", "Free analysis", "自由分析") : destination === "dashboard" ? l("4센서 대시보드", "Four-sensor dashboard", "4センサーダッシュボード") : l("연습 선택", "Choose practice", "練習を選ぶ");
  return <Dialog.Root open={open} onOpenChange={setOpen} modal={false}>
    <Dialog.Trigger asChild><button type="button" className="sg-assistant-trigger" aria-label={l("학습 도우미 열기", "Open learning assistant", "学習アシスタントを開く")}><MessageCircle aria-hidden="true" size={24} /></button></Dialog.Trigger>
    <Dialog.Portal><Dialog.Content className="sg-assistant-panel" onOpenAutoFocus={event => { event.preventDefault(); input.current?.focus(); }} onInteractOutside={event => event.preventDefault()}>
      <div className="sg-assistant-head"><Dialog.Title>{l("SemiGuard 학습 도우미", "SemiGuard learning assistant", "SemiGuard学習アシスタント")}</Dialog.Title><Dialog.Close asChild><button type="button" aria-label={l("질문 창 닫기", "Close questions", "質問画面を閉じる")}><X size={20} /></button></Dialog.Close></div>
      <Dialog.Description className="sg-assistant-note">{l("개념과 가상 기록 비교를 물어보세요. 실제 장비 진단·제어는 하지 않습니다.", "Ask about concepts and virtual-record comparisons, not real equipment diagnosis or control.", "概念や仮想記録の比較を質問できます。実装置の診断・制御はしません。")}</Dialog.Description>
      <div className="sg-assistant-messages" role="log" aria-label={l("질문과 답변", "Questions and answers", "質問と回答")} aria-live="polite">
        {!exchanges.length ? <><p>{l("예: 정상 범위 안인데도 이전 기록과 비교해야 하는 이유는?", "Example: Why compare previous records even within the normal range?", "例：正常範囲内でも以前の記録と比較するのはなぜですか？")}</p><p className="sg-assistant-note">{l("대화는 이 화면의 메모리에만 남습니다. 새로고침·계정 또는 언어 변경 시 지워집니다. 매번 현재 질문만 보내며 이전 대화·답안·개인 기록을 자동으로 읽지 않습니다.", "Chat stays only in this screen's memory and clears on refresh, account or language change. Only the current question is sent; prior chat, answers and personal records are not read automatically.", "会話はこの画面のメモリーだけに残り、更新・アカウントや言語の変更で消えます。現在の質問のみ送信し、過去の会話・回答・個人記録は自動で読みません。")}</p></> : null}
        {exchanges.map((item, index) => <article key={index}><p className="sg-assistant-question">{item.question}</p>{item.result?.status === "ready" ? <><p className="sg-assistant-answer">{item.result.answer}</p><small>NVIDIA · {l("AI 답변은 참고용입니다. 근거를 다시 확인하세요.", "AI answers are a learning aid. Check the evidence.", "AI回答は参考です。根拠を再確認してください。")}</small>{item.result.destination !== "none" ? <Link href={`/${item.result.destination}`} onClick={() => setOpen(false)}>{routeLabel(item.result.destination)} →</Link> : null}</>
          : item.result ? <p>{item.result.reason === "cooldown" ? l("요청 간격이 짧습니다. 잠시 후 다시 질문하세요.", "Requests are too close together. Ask again shortly.", "リクエストの間隔が短すぎます。少し待って再度質問してください。") : l("현재 AI 답변을 제공할 수 없습니다. 학습 화면을 이용하거나 나중에 다시 질문하세요.", "AI answers are currently unavailable. Use the learning pages or try later.", "現在AI回答を提供できません。学習画面を使うか、後で再度質問してください。")}</p> : null}</article>)}
        {waiting ? <p role="status">{l("NVIDIA 답변을 기다리는 중…", "Waiting for NVIDIA…", "NVIDIAの回答を待っています…")}</p> : null}
        {notice ? <p role="alert">{notice}</p> : null}<div ref={end} />
      </div>
      {!userId ? <Link href="/login">{l("AI 질문은 로그인 후 사용할 수 있어요.", "Sign in to ask AI questions.", "AIへの質問にはログインしてください。")}</Link>
        : <form onSubmit={event => { event.preventDefault(); void send(); }}><label className="sg-assistant-consent"><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} />{l("작성한 질문을 NVIDIA로 보내는 데 동의합니다. 개인정보·회사 자료를 넣지 마세요.", "I agree to send my question to NVIDIA. No personal/company information.", "質問をNVIDIAへ送信することに同意します。個人情報や会社資料を入れないでください。")}</label>
          <label htmlFor="learning-question">{l("궁금한 점", "Your question", "質問")}</label><textarea id="learning-question" ref={input} rows={3} maxLength={800} value={question} onChange={e => setQuestion(e.target.value)} disabled={waiting} />
          <div className="sg-assistant-send"><span>{question.length}/800</span><button type="submit" disabled={!consent || waiting || question.trim().length < 2}><Send size={16} />{l("질문 보내기", "Send question", "質問を送信")}</button></div></form>}
    </Dialog.Content></Dialog.Portal>
  </Dialog.Root>;
}
