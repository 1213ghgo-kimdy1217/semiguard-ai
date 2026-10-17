import React, { useId } from "react";
import { tr, type ProductLanguage } from "../lib/productLanguage";
import { waferInspectionComparison, waferInspectionSample, waferRegions, WAFER_TRACE_REGION,
  type WaferInspectionSignal, type WaferRegion } from "../../../shared/waferInspection";
import "./wafer-inspection.css";

type LanguageProps = { language: ProductLanguage };
const signed = (value: number) => `${value >= 0 ? "+" : ""}${value.toFixed(1)}`;
const tone = (value: number) => value < 96 ? "low" : value >= 110 ? "high" : value >= 104 ? "mid" : "base";

export function WaferInspectionBrief({ language }: LanguageProps) {
  const l = (ko: string, en: string, ja: string) => tr(language, ko, en, ja);
  return <section className="et-panel wi-intro">
    <svg viewBox="0 0 120 120" aria-hidden="true" focusable="false">
      <circle cx="60" cy="60" r="54" fill="#203b30" stroke="currentColor" strokeWidth="2" />
      {waferRegions.map((region, index) => <rect key={region} x={27 + index % 3 * 25} y={27 + Math.floor(index / 3) * 25} width="17" height="17" rx="3" fill="#91cfc2" opacity=".65" />)}
    </svg>
    <div><p className="et-eyebrow">WAFER INSPECTION / LOCATION FIRST</p>
      <h2>{l("이번에는 그래프보다 위치부터 살펴보세요.", "Start with locations, not just a graph.", "今回はグラフだけでなく、位置から確認しましょう。")}</h2>
      <ol><li>{l("9개 구역의 정상 참고와 이번 검사 지도를 나란히 봅니다.", "Compare reference and current maps across nine regions.", "9区画の正常参照と今回の検査マップを並べて見ます。")}</li>
        <li>{l("구역을 눌러 같은 위치의 표면·두께 기록을 비교합니다.", "Select a region to compare its surface and thickness evidence.", "区画を選び、同じ位置の表面・厚さ記録を比較します。")}</li>
        <li>{l("A3 기준 시계열에서 변화 시점을 확인하고, 관찰한 구역과 근거를 답안에 설명합니다.", "Use the A3 trace to check onset, then explain the regions and evidence in your answer.", "A3の基準時系列で変化時点を確認し、観察した区画と根拠を回答に記します。")}</li></ol>
      <p className="wi-scope">{l("9구역은 학습을 위한 구분입니다. 실제 웨이퍼 사진·칩 배열·제조사 검사 출력이 아닙니다.", "These nine regions are teaching divisions, not a wafer photo, die layout or manufacturer inspection output.", "9区画は学習用の区分で、実際のウェーハ写真・チップ配置・メーカーの検査出力ではありません。")}</p>
    </div>
  </section>;
}

function InspectionMap({ language, region, signal, time, reference, onRegionChange }: LanguageProps & {
  region: WaferRegion; signal: WaferInspectionSignal; time: number; reference: boolean; onRegionChange: (region: WaferRegion) => void;
}) {
  const l = (ko: string, en: string, ja: string) => tr(language, ko, en, ja);
  const title = reference ? l("같은 위치의 정상 참고", "Same-location normal reference", "同じ位置の正常参照") : l("이번 검사 · 구역을 선택하세요", "Current inspection · select a region", "今回の検査・区画を選択");
  return <figure><figcaption>{title}</figcaption>
    <div className="wi-disk"><div className="wi-cells" role={reference ? "list" : "group"} aria-label={title}>
      {waferRegions.map(item => {
        const sample = waferInspectionSample(item, signal, time);
        const value = reference ? sample.reference : sample.value;
        const content = <><span>{item}</span><strong>{value.toFixed(1)}</strong></>;
        return reference ? <div key={item} role="listitem" className="wi-cell" data-tone={tone(value)} data-selected={region === item}>{content}</div>
          : <button key={item} type="button" className="wi-cell" data-tone={tone(value)} data-selected={region === item} aria-pressed={region === item}
            aria-label={l(`${item} 구역 선택 · 이번 기록 ${value.toFixed(1)}`, `Select region ${item} · current ${value.toFixed(1)}`, `${item}区画を選択・今回 ${value.toFixed(1)}`)}
            onClick={() => onRegionChange(item)}>{content}</button>;
      })}
    </div></div>
  </figure>;
}

