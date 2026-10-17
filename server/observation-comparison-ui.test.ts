import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import ObservationComparison from "../client/src/components/ObservationComparison";

const props = { scenarioId: "photo", signalId: "position", time: 45, observedUntil: 45,
  times: [1, 32, 45], onTimesChange: vi.fn(), onInteraction: vi.fn() };
describe("selected-moment comparison and quieter exercise UI", () => {
  it.each([
    ["ko", "내가 고른 시점 비교", "참고 띠 위", "비교 핀과 발견 표시는 달라요"],
    ["en", "Compare chosen moments", "Above reference band", "Comparison pins are not discovery markers"],
    ["ja", "選んだ時点を比較", "基準帯より上", "比較の固定と発見の印は別です"],
  ] as const)("renders exact discrete records and boundaries in %s", (language, heading, band, scope) => {
    const html = renderToStaticMarkup(createElement(ObservationComparison, { ...props, language }));
    for (const value of [heading, band, scope, "00:01", "00:32", "00:45", "112.5"]) expect(html).toContain(value);
    expect(html.match(/<article/g)).toHaveLength(3);
    expect(html.match(/<button/g)).toHaveLength(4);
    expect(html).toContain('max="45"'); expect(html).toContain('disabled=""');
    expect(html).toContain('role="status"'); expect(html).toContain('aria-live="polite"');
    expect(html).toContain('<desc id='); expect(html).toContain('text-anchor="middle"');
    expect(html).toContain('<details class="oc-workspace"><summary class="oc-heading">');
    expect(html).not.toMatch(/<polyline|<form|<iframe|<img|https?:|<details[^>]* open/);
  });
  it("does not show a future bookmark, graph or comparative claim before two valid points", () => {
    const html = renderToStaticMarkup(createElement(ObservationComparison, { ...props, times: [1, 32, 45], observedUntil: 10, time: 9, language: "ko" }));
    expect(html).toContain("00:01"); expect(html).toContain('max="10"');
    expect(html).not.toMatch(/00:32|00:45|<article|<svg/);
    expect(html).toContain("시점 2개부터 비교가 나타납니다.");
  });
  it("keeps A3/group/region/phase context explicit", () => {
    for (const [scenarioId, signalId, times, label] of [
      ["wafer", "surface", [1, 5], "A3 기준 기록"],
      ["oxidation", "film", [29, 30], "검사 묶음 B"],
      ["eds", "die", [59, 60], "구역 C"],
      ["etch", "pressure", [39, 40], "단계 B"],
    ] as const) {
      const html = renderToStaticMarkup(createElement(ObservationComparison, { ...props, scenarioId, signalId, times, observedUntil: 90, language: "ko" }));
      expect(html).toContain(label);
    }
  });
  it("keeps pins outside discovery/answer serialization, network and persistence", () => {
    const component = readFileSync("client/src/components/ObservationComparison.tsx", "utf8");
    expect(component).not.toMatch(/localStorage|sessionStorage|trpc|fetch\(|useEffect|dangerouslySetInnerHTML/);
    expect(component).toContain('state.scope === scope ? state.times : []');
    expect(component).toContain('if (state.scope !== scope) setState({ scope, times: [] });');
    expect(component).toContain('onInteraction(); onTimesChange(addComparisonTime');
    const page = readFileSync("client/src/pages/ProcessTraining.tsx", "utf8");
    const etch = readFileSync("client/src/pages/EtchTraining.tsx", "utf8");
    expect(page).toContain('useObservationComparison(`${storageKey}:${retryRevision}`)');
    expect(etch).toContain('useObservationComparison(`${expectedStorageKey}:${retryRevision}`)');
    expect(page).toContain('onInteraction={pauseObservationView}');
    expect(page).toContain('toProcessTrainingSubmission(completed)');
    expect(etch).toContain('toTrainingSubmission(completed)');
    for (const file of ["shared/trainingRecord.ts", "shared/trainingDraft.ts", "shared/judgmentCoach.ts"]) {
      expect(readFileSync(file, "utf8")).not.toMatch(/comparisonPins|observationComparison|observedComparisonTimes/);
    }
  });
  it("preserves exact numeric evidence in an initially collapsed disclosure", () => {
    const page = readFileSync("client/src/pages/ProcessTraining.tsx", "utf8");
    expect(page).toContain('<details className="pt-exact-snapshot"><summary>');
    expect(page).not.toContain('<details open className="pt-exact-snapshot">');
    for (const original of ['<ProcessRecordContext scenario={scenario} time={time}', '<table>', 'sample.reference.toFixed(1)', 'localize(scenario.referenceRule, language)']) expect(page).toContain(original);
  });
  it("retains mobile controls, native focus and no animated reconstruction", () => {
    const css = readFileSync("client/src/components/observation-comparison.css", "utf8");
    for (const token of ["min-height:44px", ":focus-visible", "@media(max-width:760px)", "grid-template-columns:minmax(0,1fr)"]) expect(css).toContain(token);
    expect(css).toContain('.et-app .oc-pins button{white-space:nowrap;flex:0 0 auto}');
    expect(css).not.toMatch(/!important|animation:|@keyframes/);
  });
  it("lets the existing English discovery marker wrap within a narrow screen", () => {
    const css = readFileSync("client/src/pages/process-training.css", "utf8");
    expect(css).toContain('.pt-app .et-marker-picker button{max-width:100%;min-width:0;height:auto;min-height:44px}');
  });
});
