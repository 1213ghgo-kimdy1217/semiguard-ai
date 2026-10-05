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
  const photo = scenario.processId === "photo";
  const deposition = scenario.processId === "deposition";
  const metal = scenario.processId === "metal";
  if (!oxidation && !photo && !deposition && !metal) return null;
  const points = oxidation ? [
    { time: scenario.events[0].time - 1, label: l("묶음 A · 전환 직전", "Group A · before the switch", "グループA・切替直前") },
    { time: scenario.events[0].time, label: l("묶음 B · 전환 시점", "Group B · at the switch", "グループB・切替時点") },
  ] : photo ? [
    { time: scenario.changeTime! - 1, label: l("편차 직전", "Before the deviation", "偏差の直前") },
    { time: scenario.changeTime!, label: l("편차 시작", "Deviation begins", "偏差の開始") },
    { time: scenario.events[1].time, label: l("참고 띠로 복귀", "Return to the reference band", "基準帯へ復帰") },
  ] : deposition ? [
    { time: scenario.changeTime! - 1, label: l("막 검사 편차 직전", "Before the film deviation", "膜検査の偏差直前") },
    { time: scenario.changeTime!, label: l("막 검사 편차 시작", "Film deviation begins", "膜検査の偏差開始") },
    { time: scenario.duration, label: l("관측 구간의 마지막 기록", "Final record in the observation interval", "観察区間の最後の記録") },
  ] : [
    { time: scenario.changeTime! - 1, label: l("연결 편차 직전", "Before the connection deviation", "接続偏差の直前") },
    { time: scenario.changeTime!, label: l("첫 연결 편차", "First connection deviation", "最初の接続偏差") },
    // These points match the authored metal trace's six-second intervals.
    { time: scenario.changeTime! + 6, label: l("일시적으로 참고 띠 안", "Temporarily inside the reference band", "一時的に基準帯内") },
    { time: scenario.changeTime! + 12, label: l("다시 나타난 연결 편차", "Connection deviation recurs", "接続偏差が再発") },
  ];
  const heading = oxidation ? l("값의 변화와 기준 대비 편차를 구분하기", "Separate value changes from reference deviations", "値の変化と基準からの偏差を区別する")
    : photo ? l("편차 전·중·후를 함께 비교하기", "Compare before, during and after the deviation", "偏差の前・中・後をまとめて比較する")
    : deposition ? l("서로 다른 검사를 각자의 기준과 비교하기", "Compare different inspections with their own references", "異なる検査をそれぞれの基準と比較する")
    : l("일시 복귀와 반복 편차를 구분하기", "Separate temporary returns from recurring deviations", "一時的な復帰と繰り返す偏差を区別する");
  const explanation = oxidation ? l("두 묶음에서 관측값뿐 아니라 정상 참고와 범위도 바뀝니다. 이 가상 기록은 각 묶음의 참고 범위 안에 있으므로, 30초의 값 변화 자체를 편차 시작으로 보지 않습니다.", "Readings, normal references and bands change between the two groups. These synthetic records stay within their respective bands, so the value change at 30 s is not a deviation onset.", "二つのグループでは観測値だけでなく正常参照と範囲も変わります。この仮想記録は各グループの基準帯内にあるため、30秒の値の変化自体を偏差開始とはみなしません。")
    : photo ? l("위치는 32초부터 45초 직전까지 참고 띠를 벗어나지만, 형상은 같은 시점에 띠 안에 있습니다. 마지막 값만 보면 놓칠 수 있는 일시적 편차입니다. 45초의 복귀는 실제 고장이 해결됐다는 증거는 아닙니다.", "Position falls outside the band from 32 s until just before 45 s, while shape stays inside at those times. The final value alone can miss this brief deviation. The return at 45 s is not evidence that a fault was fixed.", "位置は32秒から45秒直前まで基準帯外ですが、形状は同じ時点で基準帯内です。最後の値だけでは見逃す一時的な偏差です。45秒の復帰は実際の故障が解決した証拠ではありません。")
    : deposition ? l("막 검사 기록은 48초부터 관측 구간 끝까지 아래쪽 참고 띠를 벗어납니다. 별도 전기적 기록은 자신의 참고 띠 안에 있습니다. 두 상대지수는 서로 다른 목적의 별도 검사 기록이므로, 숫자끼리 직접 대조하거나 하나로 다른 검사를 대체하지 않습니다.", "Film inspection stays below its reference band from 48 s to the end of this observation interval. The separate electrical record stays within its own band. These indices represent separate inspections with different purposes; do not compare their numbers directly or substitute one inspection for the other.", "膜検査記録は48秒から観察区間の最後まで基準帯の下側を外れます。別の電気的記録は自身の基準帯内です。相対指数は異なる目的の別々の検査記録であり、数値同士を直接比較したり、一方の検査を他方で代替したりしません。")
    : l("연결 기록은 42초에 참고 띠를 벗어나고, 48초에는 띠 안으로 돌아오지만 54초에 다시 벗어납니다. 외관 기록은 이 시점들에 자신의 참고 띠 안에 있습니다. 48초의 띠 안 복귀만으로 이후에도 편차가 없다고 판단할 수 없으며, 외관 기록이 띠 안이라는 사실이 연결 기록의 편차가 없어졌다는 뜻은 아닙니다.", "Connection records leave the band at 42 s, return inside at 48 s, and leave again at 54 s. Appearance stays within its own band at these points. The return inside the band at 48 s alone does not establish that later records are free of deviation; appearance inside its band does not erase the connection-record deviation.", "接続記録は42秒に基準帯を外れ、48秒に帯内へ戻りますが、54秒に再び外れます。外観記録はこれらの時点で自身の基準帯内です。48秒の基準帯内への復帰だけでは、その後も偏差がないとは判断できません。外観が帯内であることは接続記録の偏差がなくなったことを意味しません。");
  return <div className="pt-evidence-compare">
    <h3>{heading}</h3>
    <p>{explanation}</p>
    <div className={`pt-evidence-points${points.length === 4 ? " pt-evidence-points--four" : ""}`}>{points.map(point => <article key={point.time}>
      <h4><time>{clock(point.time)}</time>{point.label}</h4>
      <dl>{scenario.signals.map(signal => {
        const sample = processSample(scenario, signal.id, point.time);
        const difference = sample.value - sample.reference;
        return <div key={signal.id}><dt>{l(...signal.name)}<small className="pt-evidence-location">{l(...signal.location)}</small></dt><dd>
          <span>{l("이번 / 정상 참고", "Current / normal reference", "今回 / 正常参照")} <b>{sample.value.toFixed(1)} / {sample.reference.toFixed(1)}</b></span>
          <small>{l("차이", "Difference", "差")} {difference > 0 ? "+" : ""}{difference.toFixed(1)} · {l("참고 범위", "Reference band", "基準帯")} {sample.low.toFixed(1)}–{sample.high.toFixed(1)}</small>
        </dd></div>;
      })}</dl>
      <button type="button" onClick={() => onReviewPoint(point.time)}>{l(`그래프에서 ${clock(point.time)} 보기`, `View ${clock(point.time)} in the graph`, `グラフで${clock(point.time)}を見る`)}</button>
    </article>)}</div>
    {deposition || metal ? <p className="pt-evidence-limit">{l("판단의 경계: 여기서 확인한 것은 가상 검사 기록의 편차입니다. 다른 검사 결과가 참고 띠 안이라는 사실만으로 특정 장비 원인의 확정·배제를 할 수 없습니다. 먼저 같은 검사 조건의 앞뒤 기록을 비교한 뒤, 다른 목적의 기록은 해당 참고 기준과 따로 비교하세요.", "Reasoning boundary: the evidence here is a deviation in synthetic inspection records. Another inspection staying inside its band cannot confirm or exclude a particular equipment cause. Compare earlier and later records from the same inspection conditions first, then compare other-purpose records with their own references.", "判断の境界：確認したのは仮想検査記録の偏差です。別の検査が基準帯内という事実だけでは、特定の装置原因の確定・除外はできません。まず同じ検査条件の前後を比較し、異なる目的の記録はそれぞれの基準と個別に比較してください。")}</p> : null}
    <p className="et-caption">{l("위 수치는 현재 연습의 교육용 상대지수입니다. 실제 장비의 운전 조건이나 고장 기준이 아니며, 비교 버튼은 저장된 답안을 바꾸지 않습니다.", "These are teaching-only relative indices for this exercise, not real operating conditions or fault limits. Comparison buttons do not change your saved answer.", "上の数値はこの練習の教育用相対指数です。実装置の運転条件や故障基準ではなく、比較ボタンで保存済みの回答は変わりません。")}</p>
  </div>;
}
