import { useEffect, useRef, useState } from "react";
import { CheckCircle2, RotateCcw, Trophy } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";
import { BOOTH_ALARM_CLEAR_MS, BOOTH_MIN_STABLE_MATCH_QUALITY, BOOTH_RECOVERY_RANGES, BOOTH_SIGNALS, type BoothSnapshot, type SignalKey } from "@shared/boothExperience";
import { matchingQualityPercent, missionFeedbackMarker, recoveryGuideStage, shouldOpenMissionCompletion, type MissionFeedbackMarker } from "@shared/boothMissionFeedback";
import { tr, type ProductLanguage } from "../lib/productLanguage";
import "./booth-mission-feedback.css";

type Props = { snapshot: BoothSnapshot; language: ProductLanguage };
const names: Record<SignalKey, [string, string, string]> = {
  pressure: ["챔버 압력", "Chamber pressure", "チャンバー圧力"],
  gasFlow: ["가스 유량", "Gas flow", "ガス流量"],
  rfPower: ["RF 전력", "RF power", "RF電力"],
  chamberAmbientTemp: ["주변 온도", "Ambient temperature", "周囲温度"],
};
const numberText = (key: SignalKey, value: number) => value.toFixed(key === "rfPower" ? 0 : 1);

export function BoothNormalGuide({ snapshot, language, onRecommended, disabled = false, compact = false }: Props & { onRecommended(): void; disabled?: boolean; compact?: boolean }) {
  const l = (ko: string, en: string, ja: string) => tr(language, ko, en, ja);
  const stage = recoveryGuideStage(snapshot);
  const matchingRelevant = snapshot.scenario.requiredControls.includes("matching");
  const matchingStable = snapshot.recovery.matching && snapshot.matchingQuality >= BOOTH_MIN_STABLE_MATCH_QUALITY;
  const showRecommended = snapshot.mode === "free";
  const messages = {
    normal: l("4개 항목 정상", "All four values normal", "4項目が正常"),
    abnormal: l("빨간 항목과 다른 값의 변화를 함께 비교해요", "Compare the red values with the other trends", "赤い項目と他の値の変化を比較しましょう"),
    matching: l("수치는 정상 · RF 매칭을 안정화해요", "Values normal · stabilize RF matching", "数値は正常・RFマッチングを安定化"),
    balancing: l("유량과 배기 균형을 함께 확인해요", "Check gas delivery and exhaust balance together", "流量と排気のバランスを確認しましょう"),
    holding: l("정상 유지 중 · 조절을 멈추고 기다려요", "Holding normal · keep controls steady", "正常維持中・設定を動かさず待ちましょう"),
    complete: l("정상 5초 유지 완료", "Five seconds of normal operation complete", "正常状態を5秒維持しました"),
  };
  const criteria = l("네 값의 경보를 해제하고 선택한 상황의 안정 조건을 5초 유지하면 완료예요. 다시 불안정해지면 유지 시간은 0초부터 세어요.", "Clear all four alarms and hold this scenario's stability conditions for five seconds. Instability restarts the hold timer.", "4項目の警報を解除し、選んだ状況の安定条件を5秒維持すると完了です。不安定になると0秒から数え直します。");
  const matchingStatus = matchingRelevant && snapshot.mode === "mission" ? <span className="bm-compact-matching" data-stable={String(matchingStable)}>{l("매칭", "Matching", "マッチング")} <strong>{matchingQualityPercent(snapshot.matchingQuality)}%</strong> · {matchingStable ? l("안정", "Stable", "安定") : l("조정 필요", "Adjust", "調整が必要")}</span> : null;
  const recoveryChecks = snapshot.mode === "mission" ? <div className="bm-recovery-checks" aria-label={l("복구 확인 항목", "Recovery checks", "復旧確認項目")}>
    {snapshot.scenario.requiredControls.includes("gasSetpoint") && <span data-ready={String(snapshot.recovery.gasDelivery)}>{l("유량", "Flow", "流量")} {snapshot.recovery.gasDelivery ? "✓" : "…"}</span>}
    {snapshot.scenario.requiredControls.includes("exhaustValve") && <span data-ready={String(snapshot.recovery.exhaust)}>{l("배기·압력", "Exhaust / pressure", "排気・圧力")} {snapshot.recovery.exhaust ? "✓" : "…"}</span>}
    {matchingRelevant && <span data-ready={String(matchingStable)}>{l("매칭", "Matching", "マッチング")} {matchingStable ? "✓" : "…"}</span>}
  </div> : null;
  if (compact) return <section className="bm-normal-guide bm-guide-compact" aria-label={l("조작 안내", "Control guidance", "操作ガイド")} data-recovery-stage={stage}>
    <p className={"bm-guide-stage " + (stage === "abnormal" ? "is-alarm" : "")}>{messages[stage]}</p>
    {recoveryChecks}
    <div className="bm-compact-meta">
      {matchingStatus}
      <details className="bm-criteria"><summary>{l("정상 판정 기준", "Recovery criteria", "正常判定の基準")}</summary><div>
        <p>{l("빨간 값은 아래 범위에서 " + BOOTH_ALARM_CLEAR_MS / 1000 + "초 유지하면 흰색으로 돌아와요.", "Red values return to white after " + BOOTH_ALARM_CLEAR_MS / 1000 + "s in these ranges.", "赤い値は次の範囲を" + BOOTH_ALARM_CLEAR_MS / 1000 + "秒維持すると白に戻ります。")}</p>
        <ul>{BOOTH_SIGNALS.map(signal => <li key={signal.key}>{signal.number} {l(...names[signal.key])}<span>{BOOTH_RECOVERY_RANGES[signal.key][0]}–{BOOTH_RECOVERY_RANGES[signal.key][1]} {signal.unit}</span></li>)}</ul>
        {snapshot.mode === "mission" && <p>{criteria}</p>}
        {matchingRelevant && <p>{l("매칭 안정도는 " + Math.round(BOOTH_MIN_STABLE_MATCH_QUALITY * 100) + "% 이상이 기준이에요.", "Matching stability must be at least " + Math.round(BOOTH_MIN_STABLE_MATCH_QUALITY * 100) + "%.", "マッチング安定度は" + Math.round(BOOTH_MIN_STABLE_MATCH_QUALITY * 100) + "%以上が基準です。")}</p>}
        <p>{l("설정값과 실제 표시값은 다를 수 있어요. 한 번에 한 설정씩 바꾸고 유량·압력·RF의 반응을 비교하세요.", "Commanded settings and displayed output can differ. Change one setting at a time and compare flow, pressure and RF.", "設定値と表示値は異なる場合があります。1つずつ調整して流量・圧力・RFの反応を比較します。")}</p>
        {showRecommended && <div className="bm-recommended"><button type="button" onClick={onRecommended} disabled={disabled}>{l("기본 운전값 맞추기", "Use starting settings", "基本設定に合わせる")}</button></div>}
      </div></details>
    </div>
  </section>;
  return <section className="bm-normal-guide" aria-labelledby="live-normal-guide-heading">
    <div className="bm-guide-heading"><h3 id="live-normal-guide-heading">{l("어디까지 맞추면 정상인가요?", "What counts as normal?", "どこまで合わせると正常？")}</h3><span>{l("교육용 기준", "Training reference", "教育用の基準")}</span></div>
    <p className={"bm-guide-stage " + (stage === "abnormal" ? "is-alarm" : "")}>{messages[stage]}</p>
    <table><thead><tr><th scope="col">{l("항목", "Quantity", "項目")}</th><th scope="col">{l("현재", "Current", "現在")}</th><th scope="col">{l("목표 · 정상 범위", "Target · normal range", "目標・正常範囲")}</th></tr></thead>
      <tbody>{BOOTH_SIGNALS.map(signal => { const alarm = snapshot.alarms[signal.key], recovery = BOOTH_RECOVERY_RANGES[signal.key]; return <tr key={signal.key} data-alarm={String(alarm)}>
        <th scope="row"><span>{signal.number}</span> {l(...names[signal.key])}</th>
        <td><strong className="bm-current-value">{numberText(signal.key, snapshot.values[signal.key])}</strong><small>{signal.unit}</small><span className="bm-value-status">{alarm ? l("복구 필요", "Recover", "復旧が必要") : l("정상", "Normal", "正常")}</span></td>
        <td><strong>{signal.target} <small>{signal.unit}</small></strong><span>{signal.normal[0]}–{signal.normal[1]} {signal.unit}</span>{alarm && <small className="bm-recovery-band">{l("복구 확인", "Recovery band", "復旧確認")} {recovery[0]}–{recovery[1]}</small>}</td>
      </tr>; })}</tbody>
    </table>
    <p className="bm-guide-note">{l("빨간 값은 복구 확인 범위에서 " + BOOTH_ALARM_CLEAR_MS / 1000 + "초 유지되면 흰색으로 돌아와요.", "Red values return to white after " + BOOTH_ALARM_CLEAR_MS / 1000 + "s in the recovery band.", "赤い値は復旧確認範囲を" + BOOTH_ALARM_CLEAR_MS / 1000 + "秒維持すると白に戻ります。")}</p>
    {recoveryChecks}{matchingStatus}
    {snapshot.mode === "mission" && <p className="bm-guide-rule">{criteria}</p>}
    {showRecommended && <div className="bm-recommended"><button type="button" onClick={onRecommended} disabled={disabled}>{l("기본 운전값 맞추기", "Use starting settings", "基本設定に合わせる")}</button></div>}
  </section>;
}

