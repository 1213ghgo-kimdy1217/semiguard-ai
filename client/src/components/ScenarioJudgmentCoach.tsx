import { useId, useRef, useState } from "react";
import { Link } from "wouter";
import { Button } from "./ui/button";
import { trpc } from "../lib/trpc";
import { tr, type ProductLanguage } from "../lib/productLanguage";
import { toJudgmentCoachRequest, toProcessJudgmentCoachRequest, type CoachDimension, type CoachStrength, type JudgmentCoachResult } from "../../../shared/judgmentCoach";
import type { EtchAttempt } from "../../../shared/etchScenario";
import type { ProcessAttempt, ProcessScenario } from "../../../shared/processScenarios";
import "./judgment-coach.css";

const dimensionLabels: Record<CoachDimension, [string, string, string]> = {
  reference: ["정상 참고와 비교", "Compare the normal reference", "正常参照と比較"],
  onset: ["변화 시작 시점", "Change onset", "変化の開始時点"],
  "cross-sensor": ["여러 센서 비교", "Compare multiple signals", "複数のセンサーを比較"],
  uncertainty: ["사실과 추정 구분", "Separate facts and inference", "事実と推測を区別"],
  checks: ["가상 기록의 다음 비교 순서", "Next virtual-record comparisons", "仮想記録で次に比較する順序"],
};
const strengthLabels: Record<CoachStrength, [string, string, string]> = {
  signal: ["변화 항목으로 챔버 압력을 선택했습니다.", "You selected chamber pressure as the changing signal.", "変化した項目としてチャンバー圧力を選びました。"],
  reference: ["같은 단계의 정상 참고를 비교 기준으로 선택했습니다.", "You selected a normal reference from the same phase.", "同じ段階の正常参照を比較基準に選びました。"],
  uncertainty: ["관찰만으로 원인을 확정하지 않는 선택을 했습니다.", "You chose not to confirm a cause from observation alone.", "観察だけで原因を確定しない選択をしました。"],
};

