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

export function BoothNormalGuide({ snapshot, language, onRecommended, disabled = false }: Props & { onRecommended(): void; disabled?: boolean }) {
  const l = (ko: string, en: string, ja: string) => tr(language, ko, en, ja);
  const stage = recoveryGuideStage(snapshot);
  const messages = {
    normal: l("4개 항목 정상", "All four values normal", "4項目が正常"),
    abnormal: l("빨간 항목을 목표값에 맞춰요", "Bring red values toward their targets", "赤い項目を目標値に合わせましょう"),
    matching: l("수치는 정상 · RF 매칭을 안정화해요", "Values normal · stabilize RF matching", "数値は正常・RFマッチングを安定化"),
    holding: l("정상 유지 중 · 조절을 멈추고 기다려요", "Holding normal · keep controls steady", "正常維持中・設定を動かさず待ちましょう"),
    complete: l("정상 5초 유지 완료", "Five seconds of normal operation complete", "正常状態を5秒維持しました"),
  };
  return <section className="bm-normal-guide" aria-labelledby="live-normal-guide-heading">
    <div className="bm-guide-heading"><h3 id="live-normal-guide-heading">{l("어디까지 맞추면 정상인가요?", "What counts as normal?", "どこまで合わせると正常？")}</h3><span>{l("교육용 기준", "Training reference", "教育用の基準")}</span></div>
    <p className={`bm-guide-stage ${stage === "abnormal" ? "is-alarm" : ""}`}>{messages[stage]}</p>
    <table>
      <thead><tr><th scope="col">{l("항목", "Quantity", "項目")}</th><th scope="col">{l("현재", "Current", "現在")}</th><th scope="col">{l("목표 · 정상 범위", "Target · normal range", "目標・正常範囲")}</th></tr></thead>
      <tbody>{BOOTH_SIGNALS.map(signal => {
        const alarm = snapshot.alarms[signal.key];
        const recovery = BOOTH_RECOVERY_RANGES[signal.key];
        return <tr key={signal.key} data-alarm={String(alarm)}>
          <th scope="row"><span>{signal.number}</span> {l(...names[signal.key])}</th>
          <td><strong className="bm-current-value">{numberText(signal.key, snapshot.values[signal.key])}</strong><small>{signal.unit}</small><span className="bm-value-status">{alarm ? l("복구 필요", "Recover", "復旧が必要") : l("정상", "Normal", "正常")}</span></td>
          <td><strong>{signal.target} <small>{signal.unit}</small></strong><span>{signal.normal[0]}–{signal.normal[1]} {signal.unit}</span>{alarm && <small className="bm-recovery-band">{l("복구 확인", "Recovery band", "復旧確認")} {recovery[0]}–{recovery[1]}</small>}</td>
        </tr>;
      })}</tbody>
    </table>
    <p className="bm-guide-note">{l(`빨간 값은 복구 확인 범위에서 ${BOOTH_ALARM_CLEAR_MS / 1000}초 유지되면 흰색으로 돌아와요.`, `Red values return to white after ${BOOTH_ALARM_CLEAR_MS / 1000}s in the recovery band.`, `赤い値は復旧確認範囲を${BOOTH_ALARM_CLEAR_MS / 1000}秒維持すると白に戻ります。`)}</p>
    {snapshot.mode === "mission" && <><div className="bm-matching-status" data-stable={String(snapshot.matchingQuality >= BOOTH_MIN_STABLE_MATCH_QUALITY)}><span>{l("매칭 안정도 · 모의", "Matching stability · simulated", "マッチング安定度・模擬")}</span><strong>{matchingQualityPercent(snapshot.matchingQuality)}%</strong><small>{snapshot.matchingQuality >= BOOTH_MIN_STABLE_MATCH_QUALITY ? l("안정", "Stable", "安定") : l("조정 필요", "Adjust", "調整が必要")} · {l(`정상 ${Math.round(BOOTH_MIN_STABLE_MATCH_QUALITY * 100)}% 이상`, `Normal ≥ ${Math.round(BOOTH_MIN_STABLE_MATCH_QUALITY * 100)}%`, `正常${Math.round(BOOTH_MIN_STABLE_MATCH_QUALITY * 100)}%以上`)}</small></div><p className="bm-guide-rule">{l("미션 완료: ①–④ 모두 흰색 + RF 매칭 안정 → 5초 연속 유지. 다시 불안정해지면 유지 시간이 0초부터 시작돼요.", "Complete: all four values white and RF matching stable for five continuous seconds. Instability restarts the hold timer.", "完了条件：①〜④が白・RFマッチング安定の状態を5秒連続で維持。不安定になると維持時間は0秒に戻ります。")}</p></>}
    <div className="bm-recommended"><p>{l("기본 운전값: RF 500 W · 유량 100 sccm · 배기 50%", "Starting settings: RF 500 W · flow 100 sccm · exhaust 50%", "基本設定：RF 500 W・流量100 sccm・排気50%")}</p><button type="button" onClick={onRecommended} disabled={disabled}>{l("기본 운전값 맞추기", "Use starting settings", "基本設定に合わせる")}</button></div>
    <p className="bm-guide-note">{l("RF 매칭은 50%에 고정하는 값이 아니에요. 조금씩 조절해 ③ RF가 500 W에 가까워지고 빛이 안정되는 위치를 찾아요. 온도는 다른 값보다 천천히 따라와요.", "RF matching is not fixed at 50%. Adjust gradually toward RF near 500 W and a steady light. Temperature responds more slowly.", "RFマッチングは50%固定ではありません。③RFが500 Wに近づき光が安定する位置を探します。温度はゆっくり変化します。")}</p>
  </section>;
}

