import React, { useId, useState } from "react";
import { addComparisonTime, observationComparison, OBSERVATION_PIN_LIMIT, observedComparisonTimes } from "../../../shared/observationComparison";
import { getProcessScenario } from "../../../shared/processScenarios";
import { tr, type ProductLanguage } from "../lib/productLanguage";
import "./observation-comparison.css";

const clock = (time: number) => `${Math.floor(time / 60).toString().padStart(2, "0")}:${(time % 60).toString().padStart(2, "0")}`;

/** Owner/attempt-scoped memory only. Not part of saved answers or checkpoints. */
export function useObservationComparison(scope: string) {
  const [state, setState] = useState<{ scope: string; times: number[] }>({ scope, times: [] });
  // Clear on every scope transition, including A → B → A without a pin added in B.
  if (state.scope !== scope) setState({ scope, times: [] });
  return { times: state.scope === scope ? state.times : [],
    onTimesChange: (times: number[]) => setState({ scope, times }) };
}

type Props = { scenarioId: string; signalId: string; time: number; observedUntil: number; language: ProductLanguage;
  times: readonly number[]; onTimesChange: (times: number[]) => void; onInteraction: () => void };

export default function ObservationComparison({ scenarioId, signalId, time, observedUntil, language, times, onTimesChange, onInteraction }: Props) {
  const [requested, setRequested] = useState<number | null>(null);
  const id = useId();
  const scenario = getProcessScenario(scenarioId)!;
  const signal = scenario.signals.find(signal => signal.id === signalId)!;
  const l = (ko: string, en: string, ja: string) => tr(language, ko, en, ja);
  const until = Math.max(0, Math.min(scenario.duration, Number.isFinite(observedUntil) ? Math.floor(observedUntil) : 0));
  const selected = Math.max(0, Math.min(until, requested ?? time));
  const visible = observedComparisonTimes(times, until, scenario.duration);
  const records = observationComparison(scenarioId, signalId, visible, until);
  const title = l(...signal.name);
  const full = visible.length === OBSERVATION_PIN_LIMIT;
  const bandLabel = (band: "below" | "inside" | "above") => band === "inside" ? l("참고 띠 안", "Inside reference band", "基準帯内") : band === "below" ? l("참고 띠 아래", "Below reference band", "基準帯より下") : l("참고 띠 위", "Above reference band", "基準帯より上");
  const contextLabel = (context: typeof records[number]["context"]) => !context ? "" : `${context.kind === "phase" ? l("단계", "Phase", "段階") : context.kind === "group" ? l("검사 묶음", "Inspection group", "検査グループ") : context.kind === "region" ? l("구역", "Region", "領域") : l("기준 위치", "Reference location", "基準位置")} ${context.value}`;
  const plotMin = Math.floor(Math.min(...records.flatMap(record => [record.value, record.reference, record.low])) - 2);
  const plotMax = Math.ceil(Math.max(...records.flatMap(record => [record.value, record.reference, record.high])) + 2);
  const y = (value: number) => 125 - (value - plotMin) / (plotMax - plotMin) * 100;
  return <section className="oc-desk" aria-labelledby={`${id}-title`}>
    <details className="oc-workspace"><summary className="oc-heading"><h3 id={`${id}-title`}>{l("내가 고른 시점 비교", "Compare chosen moments", "選んだ時点を比較")}</h3><span>{visible.length}/{OBSERVATION_PIN_LIMIT}</span></summary>
    <p className="oc-lead">{l("변화 전·후 시점을 최대 3개 골라 나란히 보세요.", "Choose up to three observed moments to compare side by side.", "観測済み時点を最大3つ選び、並べて比較します。")}</p>
    <div className="oc-add"><label htmlFor={`${id}-time`}>{l("비교할 시점 (초)", "Comparison time (seconds)", "比較する時点（秒）")}</label>
      <input id={`${id}-time`} type="number" min={0} max={until} step={1} value={selected} onChange={event => {
        const value = Number(event.target.value);
        if (Number.isInteger(value) && value >= 0 && value <= until) { onInteraction(); setRequested(value); }
      }} />
      <button type="button" disabled={full || visible.includes(selected)} onClick={() => {
        onInteraction(); onTimesChange(addComparisonTime(visible, selected, until, scenario.duration)); setRequested(null);
      }}>{l(`${clock(selected)} 비교에 추가`, `Add ${clock(selected)}`, `${clock(selected)}を比較に追加`)}</button>
    </div>
    <div className="oc-pins" role="group" aria-label={l("고정한 비교 시점", "Pinned comparison moments", "固定した比較時点")}>
      {visible.map(pin => <button type="button" key={pin} aria-label={l(`${clock(pin)} 비교에서 제거`, `Remove ${clock(pin)} from comparison`, `${clock(pin)}を比較から外す`)} onClick={() => {
        onInteraction(); onTimesChange(visible.filter(time => time !== pin));
      }}>{clock(pin)} <span aria-hidden="true">×</span></button>)}
    </div>
    <p className="oc-status" role="status" aria-live="polite">{full ? l("3개를 골랐어요. 바꾸려면 위 시점 하나를 제거하세요.", "Three selected. Remove a moment above to choose another.", "3つ選択済みです。変更するには上の時点を一つ外してください。") : records.length < 2 ? l("시점 2개부터 비교가 나타납니다.", "Comparison appears after choosing two moments.", "2つ選ぶと比較が表示されます。") : l("고른 시점의 기록을 각 시점의 정상 참고와 비교하세요.", "Compare each chosen moment with its own normal reference.", "選んだ各時点の記録を、それぞれの正常参照と比較してください。")}</p>
    {records.length >= 2 ? <>
      <h4>{title}{scenario.processId === "wafer" ? ` · ${l("A3 기준 기록", "A3 reference trace", "A3基準記録")}` : ""}</h4>
      <figure className="oc-plot"><svg viewBox="0 0 320 166" role="img" aria-labelledby={`${id}-plot-title ${id}-plot-desc`}>
        <title id={`${id}-plot-title`}>{`${l("고른 시점만 모아 본 기록", "Records at chosen moments only", "選んだ時点だけの記録")}: ${title}`}</title>
        <desc id={`${id}-plot-desc`}>{records.map(record => `${clock(record.time)} ${contextLabel(record.context)}: ${record.value.toFixed(1)} / ${record.reference.toFixed(1)}; ${bandLabel(record.band)}`).join(". ")}</desc>
        <path d="M38 20V130H310" fill="none" stroke="#657d70" />
        <text x="3" y="28">{plotMax}</text><text x="3" y="127">{plotMin}</text>
        {records.map((record, index) => {
          const x = 75 + index * (190 / Math.max(1, records.length - 1));
          return <g key={record.time}>
            <rect x={x - 18} y={y(record.high)} width={36} height={y(record.low) - y(record.high)} fill="#31594d" />
            <circle cx={x} cy={y(record.reference)} r={9} fill="none" stroke="#d4ded7" strokeWidth={2} strokeDasharray="3 2" />
            <circle cx={x} cy={y(record.value)} r={5} fill="#f0bc70" stroke="#101816" />
            <text x={x} y="152" textAnchor="middle">{clock(record.time)}</text>
          </g>;
        })}
      </svg><figcaption>{l("● 이번 기록　◌ 정상 참고　▰ 해당 참고 띠", "● Current　◌ Normal reference　▰ Context-matched band", "● 今回　◌ 正常参照　▰ 条件に合う基準帯")}</figcaption></figure>
      <div className="oc-cards">{records.map((record, index) => <article key={record.time}>
        <h5><span>{index + 1}</span> <time>{clock(record.time)}</time></h5>
        {record.context ? <p className="oc-context">{contextLabel(record.context)}</p> : null}
        <p className={`oc-band oc-band--${record.band}`}>{bandLabel(record.band)}</p>
        <dl><div><dt>{l("이번 기록", "Current record", "今回の記録")}</dt><dd>{record.value.toFixed(1)}</dd></div>
          <div><dt>{l("정상 참고", "Normal reference", "正常参照")}</dt><dd>{record.reference.toFixed(1)}</dd></div>
          <div><dt>{l("참고와의 차이", "Difference from reference", "参照との差")}</dt><dd>{record.difference > 0 ? "+" : ""}{record.difference.toFixed(1)}</dd></div></dl>
      </article>)}</div>
      <p className="oc-limit">{l("교육용 상대지수 · 고른 시점은 같은 간격으로 배치하며 점 사이는 추정하지 않습니다. 서로 다른 단계·묶음·구역은 각자의 참고와 비교하세요.", "Teaching indices. Chosen moments are equally spaced; nothing between them is inferred. Compare different phases, groups or regions with their own references.", "教育用相対指数。選択時点を等間隔で配置し、点間は推定しません。異なる段階・グループ・領域は各々の参照と比較してください。")}</p>
    </> : null}
    <details className="oc-scope"><summary>{l("비교 핀과 발견 표시는 달라요", "Comparison pins are not discovery markers", "比較の固定と発見の印は別です")}</summary><p>{l("비교 핀은 이번 연습 화면에서만 쓰며 발견 표시·답안·점수·계정 저장·이어하기·공유·AI 입력을 바꾸지 않습니다. 새 시도·계정 변경·새로고침 때 비워집니다. 실제 장비 사진이나 원인 진단이 아닙니다.", "Pins are view-only for this exercise. They change no discovery marker, answer, score, account save, checkpoint, share or AI input. New attempts, account changes and reloads clear them. These are not equipment photos or cause diagnoses.", "固定は今回の練習画面だけで使い、発見印・回答・点数・保存・再開・共有・AI入力を変えません。新しい試行・アカウント変更・更新で消えます。実装置写真や原因診断ではありません。")}</p></details>
    </details>
  </section>;
}
