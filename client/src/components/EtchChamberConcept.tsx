import React, { useState } from "react";
import { etchEvidence, type EtchSignal } from "../../../shared/etchScenario";
import { etchSignalName } from "../lib/etchLanguage";
import { tr, type ProductLanguage } from "../lib/productLanguage";
import "./process-concepts.css";

export default function EtchChamberConcept({ time, observedUntil, language, signal, onSignalChange }: { time: number; observedUntil: number; language: ProductLanguage; signal?: EtchSignal; onSignalChange?: (signal: EtchSignal) => void }) {
  const [localSelected, setLocalSelected] = useState<EtchSignal>("pressure");
  const selected = signal ?? localSelected;
  const setSelected = (next: EtchSignal) => { setLocalSelected(next); onSignalChange?.(next); };
  const rows = etchEvidence(time, observedUntil);
  const record = rows.find(row => row.id === selected)!;
  const l = (ko: string, en: string, ja: string) => tr(language, ko, en, ja);
  const points = { pressure: [310, 115], flow: [195, 30], rf: [65, 185], temperature: [335, 190] } as const;
  const [x, y] = points[selected];
  return <section className="pc-view" aria-label={l("식각 챔버 관측 위치", "Etch chamber observation locations", "エッチングチャンバー観測位置")}>
    <h3>{l("어디의 기록을 보고 있나요?", "Where does this record belong?", "どの位置の記録ですか？")}</h3>
    <div className="pc-controls" role="group" aria-label={l("관측 위치 선택", "Choose observation location", "観測位置を選択")}>
      {rows.map(row => <button key={row.id} type="button" aria-pressed={selected === row.id} onClick={() => setSelected(row.id)}>{etchSignalName(language, row.id)}</button>)}
    </div>
    <div className="pc-layout"><figure>
      <svg viewBox="0 0 400 260" role="img" aria-label={`${etchSignalName(language, selected)}: ${l("개념적 관측 위치", "conceptual observation location", "概念的観測位置")}`}>
        <rect x="80" y="65" width="240" height="150" rx="24" fill="#263e45" stroke="#a5d5dc" strokeWidth="3" />
        <path d="M195 10V65M320 120H380M20 185H80" stroke="#a5d5dc" strokeWidth="5" />
        <ellipse cx="200" cy="132" rx="83" ry="24" fill="#75699e" opacity=".6" />
        <rect x="120" y="174" width="160" height="9" fill="#e8c985" /><rect x="110" y="183" width="180" height="14" fill="#6c8790" />
        <circle cx={x} cy={y} r="14" fill="none" stroke="#ffc078" strokeWidth="4" />
      </svg>
      <figcaption>{l("일반적 플라즈마 챔버 개념도 · 표시는 관측 위치이며 고장 위치가 아닙니다. 식각 깊이·플라즈마 상태를 측정해 그린 것이 아닙니다.", "Generic plasma chamber concept. Highlight is an observation location, not a fault. It does not encode measured etch depth or plasma condition.", "一般的なプラズマチャンバー概念図。強調は観測位置で故障箇所ではありません。実測の深さ・プラズマ状態は示しません。")}</figcaption>
    </figure><div>
      <h4>{etchSignalName(language, selected)} · {record.time}s · {l("단계", "Phase", "段階")} {record.phase}</h4>
      <dl><div><dt>{l("이번 / 같은 단계 정상 참고", "Current / same-phase reference", "今回 / 同段階の正常参照")}</dt><dd>{record.value.toFixed(1)} / {record.reference.toFixed(1)}</dd></div><div><dt>{l("이 단계의 참고 띠", "This phase's reference band", "この段階の基準帯")}</dt><dd>{record.low}–{record.high} · {record.value >= record.low && record.value <= record.high ? l("띠 안", "Inside band", "基準帯内") : l("띠 밖", "Outside band", "基準帯外")}</dd></div></dl>
      <p>{l("다른 단계의 값이 아니라 같은 단계의 기준과 비교하세요. 한 신호만으로 특정 부품의 고장을 확정하지 않습니다.", "Compare against the same phase, not another phase's values. One signal does not establish a component fault.", "別段階の値ではなく同段階の基準と比較してください。一信号で部品故障は確定しません。")}</p>
    </div></div>
    <p className="pc-limit">{onSignalChange ? l("위치와 그래프가 함께 바뀝니다. 선택하면 재생을 멈추며 답안·저장·AI 입력은 바꾸지 않습니다.", "Location and chart change together. Selection pauses playback without changing answers, saves or AI input.", "位置とグラフが連動します。選択すると再生が止まりますが回答・保存・AI入力は変更しません。") : l("위치 선택은 이 그림만 바꿉니다.", "Location selection changes only this view.", "位置選択はこの図のみ変更します。")}{" "}{l("온도는 챔버 주변 가상 기록이며 웨이퍼 실측 온도가 아닙니다.", "Temperature is a synthetic chamber-surroundings record, not measured wafer temperature.", "温度はチャンバー周囲の仮想記録でウェーハ実測温度ではありません。")}</p>
  </section>;
}