export default function BoothMissionFeedback({ snapshot, language, onRetry, onFreePlay }: Props & { onRetry(): void; onFreePlay(): void }) {
  const l = (ko: string, en: string, ja: string) => tr(language, ko, en, ja);
  const [open, setOpen] = useState(false);
  const previous = useRef<MissionFeedbackMarker | null>(null);
  const reviewButton = useRef<HTMLButtonElement>(null);
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
  return <>
    {won && <section className="bm-completion-banner" aria-label={l("복구 미션 완료 결과", "Recovery mission result", "復旧ミッション結果")}>
      <CheckCircle2 size={28} aria-hidden="true" /><div><h2>{l("복구 미션 완료!", "Recovery mission complete!", "復旧ミッション完了！")}</h2><p>{l(`정상 상태를 5초 유지했어요. ${snapshot.mission.score}점 · ${seconds}초`, `Normal operation held for five seconds. Score ${snapshot.mission.score} · ${seconds}s`, `正常状態を5秒維持しました。${snapshot.mission.score}点・${seconds}秒`)}</p></div><button type="button" ref={reviewButton} onClick={() => setOpen(true)}>{l("완료 결과 보기", "View result", "結果を見る")}</button><button type="button" onClick={retry}>{l("다시 도전", "Try again", "再挑戦")}</button></section>}
    <Dialog open={open && won} onOpenChange={setOpen}>
      <DialogContent className="bm-completion-dialog" showCloseButton={false} onCloseAutoFocus={event => {
        event.preventDefault();
        requestAnimationFrame(() => {
          const target = reviewButton.current ?? document.getElementById("live-control-matching");
          target?.focus();
        });
      }}>
        <Trophy className="bm-trophy" size={42} aria-hidden="true" />
        <DialogHeader><DialogTitle>{l("복구 미션 완료!", "Recovery mission complete!", "復旧ミッション完了！")}</DialogTitle><DialogDescription>{l("불안정한 RF를 조절해 네 가지 값을 정상으로 되돌리고, 안정 상태를 5초 동안 유지했어요.", "You recovered the unstable RF, returned all four values to normal, and held a stable state for five seconds.", "不安定なRFを調整して4項目を正常に戻し、安定状態を5秒間維持しました。")}</DialogDescription></DialogHeader>
        <dl className="bm-result-stats"><div><dt>{l("점수", "Score", "得点")}</dt><dd>{snapshot.mission.score}<small>{l("점", "pts", "点")}</small></dd></div><div><dt>{l("소요 시간", "Elapsed", "所要時間")}</dt><dd>{seconds}<small>{l("초", "s", "秒")}</small></dd></div><div><dt>{l("정상 유지", "Stable hold", "正常維持")}</dt><dd>5<small>{l("초", "s", "秒")}</small></dd></div></dl>
        <p className="bm-result-note">{l("아래 타임라인에 조작과 복구 과정이 자동으로 남았어요.", "Your actions and recovery remain in the timeline below.", "下のタイムラインに操作と復旧の過程が記録されています。")}</p>
        <div className="bm-result-actions"><button type="button" className="bm-result-primary" onClick={retry}><RotateCcw size={16} aria-hidden="true" />{l("다시 도전", "Try again", "再挑戦")}</button><button type="button" onClick={free}>{l("자유 체험 계속하기", "Continue free play", "自由体験を続ける")}</button><button type="button" onClick={() => setOpen(false)}>{l("닫기 · 기록 보기", "Close · review timeline", "閉じて記録を見る")}</button></div>
      </DialogContent>
    </Dialog>
  </>;
}