export default function BoothMissionFeedback({ snapshot, language, onRetry, onFreePlay, onReview }: Props & { onRetry(): void; onFreePlay(): void; onReview?(): void }) {
  const l = (ko: string, en: string, ja: string) => tr(language, ko, en, ja);
  const [open, setOpen] = useState(false);
  const previous = useRef<MissionFeedbackMarker | null>(null);
  const reviewButton = useRef<HTMLButtonElement>(null);
  const leavingForReview = useRef(false);
  const won = snapshot.mode === "mission" && snapshot.mission.status === "won";
  const marker = missionFeedbackMarker(snapshot);
  useEffect(() => {
    if (shouldOpenMissionCompletion(previous.current, marker)) setOpen(true);
    else if (marker.mode !== "mission" || marker.status !== "won") setOpen(false);
    previous.current = marker;
  }, [marker.mode, marker.status, marker.successEventId]);
  const seconds = (snapshot.mission.elapsedMs / 1000).toFixed(1);
  const retry = () => { setOpen(false); onRetry(); };
  const free = () => { setOpen(false); onFreePlay(); };
  const review = () => { leavingForReview.current = true; setOpen(false); onReview?.(); };
  return <>
    {won && <section className="bm-completion-banner" aria-label={l("복구 미션 완료 결과", "Recovery mission result", "復旧ミッション結果")}>
      <CheckCircle2 size={22} aria-hidden="true" /><div><h2>{l("복구 미션 완료!", "Recovery mission complete!", "復旧ミッション完了！")}</h2><p>{l(snapshot.mission.score + "점 · " + seconds + "초", snapshot.mission.score + " pts · " + seconds + "s", snapshot.mission.score + "点・" + seconds + "秒")}</p></div>
      <button type="button" ref={reviewButton} onClick={onReview ? review : () => setOpen(true)}>{onReview ? l("관찰·복기 작성", "Write observation and debrief", "観察・振り返りを書く") : l("결과 보기", "View result", "結果を見る")}</button><button type="button" onClick={retry}>{l("다시 도전", "Try again", "再挑戦")}</button>
    </section>}
    <Dialog open={open && won} onOpenChange={setOpen}>
      <DialogContent className="bm-completion-dialog" showCloseButton={false} onCloseAutoFocus={event => {
        event.preventDefault();
        if (leavingForReview.current) { leavingForReview.current = false; return; }
        requestAnimationFrame(() => { const target = reviewButton.current ?? document.getElementById("live-control-matching"); target?.focus(); });
      }}>
        <Trophy className="bm-trophy" size={42} aria-hidden="true" />
        <DialogHeader><DialogTitle>{l("복구 미션 완료!", "Recovery mission complete!", "復旧ミッション完了！")}</DialogTitle><DialogDescription>{l("공급·배기·RF의 반응을 살펴 공정값을 정상으로 되돌리고, 안정 상태를 5초 유지했어요.", "You observed the delivery, exhaust and RF responses, restored the process values, and held stability for five seconds.", "供給・排気・RFの反応を観察し、プロセス値を正常に戻して安定状態を5秒維持しました。")}</DialogDescription></DialogHeader>
        <dl className="bm-result-stats"><div><dt>{l("점수", "Score", "得点")}</dt><dd>{snapshot.mission.score}<small>{l("점", "pts", "点")}</small></dd></div><div><dt>{l("소요 시간", "Elapsed", "所要時間")}</dt><dd>{seconds}<small>{l("초", "s", "秒")}</small></dd></div><div><dt>{l("정상 유지", "Stable hold", "正常維持")}</dt><dd>5<small>{l("초", "s", "秒")}</small></dd></div></dl>
        <p className="bm-result-note">{l("관찰한 변화와 조치 이유를 적고, 조작 기록을 보며 복기해보세요.", "Record what changed and why you acted, then debrief using your activity timeline.", "観察した変化と対応理由を書き、操作記録を見て振り返りましょう。")}</p>
        <div className="bm-result-actions">
          {onReview ? <button type="button" className="bm-result-primary" onClick={review}>{l("관찰·복기 작성", "Write observation and debrief", "観察・振り返りを書く")}</button> : <button type="button" className="bm-result-primary" onClick={retry}><RotateCcw size={16} aria-hidden="true" />{l("다시 도전", "Try again", "再挑戦")}</button>}
          <button type="button" onClick={onReview ? retry : free}>{onReview ? l("다시 도전", "Try again", "再挑戦") : l("자유 체험 계속하기", "Continue free play", "自由体験を続ける")}</button>
          <button type="button" onClick={() => setOpen(false)}>{l("닫기 · 기록 보기", "Close · review timeline", "閉じて記録を見る")}</button>
        </div>
      </DialogContent>
    </Dialog>
  </>;
}
