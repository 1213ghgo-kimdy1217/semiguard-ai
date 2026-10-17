import React from "react";
import { edsObservation } from "../../../shared/edsObservation";
import { tr, type ProductLanguage } from "../lib/productLanguage";
import "./process-evidence-workspaces.css";

type Props = { time: number; observedUntil: number; language: ProductLanguage };
export default function EdsObservationWorkspace({ time, observedUntil, language }: Props) {
  const l = (ko: string, en: string, ja: string) => tr(language, ko, en, ja);
  const rows = edsObservation(time, observedUntil);
  const band = (value: "below" | "inside" | "above") => value === "inside"
    ? l("띠 안", "Inside band", "基準帯内") : value === "above"
      ? l("띠 위", "Above band", "基準帯より上") : l("띠 아래", "Below band", "基準帯より下");
  return <section className="pe-workspace" aria-label={l("EDS 구역 비교", "EDS region comparison", "EDS領域比較")}>
    <p className="et-eyebrow">COMPARE OBSERVED REGIONS</p>
    <h3>{l("어느 구역의 어떤 기록이 다른가요?", "Which record differs in which region?", "どの領域のどの記録が異なりますか？")}</h3>
    <p>{l("각 구역에서 현재 선택 시점까지 관측한 마지막 기록입니다. 같은 제조 시점의 지도나 개별 칩 결과가 아닙니다. 각 자료를 자신의 정상 참고와 비교하세요.", "These are the latest observed records per region through the selected position, not a same-time manufacturing map or individual die results. Compare each record with its own normal reference.", "選択時点までに観測した各領域の最後の記録です。同時点の製造マップや個別チップ結果ではありません。各資料を自身の正常参照と比較してください。")}</p>
    <div className="pe-evidence-cards">{rows.map(row => <article key={row.region}>
      <h4>{l("검사 구역", "Inspection region", "検査領域")} {row.region}</h4>
      <details><summary>{l("이 구역 기록 보기", "Inspect this region record", "この領域の記録を見る")} · {row.end}s</summary>
      <dl>{(["die", "comparison"] as const).map(signal => {
        const sample = row[signal];
        return <div key={signal}><dt>{signal === "die" ? l("칩 검사 편차 지수", "Die inspection deviation index", "チップ検査偏差指数") : l("검사 비교 지수", "Inspection comparison index", "検査比較指数")}</dt>
          <dd>{sample.value.toFixed(1)} · {band(signal === "die" ? row.dieBand : row.comparisonBand)}<br />
            {l("정상 참고", "Normal reference", "正常参照")} {sample.reference.toFixed(1)} · {sample.low.toFixed(1)}–{sample.high.toFixed(1)}</dd></div>;
      })}</dl></details>
    </article>)}</div>
    <p className="pe-check">{l("칩 결과의 차이와 검사 장비의 원인은 다른 주장입니다. 별도 비교 기록이 띠 안이어도 장비 원인을 확정하거나 배제할 수 없습니다.", "A difference in die results and an inspection-equipment cause are different claims. An inside-band comparison record neither confirms nor rules out an equipment cause.", "チップ結果の差と検査装置の原因は別の主張です。比較記録が帯内でも装置原因を確定・除外できません。")}</p>
    <p className="pe-scope">{l("교육용 가상 상대지수이며 불량 칩 수·수율이 아닙니다. 미관측 구역은 표시하지 않습니다. 구역 선택은 관찰용이며 답안·점수·계정 저장·이어하기·공유·AI 입력을 변경하지 않습니다.", "Synthetic teaching indices, not defective-die counts or yield. Unobserved regions are hidden. Region selection is view-only and does not change answers, scores, account saves, checkpoints, sharing or AI inputs.", "教育用仮想相対指数であり、不良チップ数・歩留まりではありません。未観測領域は表示しません。領域選択は観察用で、回答・点数・保存・再開・共有・AI入力を変更しません。")}</p>
  </section>;
}