type ScenarioCoachProps = { language: ProductLanguage; userId: number | null } & (
  { attempt: EtchAttempt; processAttempt?: never; scenario?: never } |
  { attempt?: never; processAttempt: ProcessAttempt; scenario: ProcessScenario }
);
export default function ScenarioJudgmentCoach({ attempt: etchAttempt, processAttempt, scenario, language, userId }: ScenarioCoachProps) {
  const attempt = etchAttempt ?? processAttempt;
  const l = (ko: string, en: string, ja: string) => tr(language, ko, en, ja);
  const id = useId();
  const [consent, setConsent] = useState(false);
  const [result, setResult] = useState<JudgmentCoachResult | null>(null);
  const [networkError, setNetworkError] = useState(false);
  const pending = useRef(false);
  const coach = trpc.training.coach.useMutation({ retry: false });
  // Only a deliberate click sends text; no effect, automatic language request or DB save.
  const request = async () => {
    if (!attempt || (processAttempt && scenario?.id !== processAttempt.scenarioId)) return;
    if (!consent || !userId || !attempt.submitted || pending.current) return;
    pending.current = true; setResult(null); setNetworkError(false);
    try { setResult(await coach.mutateAsync(processAttempt
      ? toProcessJudgmentCoachRequest(processAttempt, language) : toJudgmentCoachRequest(attempt, language))); }
    catch { setNetworkError(true); }
    finally { pending.current = false; }
  };
  const busy = coach.isPending;
  const unavailable = result?.status === "unavailable";
  return <section className="et-panel judgment-coach" aria-labelledby={`${id}-heading`}>
    <p className="et-eyebrow">AI JUDGMENT COACH / OPTIONAL</p>
    <h2 id={`${id}-heading`}>{l("내 판단에서 빠진 근거를 돌아봅니다.", "Revisit the evidence behind your reasoning.", "自分の判断の根拠を振り返ります。")}</h2>
    <p>{l("기존 기준 피드백과 별도로, AI가 내가 작성한 관찰 사실과 확인 계획을 읽고 보완 질문을 제안합니다. 고장 확정·자동 채점·현장 자격 평가는 하지 않습니다.", "Separately from the criteria feedback, AI reviews your written observations and comparison plan to suggest reflection questions. It does not diagnose faults, grade you, or assess workplace qualifications.", "基準フィードバックとは別に、AIが観察事実と確認計画を読み、振り返りの問いを提案します。故障の確定、自動採点、現場の資格評価は行いません。")}</p>
    <details className="coach-disclosure"><summary>{l("AI에 전달되는 내용 확인", "Review what is sent to AI", "AIに送信する内容を確認")}</summary>
      <p>{l("NVIDIA에 두 서술형 답안, 선택한 센서·변화 시점·비교 기준·확신 여부, 그래프 표시 시점, 표시 언어와 서버가 만든 가상 시나리오 근거를 전달합니다. 계정 이름·이메일·학습 이력·API 키는 답안 내용에 포함하지 않습니다. 개인정보·회사 기밀·실제 설비 자료를 답안에 입력하지 마세요.", "NVIDIA receives your two written answers, chosen signal/onset/reference/certainty, chart marker, language, and server-generated synthetic scenario evidence. Account names, emails, learning history and API keys are not included in the answer content. Do not put personal, confidential or real equipment data in your answers.", "NVIDIAには二つの記述回答、選択したセンサー・変化時点・比較基準・確信度、グラフの印、表示言語、サーバーが作成した仮想シナリオの根拠を送信します。アカウント名、メール、学習履歴、APIキーは回答内容に含めません。個人情報、会社の機密、実装置の資料を回答に入力しないでください。")}</p>
      <p>{l("SemiGuard 학습 DB에는 서술형 원문이나 AI 코칭을 저장하지 않습니다. AI 답변은 현재 화면에서만 표시하며, 제공자의 데이터 처리는 NVIDIA 정책을 따릅니다.", "SemiGuard does not save the written answers or AI coaching in its learning database. Coaching stays in the current view; provider-side data handling follows NVIDIA's policy.", "SemiGuardの学習DBには記述回答やAIコーチングを保存しません。回答は現在の画面にのみ表示し、提供者側のデータ処理はNVIDIAのポリシーに従います。")}</p>
    </details>
    {userId ? <>
      <label className="coach-consent"><input type="checkbox" checked={consent} disabled={busy} onChange={event => setConsent(event.target.checked)} />
        {l("위 내용을 확인했으며, 이 답안을 NVIDIA에 보내 AI 코칭을 요청합니다.", "I have reviewed the disclosure and choose to send this answer to NVIDIA for coaching.", "上記の内容を確認し、この回答をNVIDIAに送信してAIコーチングを依頼します。")}
      </label>
      <Button className="et-primary" disabled={!consent || busy} onClick={() => void request()}>
        {busy ? l("AI 코치가 판단 근거를 읽는 중…", "AI coach is reviewing the evidence…", "AIコーチが判断の根拠を確認中…") : result?.status === "ready" ? l("같은 답안 코칭 다시 요청", "Request coaching again", "同じ回答のコーチングを再依頼") : l("AI 코칭 요청", "Request AI coaching", "AIコーチングを依頼")}
      </Button>
    </> : <p><Link className="et-linkbutton" href="/login">{l("로그인 후 AI 코칭 사용", "Sign in to use AI coaching", "ログインしてAIコーチングを使う")}</Link></p>}
    <div aria-live="polite" aria-atomic="true" aria-busy={busy}>
      {busy ? <p role="status">{l("최대 40초가 걸릴 수 있습니다. 답안을 다시 제출하거나 페이지를 닫지 않아도 됩니다.", "This may take up to 40 seconds. You do not need to resubmit the exercise or close the page.", "最大40秒ほどかかる場合があります。練習を再提出したりページを閉じる必要はありません。")}</p> : null}
      {result?.status === "ready" ? <p role="status">{l("AI 코칭이 도착했습니다. 아래에서 판단 근거와 질문을 확인하세요.", "AI coaching is ready. Review the evidence and questions below.", "AIコーチングが届きました。以下の根拠と問いを確認してください。")}</p> : null}
      {networkError || unavailable ? <p className="et-alert" role="status">{result?.status === "unavailable" && result.reason === "cooldown"
        ? l(`요청이 진행 중이거나 너무 빠르게 반복됐습니다. 약 ${result.retryAfterSeconds ?? 60}초 뒤 직접 다시 요청하세요.`, `A request is active or was repeated too quickly. Try again manually in about ${result.retryAfterSeconds ?? 60} seconds.`, `リクエストが進行中、または繰り返しが速すぎます。約${result.retryAfterSeconds ?? 60}秒後に手動で再依頼してください。`)
        : l("AI 코칭을 받지 못했습니다. AI 답변을 대신 만들지 않으며, 기존 기준 피드백과 타임라인 복기는 그대로 사용할 수 있습니다.", "AI coaching is unavailable. No substitute is presented as AI; criteria feedback and timeline review remain available.", "AIコーチングを受け取れませんでした。代替文をAI回答として表示せず、基準フィードバックとタイムラインの振り返りはそのまま使えます。")}</p> : null}
    </div>
    {result?.status === "ready" ? <div className="coach-result">
      <p className="et-caption">NVIDIA · {result.model} · {l("AI 생성 코칭 · 참고용", "AI-generated coaching · advisory", "AI生成コーチング · 参考用")}</p>
      {result.feedback.strengths.length ? <><h3>{l("선택형 기준에서 확인한 출발점", "Starting points checked against choice criteria", "選択基準で確認した出発点")}</h3>
        <ul>{result.feedback.strengths.map(item => <li key={item}>{scenario && item === "signal"
          ? l("관찰 항목 선택이 이 가상 시나리오의 비교 기준과 일치했습니다.", "Your observation choice matches this synthetic scenario's comparison criterion.", "観察項目の選択が、この仮想シナリオの比較基準と一致しました。")
          : scenario && item === "reference" ? l("같은 조건의 정상 참고를 비교 기준으로 선택했습니다.", "You selected a normal reference under matching conditions.", "同じ条件の正常参照を比較基準に選びました。")
          : l(...strengthLabels[item])}</li>)}</ul>
        <p className="et-caption">{l("위 문구는 기준 기반 안내이며, 아래 복기 질문은 AI가 생성합니다.", "These labels are criteria-based; the reflection questions below are AI-generated.", "上記は基準に基づく案内で、以下の振り返りの問いはAIが生成します。")}</p></> : null}
      {result.feedback.reflections.map(item => <article className="coach-reflection" key={item.dimension}>
        <h3>{l(...dimensionLabels[item.dimension])}</h3><p><strong>{l("내 답안에서", "From your answer", "自分の回答から")}</strong> “{item.answerQuote}”</p>
        <p className="coach-question"><strong>{l("다시 생각할 질문", "A question to revisit", "考え直す問い")}</strong> {item.question}</p>
        <p className="et-caption">{scenario
          ? `${l("근거", "Evidence", "根拠")}: ${l(...scenario.title)} · ${l("교육용 가상 기록", "synthetic educational records", "教育用の仮想記録")}`
          : l("근거: 식각 판단 연습의 가상 기록", "Evidence: etch judgment exercise records", "根拠：エッチング判断練習の仮想記録")}</p>
      </article>)}
      <p className="et-caption">{l("AI 해석은 틀릴 수 있습니다. 위 타임라인과 정상 참고 기록을 다시 확인하세요. 언어·계정·시도를 바꾸면 코칭 표시와 동의를 초기화하며 자동 재요청하지 않습니다.", "AI interpretation may be wrong. Recheck the timeline and normal reference above. Changing language, account or attempt clears coaching and consent without an automatic request.", "AIの解釈には誤りがあり得ます。上のタイムラインと正常参照を再確認してください。言語、アカウント、試行を変更すると表示と同意をリセットし、自動再依頼しません。")}</p>
    </div> : null}
  </section>;
}
