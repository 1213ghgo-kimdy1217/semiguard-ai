import React, { useState } from "react";
import { Link } from "wouter";
import { getProcessScenario } from "../../../shared/processScenarios";
import { filterTrainingReview, summarizeTrainingReview, type TrainingReviewFilter, type TrainingReviewRecord } from "../../../shared/trainingReview";
import { etchSignalName } from "../lib/etchLanguage";
import { tr, type ProductLanguage } from "../lib/productLanguage";
import "./training-history-list.css";

type HistoryItem = TrainingReviewRecord & {
  id: number; scenarioId: string; signal: string; onset: number; marker: number | null; createdAt: Date | string;
};
const clock = (time: number) => `${Math.floor(time / 60).toString().padStart(2, "0")}:${(time % 60).toString().padStart(2, "0")}`;
const labels = {
  signalMatched: ["관측 항목", "Observed signal", "観測項目"],
  onsetMatched: ["변화 시작 시점", "Change onset", "変化開始時点"],
  comparisonMatched: ["비교 기준", "Comparison reference", "比較基準"],
  certaintyMatched: ["사실과 추정 구분", "Fact versus inference", "事実と推測の区別"],
} as const;
const prompts = {
  signalMatched: ["여러 항목을 각자의 정상 참고와 비교해 보세요. 값이 가장 큰 항목이 반드시 먼저 변한 항목은 아닙니다.", "Compare each signal with its own normal reference. The largest value is not necessarily the first signal to change.", "各項目をそれぞれの正常参照と比較してください。最大の値が最初に変化した項目とは限りません。"],
  onsetMatched: ["표시한 시점과 판단한 변화 시작을 나누어 보세요. 추세의 시작과 참고 범위 경계를 넘은 시점도 다를 수 있습니다.", "Separate your marker from your estimated onset. A trend may start before it crosses the reference-range boundary.", "印の時点と判断した変化開始を分けてください。傾向の開始と参照範囲を超える時点も異なる場合があります。"],
  comparisonMatched: ["같은 공정 단계·조건·위치의 참고 기록인지 먼저 확인해 보세요. 정상적인 단계 변화와 편차를 구분합니다.", "First check whether the reference matches the phase, conditions and location. Distinguish normal phase changes from deviations.", "参照記録が同じ段階・条件・位置かを先に確認してください。正常な段階変化と偏差を区別します。"],
  certaintyMatched: ["그래프에서 직접 확인한 사실과 가능한 원인 후보를 따로 정리해 보세요. 이 가상 기록만으로 실제 고장을 확정할 수 없습니다.", "Separate what the graph directly shows from possible causes. This synthetic record cannot confirm a real equipment failure.", "グラフで確認した事実と考えられる原因を分けてください。この仮想記録だけで実際の故障は確定できません。"],
} as const;

export default function TrainingHistoryList({ attempts, language }: { attempts: readonly HistoryItem[]; language: ProductLanguage }) {
  const l = (ko: string, en: string, ja: string) => tr(language, ko, en, ja);
  const copy = (value: readonly [string, string, string]) => l(value[0], value[1], value[2]);
  const [filter, setFilter] = useState<TrainingReviewFilter>("all");
  const summary = summarizeTrainingReview(attempts);
  const visible = filterTrainingReview(attempts, filter);
  return <>
    <p className="et-caption">{l("최근 저장된 최대 20건 · 같은 모듈의 반복 시도도 각각 포함합니다. 저장된 선택형 결과 기준이며, 현장 역량이나 전체 학습 기록의 통계가 아닙니다.", "Up to 20 recent saved attempts, including repeated attempts at the same module. Based on saved choices, not workplace competency or statistics for your entire learning history.", "直近の保存済み記録、最大20件。同じモジュールの繰り返しも別々に含みます。保存された選択結果に基づくもので、現場能力や全学習記録の統計ではありません。")}</p>
    <h3>{l("다음 복기할 판단 항목", "What to review next", "次に振り返る判断項目")}</h3>
    <p className="et-caption">{l("항목별 숫자는 다시 비교할 기록 수 / 유효한 선택 결과 수입니다. 항목을 눌러 관련 기록만 모아 보고, ‘기록 열기’에서 당시 타임라인을 확인하세요.", "Each count is records to revisit / valid choice results. Select a dimension to filter related records, then Open record to inspect its timeline.", "数字は再比較する記録数／有効な選択結果数です。項目を選んで関連記録だけを表示し、「記録を開く」でタイムラインを確認してください。")}</p>
    <div className="et-actions et-review-filters" role="group" aria-label={l("복기 항목으로 기록 필터", "Filter records by review dimension", "振り返り項目で記録を絞り込む")}>
      <button type="button" className="et-linkbutton" aria-controls="training-history-records" aria-pressed={filter === "all"} onClick={() => setFilter("all")}>{l("전체 기록", "All records", "すべての記録")}</button>
      {summary.map(item => <button key={item.key} type="button" className="et-linkbutton" aria-controls="training-history-records" aria-pressed={filter === item.key} onClick={() => setFilter(item.key)}>{copy(labels[item.key])} · {item.revisit} / {item.reviewed}</button>)}
    </div>
    {filter !== "all" ? <p className="et-caption">{copy(prompts[filter])}</p> : null}
    <div id="training-history-records">
      <p role="status" aria-live="polite">{filter === "all" ? l(`전체 기록 ${visible.length}건`, `Saved records: ${visible.length}`, `すべての記録 ${visible.length}件`) : l(`${copy(labels[filter])} · 다시 비교할 기록 ${visible.length}건`, `${copy(labels[filter])} · Records to revisit: ${visible.length}`, `${copy(labels[filter])}・再比較する記録 ${visible.length}件`)}</p>
      {visible.length ? <ul>{visible.map(item => {
        const scenario = getProcessScenario(item.scenarioId);
        const name = item.signal === "none" ? l("차이 없음", "No deviation", "差異なし") : item.scenarioId === "etch-chamber-a-01"
          ? etchSignalName(language, item.signal as "pressure" | "flow" | "rf" | "temperature")
          : l(...(scenario?.signals.find(signal => signal.id === item.signal)?.name ?? [item.signal, item.signal, item.signal]));
        return <li key={item.id}><strong>{new Date(item.createdAt).toLocaleString(language === "ja" ? "ja-JP" : language === "en" ? "en-US" : "ko-KR")}</strong> · {scenario ? l(...scenario.title) : item.scenarioId} · {l("변화 항목", "Signal", "変化項目")} {name} · {l("시작 시점", "Onset", "開始時点")} {item.onset < 0 ? l("해당 없음", "Not applicable", "該当なし") : clock(item.onset)} · {l("기준 일치", "Criteria matched", "基準一致")} {[item.signalMatched, item.onsetMatched, item.comparisonMatched, item.certaintyMatched].reduce((sum, value) => sum + value, 0)}/4 · <Link className="et-inline-link" href={`/training/history/${item.id}`}>{l("기록 열기", "Open record", "記録を開く")}</Link></li>;
      })}</ul> : <p>{l("이 항목에서 다시 비교할 저장 기록이 없습니다. 전체 기록을 보거나 다른 항목을 선택하세요.", "No saved records to revisit for this dimension. View all records or choose another dimension.", "この項目で再比較する保存記録はありません。全記録を見るか、別の項目を選んでください。")}</p>}
    </div>
  </>;
}
