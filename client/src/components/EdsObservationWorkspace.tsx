import React, { useState } from "react";
import RecordBand from "./RecordBand";
import { edsObservation } from "../../../shared/edsObservation";
import { tr, type ProductLanguage } from "../lib/productLanguage";
import "./process-evidence-workspaces.css";
import "./eds-observation.css";

type Props = { time: number; observedUntil: number; language: ProductLanguage; onInteraction?: () => void };
export default function EdsObservationWorkspace({ time, observedUntil, language, onInteraction }: Props) {
  const l = (ko: string, en: string, ja: string) => tr(language, ko, en, ja);
  const rows = edsObservation(time, observedUntil);
  const [region, setRegion] = useState("A");
  // Clamp viewing selection after rewind. No answer or persistent state changes.
  const selected = rows.find(row => row.region === region) ?? rows[rows.length - 1];
  const selectedIndex = ["A", "B", "C"].indexOf(selected.region);
  const band = (state: "below" | "inside" | "above") => state === "inside" ? l("띠 안", "Inside band", "基準帯内") : state === "above" ? l("띠 위", "Above band", "基準帯より上") : l("띠 아래", "Below band", "基準帯より下");
  const cells = Array.from({ length: 9 }, (_, y) => Array.from({ length: 9 }, (_, x) => ({ x, y }))).flat().filter(({ x, y }) => Math.hypot(x - 4, y - 4) < 4.4);
  return <section className="pe-workspace eds-explorer" aria-label={l("EDS 구역 비교", "EDS region comparison", "EDS領域比較")}>
    <p className="et-eyebrow">COMPARE OBSERVED REGIONS</p>
    <h3>{l("웨이퍼의 어느 검사 구역이 다른가요?", "Which inspection region differs?", "どの検査領域が異なりますか？")}</h3>
    <p>{l("웨이퍼 상태에서 칩의 전기적 특성을 검사하는 EDS 공정 개념도입니다. 구역을 선택해 기존 검사 기록을 비교하세요.", "EDS checks die electrical characteristics at wafer level. Select a region to compare the existing inspection records.", "EDSはウェーハ状態でチップの電気特性を検査します。領域を選び既存の検査記録を比較してください。")}</p>
    <div className="eds-process-layout"><figure>
      <svg viewBox="0 0 320 320" role="img" aria-label={l(`가상 웨이퍼 구역 ${selected.region} 선택`, `Illustrative wafer region ${selected.region} selected`, `仮想ウェーハ領域${selected.region}を選択`)}>
        <circle cx="160" cy="155" r="143" fill="#263e45" stroke="#a5d5dc" strokeWidth="3" />
        {cells.map(({ x, y }) => {
          const index = x < 3 ? 0 : x < 6 ? 1 : 2;
          const observed = rows.some(row => row.region === ["A", "B", "C"][index]);
          return <rect key={`${x}:${y}`} x={40 + x * 27} y={35 + y * 27} width="23" height="23" rx="2" fill={!observed ? "#17251f" : index === selectedIndex ? "#74c7c1" : "#476875"} stroke={index === selectedIndex ? "#fff0ca" : "#7d9aa2"} opacity={observed ? 1 : .35} />;
        })}
        <path d="M146 298L160 285L174 298" fill="#101a16" stroke="#a5d5dc" />
        {["A", "B", "C"].map((name, index) => <text key={name} x={65 + index * 82} y="315" fill="#e8f2ec" fontSize="16">{name}</text>)}
      </svg>
      <figcaption>{l("구역 위치·칩 격자는 설명용", "Illustrative region positions and grid", "領域位置・格子は説明用")}</figcaption>
      <div className="eds-region-controls" role="group" aria-label={l("검사 구역 선택", "Select inspection region", "検査領域を選択")}>
        {["A", "B", "C"].map(name => <button key={name} type="button" disabled={!rows.some(row => row.region === name)} aria-pressed={selected.region === name} onClick={() => { onInteraction?.(); setRegion(name); }}>{name}{!rows.some(row => row.region === name) ? l(" · 미관측", " · unobserved", "・未観測") : ""}</button>)}
      </div>
    </figure><figure>
      <h4>{l("선택 구역 확대", "Selected region close-up", "選択領域の拡大")} · {selected.region}</h4>
      <svg viewBox="0 0 380 260" role="img" aria-label={l("칩 접촉 패드와 프로브 바늘의 개념도", "Conceptual die contact pads and probe needles", "チップ接触パッドとプローブ針の概念図")}>
        <rect x="20" y="20" width="340" height="30" rx="6" fill="#536a70" />
        <text x="140" y="40" fill="#fff" fontSize="14">{l("프로브 카드", "Probe card", "プローブカード")}</text>
        <rect x="55" y="147" width="270" height="90" rx="8" fill="#355768" stroke="#95c8db" strokeWidth="2" />
        <rect x="125" y="170" width="130" height="45" rx="4" fill="#213c46" stroke="#719fa6" />
        {[90, 155, 220, 285].map(x => <g key={x}><rect x={x - 10} y="149" width="20" height="13" fill="#f5d589" /><path d={`M${x - 30} 50L${x - 15} 115L${x} 149`} fill="none" stroke="#dbe9eb" strokeWidth="4" /></g>)}
        <text x="142" y="198" fill="#e9f0ea" fontSize="14">{l("칩 · 전기 검사", "Die · electrical test", "チップ・電気検査")}</text>
      </svg>
      <figcaption>{l("접촉 구조만 설명합니다. 실제 검사 동작·측정값·장비 상태가 아닙니다.", "Contact concept only, not actual test motion, measurements or equipment condition.", "接触構造の説明であり、実検査動作・測定値・装置状態ではありません。")}</figcaption>
      <p aria-live="polite">{l("선택 구역의 칩 / 별도 비교 기록", "Selected region die / separate comparison", "選択領域のチップ / 別の比較記録")}: {band(selected.dieBand)} / {band(selected.comparisonBand)}</p>
      <div className="studio-two"><RecordBand sample={selected.die} title={l(`구역 ${selected.region} · 칩 검사`, `Region ${selected.region} · die inspection`, `領域${selected.region}・チップ検査`)} language={language} /><RecordBand sample={selected.comparison} title={l(`구역 ${selected.region} · 별도 비교`, `Region ${selected.region} · separate comparison`, `領域${selected.region}・別の比較`)} language={language} /></div>
    </figure></div>
    <div className="pe-evidence-cards">{rows.map(row => <article key={row.region} aria-current={row.region === selected.region ? "true" : undefined}>
      <h4>{l("검사 구역", "Inspection region", "検査領域")} {row.region} · {row.end}s</h4>
      <p>{l("칩 검사 / 별도 비교", "Die / separate comparison", "チップ検査 / 別の比較")}: {band(row.dieBand)} / {band(row.comparisonBand)}</p>
      <details><summary>{l("상세 근거 보기", "Inspect exact evidence", "詳細根拠を見る")}</summary>
        {(["die", "comparison"] as const).map(signal => <p key={signal}>{signal === "die" ? l("칩 검사 편차 지수", "Die inspection deviation index", "チップ検査偏差指数") : l("검사 비교 지수", "Inspection comparison index", "検査比較指数")} {row[signal].value.toFixed(1)}<br />{l("정상 참고", "Normal reference", "正常参照")} {row[signal].reference.toFixed(1)} · {row[signal].low.toFixed(1)}–{row[signal].high.toFixed(1)}</p>)}
      </details>
    </article>)}</div>
    <p className="pe-check">{l("칩 결과의 차이와 검사 장비의 원인은 다른 주장입니다. 별도 비교 기록이 띠 안이어도 장비 원인을 확정하거나 배제할 수 없습니다.", "A difference in die results and an inspection-equipment cause are different claims. An inside-band comparison record neither confirms nor rules out an equipment cause.", "チップ結果の差と検査装置の原因は別の主張です。比較記録が帯内でも装置原因を確定・除外できません。")}</p>
    <p className="pe-scope">{l("교육용 가상 구역 요약 지수입니다. 개별 칩 판정·불량 수·수율·실제 웨이퍼 배치가 아닙니다. 미관측 결과는 숨깁니다. 구역 선택은 관찰용이며 답안·점수·저장·이어하기·공유·AI 입력을 변경하지 않습니다.", "Synthetic region-summary indices, not a same-time manufacturing map or individual die results, failure counts or yield. Unobserved results are hidden. Selection is view-only; answers, scores, saves, resume, sharing and AI inputs are unchanged.", "教育用仮想領域要約指数であり、個別チップ判定・不良数・歩留まり・実ウェーハ配置ではありません。未観測結果は非表示です。選択は観察用で回答・点数・保存・再開・共有・AI入力を変更しません。")}</p>
  </section>;
}
