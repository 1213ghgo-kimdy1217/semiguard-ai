import React from "react";
import { tr, type ProductLanguage } from "../lib/productLanguage";
import { type ProcessAnswer, type ProcessScenario, type processCriteria } from "../../../shared/processScenarios";

const clock = (time: number) => `${Math.floor(time / 60).toString().padStart(2, "0")}:${(time % 60).toString().padStart(2, "0")}`;

export default function ProcessCriteriaFeedback({ scenario, answer, matched, language, onReviewPoint }: {
  scenario: ProcessScenario;
  answer: ProcessAnswer;
  matched: NonNullable<ReturnType<typeof processCriteria>>;
  language: ProductLanguage;
  onReviewPoint: (time: number) => void;
}) {
  const l = (ko: string, en: string, ja: string) => tr(language, ko, en, ja);
  const localize = (values: readonly [string, string, string]) => values[language === "ko" ? 0 : language === "en" ? 1 : 2];
  const noDeviation = l("정상 참고와의 편차를 확인하지 못함", "No deviation established against the normal reference", "正常参照からの偏差は確認できない");
  const signalName = (id: string) => id === "none" ? noDeviation : localize(scenario.signals.find(signal => signal.id === id)!.name);
  const noOnset = l("편차 시작을 지정하지 않음", "No deviation onset specified", "偏差の開始を指定しない");
  const sameCondition = l("같은 조건·같은 위치·같은 진행 시점의 정상 참고", "Normal reference at the same conditions, location and stage", "同じ条件・位置・進行時点の正常参照");
  const uncertain = l("관찰한 내용과 가능한 원인을 구분해야 함", "Separate observations from possible causes", "観察した内容と可能な原因を区別する必要がある");
  const ownOnset = /^(0|[1-9]\d*)$/.test(answer.onset) && Number(answer.onset) <= scenario.duration ? Number(answer.onset) : null;
  const rows = [
    {
      key: "signalMatched", label: l("주목한 항목", "Main item", "注目した項目"),
      own: signalName(answer.signal), criterion: signalName(scenario.expectedSignal),
      help: l("한 항목만 보고 원인을 확정하지 말고, 같은 시점의 다른 기록도 정상 참고와 함께 비교하세요.", "Compare the other records at the same time against their normal references; one item alone cannot establish a cause.", "一つの項目だけで原因を確定せず、同じ時点の他の記録も正常参照と比較してください。"),
    },
    {
      key: "onsetMatched", label: l("변화 시작 판단", "Onset reasoning", "変化開始の判断"),
      own: ownOnset === null ? noOnset : clock(ownOnset),
      criterion: scenario.changeTime === null ? noOnset : `${clock(scenario.changeTime)} · ${l("앞뒤 5초 허용", "±5-second allowance", "前後5秒を許容")}`,
      help: scenario.changeTime === null
        ? l("정상 참고도 함께 변하는 기록입니다. 정상 변화가 있다는 이유만으로 이상 시작 시점을 만들지 않습니다.", "The normal reference changes too. A normal change alone does not require inventing an anomaly onset.", "正常参照も一緒に変化する記録です。正常な変化だけを理由に異常の開始時点を作る必要はありません。")
        : l("범위 경계를 넘은 시점과 변화가 시작된 시점은 다를 수 있습니다. 두 시점의 앞뒤를 정상 참고와 비교하세요. 허용 범위는 이 연습의 선택형 기준일 뿐 실제 설비 기준이 아닙니다.", "Crossing a range boundary and the start of a change can differ. Compare the records around both times with the normal reference. The allowance is a choice criterion for this exercise, not a real equipment limit.", "範囲の境界を超えた時点と変化が始まった時点は異なる場合があります。両時点の前後を正常参照と比較してください。許容範囲はこの練習の選択基準で、実装置の基準ではありません。"),
    },
    {
      key: "comparisonMatched", label: l("같은 조건의 정상 참고", "Same-condition reference", "同じ条件の正常参照"),
      own: answer.comparison === "same-condition" ? sameCondition : l("전체 기록의 평균만 비교", "Compare only the whole-record average", "記録全体の平均だけを比較"),
      criterion: sameCondition, help: localize(scenario.referenceRule),
    },
    {
      key: "certaintyMatched", label: l("사실과 원인 추정 구분", "Facts versus cause inference", "事実と原因の推測を区別"),
      own: answer.certainty === "uncertain" ? uncertain : l("이 자료만으로 특정 원인을 확정할 수 있음", "These records can establish a specific cause", "この資料だけで特定の原因を確定できる"),
      criterion: uncertain,
      help: l("관측한 편차는 기록의 사실입니다. 이 자료만으로 실제 장비 고장이나 특정 원인을 확정하거나 배제할 수 없습니다.", "An observed deviation is a fact about the record. These records cannot confirm or exclude a real equipment fault or specific cause.", "観測した偏差は記録上の事実です。この資料だけで実装置の故障や特定原因を確定、または除外できません。"),
    },
  ] as const;

  return <>{rows.map(row => <article className="et-feedback pt-criterion" key={row.key}>
    <span className={matched[row.key] ? "et-good" : "et-revisit"}>{matched[row.key] ? l("구성 기준과 일치", "Matches teaching criteria", "構成基準と一致") : l("다시 비교해 보기", "Compare again", "再度比較する")}</span>
    <h3>{row.label}</h3>
    <dl className="pt-choice-values">
      <div><dt>{l("내 선택", "Your choice", "自分の選択")}</dt><dd>{row.own}</dd></div>
      <div><dt>{l("교육용 비교 기준", "Teaching criterion", "教育用の比較基準")}</dt><dd>{row.criterion}</dd></div>
    </dl>
    <p>{row.help}</p>
    {row.key === "onsetMatched" ? <div className="et-actions pt-criterion-actions">
      {ownOnset !== null ? <button type="button" onClick={() => onReviewPoint(ownOnset)}>{l(`${ownOnset}초의 내 시작 판단 보기`, `Review your onset at ${ownOnset} s`, `自分の開始判断（${ownOnset}秒）を見る`)}</button> : null}
      {scenario.changeTime !== null ? <button type="button" onClick={() => onReviewPoint(scenario.changeTime!)}>{l(`${scenario.changeTime}초의 구성상 시작 보기`, `Review designed onset at ${scenario.changeTime} s`, `構成上の開始（${scenario.changeTime}秒）を見る`)}</button> : null}
      <button type="button" onClick={() => onReviewPoint(scenario.duration)}>{l("전체 기록과 정상 참고 비교", "Compare the full record with its normal reference", "全記録と正常参照を比較")}</button>
    </div> : null}
  </article>)}</>;
}
