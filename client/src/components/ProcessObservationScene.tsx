import { useId } from "react";
import { readProcessScene } from "../../../shared/processScene";
import type { ProcessScenario } from "../../../shared/processScenarios";
import { etchPhase } from "../../../shared/etchScenario";
import { tr, type ProductLanguage } from "../lib/productLanguage";
import ProcessSceneDiagram from "./ProcessSceneDiagram";
import "./process-observation-scene.css";

const clock = (time: number) => `${Math.floor(time / 60).toString().padStart(2, "0")}:${(time % 60).toString().padStart(2, "0")}`;
type Props = {
  scenario: ProcessScenario; time: number; observedUntil: number; language: ProductLanguage;
  selectedSignal: string; onSignalChange: (signal: string) => void;
  onTimeChange?: (time: number) => void; running?: boolean;
};

export default function ProcessObservationScene({ scenario, time, observedUntil, language, selectedSignal, onSignalChange, onTimeChange, running = false }: Props) {
  const scene = readProcessScene(scenario, time, observedUntil);
  const observed = readProcessScene(scenario, observedUntil, observedUntil).time;
  const selected = scene.channels.find(channel => channel.id === selectedSignal) ?? scene.channels[0];
  const sliderId = useId();
  const l = (ko: string, en: string, ja: string) => tr(language, ko, en, ja);
  const name = (text: readonly [string, string, string]) => l(...text);
  const context = scenario.processId === "wafer" ? l("A3 구역 · 제출 기준 기록", "Region A3 · submission reference", "A3区画・提出基準の記録")
    : scenario.processId === "oxidation" ? l(`검사 묶음 ${scene.time < 30 ? "A" : "B"} · 같은 묶음의 참고`, `Inspection group ${scene.time < 30 ? "A" : "B"} · matching reference`, `検査グループ${scene.time < 30 ? "A" : "B"}・同じグループの参照`)
    : scenario.processId === "eds" ? l(`검사 구역 ${scene.time < 30 ? "A" : scene.time < 60 ? "B" : "C"} · 현재 펼친 기록`, `Inspection region ${scene.time < 30 ? "A" : scene.time < 60 ? "B" : "C"} · current record`, `検査領域${scene.time < 30 ? "A" : scene.time < 60 ? "B" : "C"}・現在の記録`)
    : scenario.processId === "etch" ? l(`단계 ${etchPhase(scene.time)} · 같은 단계의 참고`, `Phase ${etchPhase(scene.time)} · same-phase reference`, `段階${etchPhase(scene.time)}・同じ段階の参照`)
    : scenario.processId === "deposition" ? l("막 검사와 별도 전기적 검사", "Film and separate electrical inspections", "膜検査と別の電気的検査") : l("같은 조건의 검사 기록 비교", "Same-condition inspection comparison", "同じ条件の検査記録を比較");
  return <section className={`pv-scene pv-scene--${scenario.processId}`} data-process={scenario.processId} data-time={scene.time} aria-label={l("그림으로 관찰하기", "Observe in the diagram", "図で観察する")}>
    <div className="pv-scene-heading"><div><p>VISUAL OBSERVATION</p><h3>{l("어느 부분의 기록이 달라지나요?", "Which observation is changing?", "どの部分の記録が変わりますか？")}</h3></div><span className="pv-playback-state">{running ? l("관찰 중", "Observing", "観察中") : l("멈춰서 비교 중", "Paused for comparison", "止めて比較中")}</span></div>
    <p className="pv-one-step">{l("그림 속 관측값을 눌러 살펴보세요. 같은 시점의 정상 참고와 비교할 수 있어요.", "Select a reading in the diagram and compare it with the same-time reference.", "図の観測値を選び、同じ時点の正常参照と比べてみましょう。")}</p><p className="pv-record-context">{context} · {clock(scene.time)}</p>
    <div className={`pv-canvas pv-canvas--${scene.channels.length}`}>
      <ProcessSceneDiagram scene={scene} language={language} />
      <div className="pv-measurements" role="group" aria-label={l("그림 속 관측 항목", "Readings within the diagram", "図内の観測項目")}>
        {scene.channels.map((channel, index) => <button type="button" key={channel.id} className={`pv-point pv-point--${index}`} data-signal={channel.id} data-value={channel.value.toFixed(1)} aria-pressed={selected.id === channel.id}
          onClick={() => onSignalChange(channel.id)} aria-label={`${name(channel.name)} · ${channel.value.toFixed(1)} · ${l("상대지수", "relative index", "相対指数")}`}>
          <span className="pv-point-name"><i aria-hidden="true" />{name(channel.name)}</span><strong>{channel.value.toFixed(1)}</strong><small>{l("가상 검사 지수", "synthetic index", "仮想検査指数")}</small>
        </button>)}
      </div>
      <div className="pv-diagram-key" aria-hidden="true"><span><i />{l("이번 기록", "Current record", "今回の記録")}</span><span><i />{l("정상 참고", "Normal reference", "正常参照")}</span></div>
    </div>
    <div className="pv-selected-reading"><div><span>{l("선택한 관측 지점", "Selected observation", "選択した観測点")}</span><strong>{name(selected.name)}</strong><small>{name(selected.location)}</small></div>
      <dl><div><dt>{l("정상 참고", "Normal reference", "正常参照")}</dt><dd>{selected.reference.toFixed(1)}</dd></div><div><dt>{l("같은 조건의 참고 띠", "Same-condition band", "同じ条件の基準帯")}</dt><dd>{selected.low.toFixed(1)}–{selected.high.toFixed(1)}</dd></div></dl>
    </div>
    {onTimeChange ? <div className="pv-scrubber"><label htmlFor={sliderId}>{l("관측한 구간 되돌려 보기", "Revisit the observed interval", "観測した区間を振り返る")}<strong>{clock(scene.time)} <span>/ {clock(observed)}</span></strong></label>
      <input id={sliderId} type="range" min={0} max={observed} step={1} value={scene.time} disabled={observed === 0} onChange={event => onTimeChange(Math.max(0, Math.min(observed, Number(event.target.value))))} /></div> : null}
    <p className="pv-scope">{l("교육용 가상 기록을 그린 도식입니다. 그림의 크기·이동은 검사 지수의 비교 표현이며 실제 형상·치수·장비 상태를 재현하지 않습니다.", "A diagram of synthetic training records. Shapes and movements encode index comparisons, not measured geometry, dimensions or equipment condition.", "教育用仮想記録の模式図です。大きさや動きは指数の比較表現で、実測の形状・寸法・装置状態ではありません。")}</p>
  </section>;
}
