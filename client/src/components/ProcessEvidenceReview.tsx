import React from "react";
import { processSample, type ProcessScenario } from "../../../shared/processScenarios";
import { tr, type ProductLanguage } from "../lib/productLanguage";

type Props = { scenario: ProcessScenario; language: ProductLanguage };
const clock = (time: number) => `${Math.floor(time / 60).toString().padStart(2, "0")}:${(time % 60).toString().padStart(2, "0")}`;

export function ProcessRecordContext({ scenario, time, language }: Props & { time: number }) {
  if (scenario.processId !== "oxidation") return null;
  const selectedTime = processSample(scenario, scenario.signals[0].id, time).time;
  const group = selectedTime < scenario.events[0].time ? "A" : "B";
  return <p className="pt-record-context">
    <strong>{tr(language, `검사 묶음 ${group}`, `Inspection group ${group}`, `検査グループ ${group}`)}</strong>
    <span>{tr(language, `${clock(selectedTime)}의 선택 기록 · 이 묶음의 정상 참고와 비교`, `Selected record at ${clock(selectedTime)} · compare with this group's normal reference`, `${clock(selectedTime)}の選択記録・このグループの正常参照と比較`)}</span>
  </p>;
}

export default function ProcessEvidenceReview({ scenario, language, onReviewPoint }: Props & { onReviewPoint: (time: number) => void }) {
  const l = (ko: string, en: string, ja: string) => tr(language, ko, en, ja);
  const oxidation = scenario.processId === "oxidation";
  if (!oxidation && scenario.processId !== "photo") return null;
  const points = oxidation ? [
    { time: scenario.events[0].time - 1, label: l("묶음 A · 전환 직전", "Group A · before the switch", "グループA・切替直前") },
    { time: scenario.events[0].time, label: l("묶음 B · 전환 시점", "Group B · at the switch", "グループB・切替時点") },
  ] : [
    { time: scenario.changeTime! - 1, label: l("편차 직전", "Before the deviation", "偏差の直前") },
    { time: scenario.changeTime!, label: l("편차 시작", "Deviation begins", "偏差の開始") },
    { time: scenario.events[1].time, label: l("참고 띠로 복귀", "Return to the reference band", "基準帯へ復帰") },
  ];
  return <div className="pt-evidence-compare">
    <h3>{oxidation ? l("값의 변화와 기준 대비 편차를 구분하기", "Separate value changes from reference deviations", "値の変化と基準からの偏差を区別する") : l("편차 전·중·후를 함께 비교하기", "Compare before, during and after the deviation", "偏差の前・中・後をまとめて比較する")}</h3>
    <p>{oxidation ? l("두 묶음에서 관측값뿐 아니라 정상 참고와 범위도 바뀝니다. 이 가상 기록은 각 묶음의 참고 범위 안에 있으므로, 30초의 값 변화 자체를 편차 시작으로 보지 않습니다.", "Readings, normal references and bands change between the two groups. These synthetic records stay within their respective bands, so the value change at 30 s is not a deviation onset.", "二つのグループでは観測値だけでなく正常参照と範囲も変わります。この仮想記録は各グループの基準帯内にあるため、30秒の値の変化自体を偏差開始とはみなしません。") : l("위치는 32초부터 45초 직전까지 참고 띠를 벗어나지만, 형상은 같은 시점에 띠 안에 있습니다. 마지막 값만 보면 놓칠 수 있는 일시적 편차입니다. 45초의 복귀는 실제 고장이 해결됐다는 증거는 아닙니다.", "Position falls outside the band from 32 s until just before 45 s, while shape stays inside at those times. The final value alone can miss this brief deviation. The return at 45 s is not evidence that a fault was fixed.", "位置は32秒から45秒直前まで基準帯外ですが、形状は同じ時点で基準帯内です。最後の値だけでは見逃す一時的な偏差です。45秒の復帰は実際の故障が解決した証拠ではありません。")}</p>
    <div className="pt-evidence-points">{points.map(point => <article key={point.time}>
      <h4><time>{clock(point.time)}</time>{point.label}</h4>
      <dl>{scenario.signals.map(signal => {
        const sample = processSample(scenario, signal.id, point.time);
        const difference = sample.value - sample.reference;
        return <div key={signal.id}><dt>{l(...signal.name)}</dt><dd>
          <span>{l("이번 / 정상 참고", "Current / normal reference", "今回 / 正常参照")} <b>{sample.value.toFixed(1)} / {sample.reference.toFixed(1)}</b></span>
          <small>{l("차이", "Difference", "差")} {difference > 0 ? "+" : ""}{difference.toFixed(1)} · {l("참고 범위", "Reference band", "基準帯")} {sample.low.toFixed(1)}–{sample.high.toFixed(1)}</small>
        </dd></div>;
      })}</dl>
      <button type="button" onClick={() => onReviewPoint(point.time)}>{l(`그래프에서 ${clock(point.time)} 보기`, `View ${clock(point.time)} in the graph`, `グラフで${clock(point.time)}を見る`)}</button>
    </article>)}</div>
    <p className="et-caption">{l("위 수치는 현재 연습의 교육용 상대지수입니다. 실제 장비의 운전 조건이나 고장 기준이 아니며, 비교 버튼은 저장된 답안을 바꾸지 않습니다.", "These are teaching-only relative indices for this exercise, not real operating conditions or fault limits. Comparison buttons do not change your saved answer.", "上の数値はこの練習の教育用相対指数です。実装置の運転条件や故障基準ではなく、比較ボタンで保存済みの回答は変わりません。")}</p>
  </div>;
}
