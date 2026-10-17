import React from "react";
import { tr, type ProductLanguage } from "../lib/productLanguage";
import { referenceBandPosition } from "../../../shared/inspectionEvidence";
import type { processSample } from "../../../shared/processScenarios";

type Props = { signal: "film" | "electrical"; sample: ReturnType<typeof processSample>; language: ProductLanguage };
/** Geometry explains the process; only the gauge represents the supplied selected record. */
export default function InspectionConceptRecord({ signal, sample, language }: Props) {
  const l = (ko: string, en: string, ja: string) => tr(language, ko, en, ja);
  const film = signal === "film";
  const name = film ? l("막 검사", "Film inspection", "膜検査") : l("별도 전기적 검사", "Separate electrical inspection", "別の電気的検査");
  const band = referenceBandPosition(sample);
  const label = band === "inside" ? l("띠 안", "Inside band", "基準帯内") : band === "below" ? l("띠 아래", "Below band", "基準帯より下") : l("띠 위", "Above band", "基準帯より上");
  const x = (value: number) => 20 + (value - 80) * 5;
  return <figure style={{ margin: "1rem 0" }}>
    <svg viewBox="0 0 240 145" role="img" aria-label={film ? l("증착: 기판 표면의 막 형성 개념도", "Deposition: conceptual surface film", "成膜：基板表面の膜形成概念図") : l("이온 주입: 기판 내부의 이온 개념도", "Implantation: conceptual ions within substrate", "イオン注入：基板内部のイオン概念図")} style={{ width: "100%", height: "auto", display: "block" }}>
      <rect x="20" y="65" width="200" height="65" fill="#355768" stroke="#a5d5dc" />
      {film ? <g><rect x="20" y="50" width="200" height="15" fill="#e8c985" />{[55, 120, 185].map(cx => <path key={cx} d={`M${cx} 10V38l-5 -7m5 7l5 -7`} stroke="#e8c985" strokeWidth="2" fill="none" />)}</g> : <g>{[55, 120, 185].map((cx, index) => <g key={cx}><path d={`M${cx} 10V${80 + index % 2 * 12}l-5 -7m5 7l5 -7`} stroke="#a7d9cd" strokeWidth="2" fill="none" /><circle cx={cx} cy={92 + index % 2 * 12} r="5" fill="#a7d9cd" /></g>)}</g>}
    </svg>
    <figcaption>{film ? l("표면에 막 형성 · 설명용 구조", "Surface film formation · concept only", "表面の膜形成・説明用構造") : l("기판 내부에 이온 도입 · 설명용 구조", "Ions introduced into substrate · concept only", "基板内部へイオン導入・説明用構造")}</figcaption>
    <p><strong>{name} · {sample.time}s · {label}</strong></p>
    <svg viewBox="0 0 240 85" role="img" aria-label={`${name}: ${sample.time}s; ${sample.value.toFixed(1)}; ${label}; ${l("정상 참고", "Normal reference", "正常参照")} ${sample.reference.toFixed(1)}; ${sample.low.toFixed(1)}–${sample.high.toFixed(1)}`} style={{ width: "100%", height: "auto", display: "block" }}>
      <path d="M20 42H220" stroke="#91a49a" />
      <rect x={x(sample.low)} y="17" width={x(sample.high) - x(sample.low)} height="45" rx="5" fill="#315d50" stroke="#9ac4b2" />
      <path d={`M${x(sample.reference)} 10V68`} stroke="#fff" strokeDasharray="4 4" />
      <circle cx={x(sample.value)} cy="40" r="8" fill={band === "inside" ? "#9bd9c3" : "#ffc078"} />
      <text x="20" y="81" fill="#c0cfc3" fontSize="10">80</text><text x="204" y="81" fill="#c0cfc3" fontSize="10">120</text>
    </svg>
    <figcaption>{l("● 이번 기록　┆ 정상 참고　▰ 참고 띠 · 상대지수", "● Current record　┆ Normal reference　▰ Reference band · relative index", "● 今回の記録　┆ 正常参照　▰ 基準帯・相対指数")}</figcaption>
    <details><summary>{l("이 그림으로 알 수 없는 것", "What this diagram cannot establish", "この図から分からないこと")}</summary>
      <p>{l("그림의 두께·깊이·입자 수는 측정값이 아닙니다.", "Diagram thickness, depth and counts are not measured.", "図の膜厚・深さ・粒子数は測定値ではありません。")}</p>
      <p>{film ? l("막 검사 지수의 편차를 보여줄 뿐, 실제 막 두께·조성이나 장비 원인을 확정하지 않습니다.", "A film inspection index deviation does not establish physical film thickness, composition or an equipment cause.", "膜検査指数の偏差は実際の膜厚・組成・装置原因を確定しません。") : l("이 전기적 기록이 띠 안이어도 별도 막 검사 결과를 정상으로 바꾸거나 이온 주입량·깊이·장비 원인을 확정하지 않습니다.", "An electrical record inside its band neither makes the separate film result normal nor establishes implantation dose, depth or an equipment cause.", "電気的記録が帯内でも、別の膜検査結果を正常にしたり注入量・深さ・装置原因を確定したりはしません。")}</p>
    </details>
  </figure>;
}