export default function WaferInspection({ language, region, onRegionChange, signal, time, review }: LanguageProps & {
  region: WaferRegion; onRegionChange: (region: WaferRegion) => void; signal: WaferInspectionSignal; time: number; review: boolean;
}) {
  const id = useId();
  const l = (ko: string, en: string, ja: string) => tr(language, ko, en, ja);
  const comparison = waferInspectionComparison(region, time);
  const label = signal === "surface" ? l("표면", "Surface", "表面") : l("두께", "Thickness", "厚さ");
  const timestamp = `${Math.floor(comparison.surface.time / 60).toString().padStart(2, "0")}:${(comparison.surface.time % 60).toString().padStart(2, "0")}`;
  return <section className="wi-workspace" aria-labelledby={`${id}-title`}>
    <p className="et-eyebrow">SPATIAL EVIDENCE / {label}</p>
    <h2 id={`${id}-title`}>{l("변화가 어느 위치에 모였나요?", "Where are the changes concentrated?", "変化はどの位置に集中していますか？")}</h2>
    <p>{l(`${timestamp} · 같은 조건·같은 시점의 두 지도를 비교하세요. 위의 표면·두께 버튼으로 표시 항목을 바꿀 수 있습니다.`,
      `${timestamp} · Compare the maps at the same time and under the same conditions. Use the surface/thickness controls above to change the view.`,
      `${timestamp}・同じ条件・同じ時点の2枚を比較します。上の表面・厚さボタンで表示項目を切り替えます。`)}</p>
    <p className="wi-scope">{l("위→아래 A/B/C, 왼쪽→오른쪽 1/2/3. 지도는 선택 시점까지만 보여줍니다. 실제 공정 시간이나 장비 고장을 나타내지 않습니다.",
      "Rows A/B/C run top to bottom; columns 1/2/3 run left to right. Maps show only the selected snapshot, not real process timing or equipment failures.",
      "行A/B/Cは上から下、列1/2/3は左から右です。選択時点だけを表示し、実際の工程時間や装置故障を表しません。")}</p>
    <div className="wi-maps">
      <InspectionMap language={language} region={region} signal={signal} time={time} reference onRegionChange={onRegionChange} />
      <InspectionMap language={language} region={region} signal={signal} time={time} reference={false} onRegionChange={onRegionChange} />
    </div>
    <div className="wi-legend" aria-label={l("두 지도의 공통 색 눈금 · 교육용 상대지수", "Shared color scale · training-only relative indices", "両マップ共通の色目盛・教育用相対指数")}>
      <span><i className="wi-low" aria-hidden="true" />&lt;96</span><span><i aria-hidden="true" />96–&lt;104</span>
      <span><i className="wi-mid" aria-hidden="true" />104–&lt;110</span><span><i className="wi-high" aria-hidden="true" />≥110</span>
    </div>
    <p className="wi-scope">{l("색은 두 지도에 같은 눈금을 쓴 상대지수이며, 결함 개수·불량률·고장 확률이 아닙니다. 색만으로 정상·고장을 확정하지 마세요.",
      "Both maps use the same index scale. Colors are not defect counts, reject rates or failure probabilities. They do not confirm normal operation or failure.",
      "両マップは同じ相対指数の目盛です。色は欠陥数・不良率・故障確率ではなく、正常や故障を確定しません。")}</p>
    <div className="wi-selected" role="region" aria-labelledby={`${id}-selected`}>
      <h3 id={`${id}-selected`}>{l(`${region} · 같은 구역의 두 검사 근거`, `${region} · two kinds of evidence at the same location`, `${region}・同じ区画の2種類の検査根拠`)}</h3>
      <div className="et-table" tabIndex={0} role="region" aria-label={l("선택 구역의 수치 비교표", "Numeric comparison for the selected region", "選択区画の数値比較表")}><table>
        <caption>{l(`${timestamp} · 교육용 상대지수 · 물리 단위가 같은 센서라는 뜻이 아닙니다.`, `${timestamp} · training-only relative indices, not sensors sharing a physical unit.`, `${timestamp}・教育用相対指数で、センサーの物理単位が同じという意味ではありません。`)}</caption>
        <thead><tr><th scope="col">{l("검사 항목", "Inspection", "検査項目")}</th><th scope="col">{l("정상 참고", "Reference", "正常参照")}</th><th scope="col">{l("이번 기록", "Current", "今回")}</th><th scope="col">{l("차이", "Difference", "差")}</th></tr></thead>
        <tbody>{([["surface", comparison.surface], ["thickness", comparison.thickness]] as const).map(([kind, sample]) => <tr key={kind}>
          <th scope="row">{kind === "surface" ? l("표면 편차 지수", "Surface deviation index", "表面偏差指数") : l("두께 검사 지수", "Thickness inspection index", "厚さ検査指数")}</th>
          <td>{sample.reference.toFixed(1)}</td><td>{sample.value.toFixed(1)}</td><td>{signed(sample.difference)}</td>
        </tr>)}</tbody>
      </table></div>
      <p>{l("같은 구역에서 두께 기록도 같은 방향으로 달라졌나요? 한 검사 결과만으로 웨이퍼 전체나 장비 원인을 단정할 수 있는지도 생각해 보세요.",
        "Did thickness also change in the same direction at this location? Consider whether one inspection can establish a whole-wafer pattern or an equipment cause.",
        "同じ区画で厚さ記録も同じ方向に変化しましたか？一つの検査だけでウェーハ全体や装置原因を断定できるか考えてください。")}</p>
    </div>
    {review ? <aside className="wi-review" aria-label={l("선택 구역 복기 · 규칙 기반 안내", "Selected-region review · rule-based guidance", "選択区画の振り返り・ルールに基づく案内")}>
      <h3>{l(`${region} 구역을 다시 비교해 보세요.`, `Recheck region ${region}.`, `${region}区画をもう一度比較しましょう。`)}</h3>
      <ul><li>{l(`${timestamp}의 ${region}: 표면 차이 ${signed(comparison.surface.difference)}, 두께 차이 ${signed(comparison.thickness.difference)}입니다.`,
        `At ${timestamp}, ${region} has a surface difference of ${signed(comparison.surface.difference)} and a thickness difference of ${signed(comparison.thickness.difference)}.`,
        `${timestamp}の${region}：表面の差は${signed(comparison.surface.difference)}、厚さの差は${signed(comparison.thickness.difference)}です。`)}</li>
        <li>{region === comparison.largestSurface.region ? l(`선택한 구역(${region})의 표면 차이 절댓값이 이 시점에서 가장 큽니다 (${signed(comparison.surface.difference)}). 표면·두께의 차이를 함께 보고, 다른 구역에도 같은 변화가 있는지 확인하세요.`,
          `Your selected region ${region} has the largest absolute surface difference at this snapshot (${signed(comparison.surface.difference)}). Compare surface and thickness evidence, then check whether other regions show the same change.`,
          `選択した${region}は、この時点で表面の差の絶対値が最大の区画です（${signed(comparison.surface.difference)}）。表面・厚さの差を比較し、他の区画にも同じ変化があるか確認してください。`)
          : l(`같은 시점의 표면 차이 절댓값이 가장 큰 구역은 ${comparison.largestSurface.region} (${signed(comparison.largestSurface.sample.difference)})입니다. 선택 구역과 나란히 비교하세요.`,
          `At this snapshot, ${comparison.largestSurface.region} has the largest absolute surface difference (${signed(comparison.largestSurface.sample.difference)}). Compare it with the selected region.`,
          `同じ時点で表面の差の絶対値が最大なのは${comparison.largestSurface.region}（${signed(comparison.largestSurface.sample.difference)}）です。選択区画と比較してください。`)}</li>
        <li>{l("위치별 차이가 곧 원인 설명은 아닙니다. 답안에서 ‘어디가 어떻게 달랐는지’와 ‘아직 모르는 원인’을 나누었는지 돌아보세요.",
          "A spatial difference is not a cause explanation. Review whether your answer separates where/how the records differ from causes that remain unknown.",
          "位置による差は原因の説明ではありません。回答で『どこがどう異なるか』と『まだ分からない原因』を分けたか振り返りましょう。")}</li></ul>
      <p className="wi-scope">{l("위 수치 비교와 질문은 규칙 기반 안내이며 AI 생성 답변이나 추가 점수가 아닙니다. 복기 중 구역을 바꿔도 제출 답안과 저장 결과는 바뀌지 않습니다.",
        "These comparisons and prompts are rule-based guidance, not AI-generated feedback or an additional score. Changing regions in review does not change submitted or saved results.",
        "数値比較と問いはルールに基づく案内で、AI生成回答や追加点数ではありません。振り返り中に区画を変えても提出回答と保存結果は変わりません。")}</p>
    </aside> : null}
    <p className="wi-scope">{l(`지도 구역 선택은 관찰용이며 계정 저장·이어하기·공유·AI 입력에는 포함되지 않습니다. 기존 시계열과 제출 기준은 ${WAFER_TRACE_REGION} 기록입니다. 이 지도는 SemiGuard가 작성한 가상 자료입니다.`,
      `Region selection is for observation only and is not included in account saves, checkpoints, sharing or AI input. The existing trace and submission criteria use ${WAFER_TRACE_REGION}. This map is authored synthetic SemiGuard data.`,
      `区画選択は観察用で、アカウント保存・再開・共有・AI入力には含まれません。既存の時系列と提出基準は${WAFER_TRACE_REGION}記録です。このマップはSemiGuard作成の仮想資料です。`)}</p>
  </section>;
}
