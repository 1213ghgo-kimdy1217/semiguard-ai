import React, { useState } from "react";
import RecordBand from "./RecordBand";
import { getProcessScenario, processSamples } from "../../../shared/processScenarios";
import { tr, type ProductLanguage } from "../lib/productLanguage";
import "./packaging-observation.css";

const scenario = getProcessScenario("packaging")!;
/** Only observed authored samples; the drawing is not a fault diagnosis. */
export function packagingObservation(time: number) {
  const records = processSamples(scenario, "connection", time);
  const outside = records.findIndex(record => record.value < record.low || record.value > record.high);
  const returned = outside < 0 ? undefined : records.slice(outside + 1).find(record => record.value >= record.low && record.value <= record.high);
  return { records, outside: outside < 0 ? undefined : records[outside], returned };
}
export default function PackagingObservationWorkspace({ time, language, signal, onSignalChange, onInteraction }: { time: number; language: ProductLanguage; signal?: "connection" | "appearance"; onSignalChange?: (signal: "connection" | "appearance") => void; onInteraction?: () => void }) {
  const l = (ko: string, en: string, ja: string) => tr(language, ko, en, ja);
  const view = packagingObservation(time);
  const [localSignal, setLocalSignal] = useState<"connection" | "appearance">("connection");
  const selectedSignal = signal ?? localSignal;
  const selectedRecords = processSamples(scenario, selectedSignal, time);
  const current = selectedRecords[selectedRecords.length - 1];
  const [pinned, setPinned] = useState(0);
  const earlier = selectedRecords[Math.min(pinned, current.time)];
  const inspection = selectedSignal === "connection" ? l("연결", "Connection", "接続") : l("외관", "Appearance", "外観");
  return <section className="pk-workspace" aria-label={l("패키징 연결 기록 비교", "Packaging connection comparison", "パッケージング接続記録比較")}>
    <h3>{l("연결 기록이 돌아오면, 무엇까지 말할 수 있나요?", "What does a returning connection record establish?", "接続記録が戻ると何が言えますか？")}</h3>
    <div className="pc-controls" role="group" aria-label={l("패키징 검사 관점", "Packaging inspection perspective", "パッケージング検査観点")}>{(["connection", "appearance"] as const).map(next => <button type="button" key={next} aria-pressed={selectedSignal === next} onClick={() => { onInteraction?.(); setLocalSignal(next); onSignalChange?.(next); }}>{next === "connection" ? l("연결 기록", "Connection record", "接続記録") : l("외관 기록", "Appearance record", "外観記録")}</button>)}</div>
    <div className="pk-layout"><figure>
      <svg viewBox="0 0 380 240" role="img" aria-label={l("칩·본딩 와이어·기판의 패키지 단면 개념도", "Conceptual package cross-section: die, bond wires and substrate", "チップ・ボンディングワイヤ・基板のパッケージ断面概念図")}>
        <rect x="30" y="30" width="320" height="140" rx="22" fill="#263e45" stroke="#9fc4c8" strokeDasharray="6 4" />
        <rect x="25" y="170" width="330" height="25" rx="4" fill="#43635a" />
        <rect x="120" y="115" width="140" height="55" rx="4" fill="#355768" stroke="#a5d5dc" />
        <path d="M65 170Q75 65 135 115M245 115Q305 65 315 170" fill="none" stroke="#f5d589" strokeWidth={selectedSignal === "connection" ? 6 : 3} />
        {selectedSignal === "appearance" ? <path d="M45 30H335" stroke="#fff0ca" strokeWidth="6" strokeDasharray="8 5" /> : null}
        {[60, 110, 160, 210, 260, 310].map(x => <circle key={x} cx={x} cy="210" r="10" fill="#aebdc2" />)}
        <text x="157" y="145" fill="#fff" fontSize="15">{l("칩", "Die", "チップ")}</text>
        <text x="118" y="70" fill="#f5d589" fontSize="14">{l("본딩 와이어 예시", "Example bond wires", "ボンディングワイヤ例")}</text>
      </svg>
      <figcaption>{l("본딩 방식의 한 가지 개념 예시입니다. 실제 검사 영상이 아니며, 기록이 달라져도 단선·수리를 그려 넣지 않습니다.", "One conceptual wire-bonded example, not an inspection image. Record changes do not depict broken wires or repairs.", "ワイヤボンディング方式の概念例であり検査画像ではありません。記録が変わっても断線・修理を描きません。")}</figcaption>
    </figure><div>
      <label>{l("관측한 비교 시점 고정", "Pin an observed comparison time", "観測済み比較時点を固定")} · {earlier.time}s
        <input type="range" min={0} max={current.time} step={1} value={earlier.time} onChange={event => { onInteraction?.(); setPinned(Number(event.target.value)); }} />
      </label>
      <div className="studio-two"><RecordBand sample={earlier} title={`${inspection} · ${l("고정한 기록", "Pinned record", "固定記録")}`} language={language} /><RecordBand sample={current} title={`${inspection} · ${l("현재 선택 기록", "Selected record", "選択記録")}`} language={language} /></div>
      <p>{l("구조의 강조는 검사 관점이며, 기록은 교육용 상대지수입니다.", "Structure highlights an inspection perspective; records are teaching-only relative indices.", "構造の強調は検査観点で、記録は教育用相対指数です。")}</p>
    </div></div>
    <details><summary>{l("지금까지의 띠 이탈·복귀 기록 확인", "Inspect band exits and returns observed so far", "ここまでの基準帯逸脱・復帰を確認")}</summary>
      <p>{l("연결 기록 기준 · 외관 선택과 별도로 유지됩니다.", "Connection evidence, preserved independently of the appearance view.", "接続記録に基づき、外観選択とは別に保持します。")}</p>
      <p>{view.outside ? l(`첫 띠 이탈: ${view.outside.time}s`, `First band exit: ${view.outside.time}s`, `最初の帯外記録：${view.outside.time}s`) : l("아직 띠 이탈 기록 없음", "No band exit observed yet", "帯外記録はまだありません")}</p>
      <p>{view.returned ? l(`첫 띠 안 복귀: ${view.returned.time}s`, `First return inside: ${view.returned.time}s`, `最初の帯内復帰：${view.returned.time}s`) : l("이탈 뒤 띠 안 복귀는 아직 관측되지 않음", "A return inside after an exit has not yet been observed", "逸脱後の帯内復帰はまだ観測されていません")}</p>
    </details>
    <p>{l("추세 변화 시작과 띠 이탈은 다릅니다. 참고값 쪽으로 움직여도 아직 띠 밖일 수 있습니다. 연결·외관을 각각 자기 기준과 비교하세요. 띠 안 복귀는 실제 원인 해결의 증거가 아닙니다.", "Trend onset differs from band exit; a record returning toward the reference can still be outside. Compare connection and appearance with their own references. A return inside is not proof of cause resolution.", "傾向変化の開始と帯逸脱は異なり、参考値へ戻る途中でも帯外の場合があります。接続・外観をそれぞれの基準と比較してください。帯内復帰は原因解決の証拠ではありません。")}</p>
    <p className="pk-limit">{l("교육용 가상 기록", "Synthetic teaching records", "教育用の仮想記録")} · {l("미관측 결과는 숨깁니다. 시점 고정은 관찰용이며 답안·채점·저장·이어하기·공유·AI 입력을 변경하지 않습니다.", "Unobserved results are hidden. Pinning is view-only, not an answer, score, save, resume, share or AI input.", "未観測結果は表示しません。時点固定は観察用で回答・採点・保存・再開・共有・AI入力を変更しません。")}</p>
  </section>;
}
