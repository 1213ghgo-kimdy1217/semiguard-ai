import React from "react";
import { tr, type ProductLanguage } from "../lib/productLanguage";
import { referenceBandPosition } from "../../../shared/inspectionEvidence";
import type { processSample } from "../../../shared/processScenarios";

type Props = { signal: "film" | "electrical"; sample: ReturnType<typeof processSample>; language: ProductLanguage };
/** Explanatory geometry and sampled indices are intentionally separate. */
export default function InspectionConceptRecord({ signal, sample, language }: Props) {
  const l = (ko: string, en: string, ja: string) => tr(language, ko, en, ja);
  const film = signal === "film";
  const band = referenceBandPosition(sample);
  const label = band === "inside" ? l("띠 안", "Inside band", "基準帯内") : band === "below" ? l("띠 아래", "Below band", "基準帯より下") : l("띠 위", "Above band", "基準帯より上");
  const x = (value: number) => 20 + (value - 80) * 5;
  return <figure style={{ margin: "1rem 0" }}>
    <svg viewBox="0 0 240 145" role="img" aria-label={film ? l("증착: 기판 표면의 막 형성 개념도", "Deposition: conceptual surface film", "成膜：基板表面の膜形成概念図") : l("이온 주입: 기판 내부의 이온 개념도", "Implantation: conceptual ions within substrate", "イオン注入：基板内部のイオン概念図")} style={{ width: "100%", height: "auto", display: "block" }}>
      <rect x="20" y="65" width="200" height="65" fill="#355768" stroke="#a5d5dc" />
      {film ? <g><rect x="20" y="50" width="200" height="15" fill="#e8c985" />{[55, 120, 185].map(cx => <path key={cx} d={`M${cx} 10V38l-5 -7m5 7l5 -7`} stroke="#e8c985" strokeWidth="2" fill="none" />)}</g> : <g>{[55, 120, 185].map((cx, index) => <g key={cx}><path d={`M${cx} 10V${80 + index % 2 * 12}l-5 -7m5 7l5 -7`} stroke="#a7d9cd" strokeWidth="2" fill="none" /><circle cx={cx} cy={92 + index % 2 * 12} r="5" fill="#a7d9cd" /></g>)}</g>}
    </svg>
    <figcaption>{l("설명용 구조 · 두께·깊이·입자 수는 측정값이 아님", "Concept only; thickness, depth and counts are not measured", "説明用構造。膜厚・深さ・粒子数は測定値ではありません")}</figcaption>
    <p><strong>{sample.time}s · {label}</strong></p>
    <svg viewBox="0 0 240 85" role="img" aria-label={`${sample.time}s: ${sample.value.toFixed(1)}; ${label}; ${sample.low.toFixed(1)}–${sample.high.toFixed(1)}`} style={{ width: "100%", height: "auto", display: "block" }}>
      <path d="M20 42H220" stroke="#91a49a" />
      <rect x={x(sample.low)} y="17" width={x(sample.high) - x(sample.low)} height="45" rx="5" fill="#315d50" stroke="#9ac4b2" />
      <path d={`M${x(sample.reference)} 10V68`} stroke="#fff" strokeDasharray="4 4" />
      <circle cx={x(sample.value)} cy="40" r="8" fill={band === "inside" ? "#9bd9c3" : "#ffc078"} />
      <text x="20" y="81" fill="#c0cfc3" fontSize="10">80</text><text x="204" y="81" fill="#c0cfc3" fontSize="10">120</text>
    </svg>
    <figcaption>{l("● 今回の記録", "● Current record", "● 今回の記録").replace("今回の記録", language === "ko" ? "이번 기록" : "今回の記録")} · {l("┆ 정상 참고　▰ 참고 띠 · 상대지수", "┆ Normal reference　▰ Reference band · relative index", "┆ 正常参照　▰ 基準帯・相対指数")}</figcaption>
  </figure>;
}
