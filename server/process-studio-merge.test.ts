import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import RecordBand from "../client/src/components/RecordBand";
import EtchChamberConcept from "../client/src/components/EtchChamberConcept";
import MetalLayerConcept from "../client/src/components/MetalLayerConcept";
import PackagingObservationWorkspace from "../client/src/components/PackagingObservationWorkspace";
import { DepositionWorkspace } from "../client/src/components/ProcessEvidenceWorkspaces";
import { getProcessScenario, processSample } from "../shared/processScenarios";
import { etchEvidence, etchSignals } from "../shared/etchScenario";
import { waferInspectionComparison, waferRegions } from "../shared/waferInspection";

const read = (path: string) => readFileSync(path, "utf8");
describe("merge BAZE workspaces with prompt-only missing connections", () => {
  it.each(["ko", "en", "ja"] as const)("keeps data markers separate from physical structure in %s", language => {
    const sample = processSample(getProcessScenario("packaging")!, "connection", 56);
    const html = renderToStaticMarkup(createElement(RecordBand, { sample, title: "Selected", language }));
    for (const key of ["time", "value", "reference", "low", "high"] as const) expect(html).toContain(`data-${key}="${sample[key]}"`);
    expect(html).toContain('aria-labelledby='); expect(html).toContain('stroke-dasharray="4 3"');
    expect(html).toContain('>80.0<'); expect(html).toContain('>120.0<');
    expect(html).not.toMatch(/NaN|Infinity|<animate|<image/);
  });
  it.each(etchSignals)("controlled etch $id matches its original observed record", ({ id }) => {
    const html = renderToStaticMarkup(createElement(EtchChamberConcept, { time: 180, observedUntil: 39, language: "en", signal: id, onSignalChange: vi.fn() }));
    const record = etchEvidence(180, 39).find(row => row.id === id)!;
    expect(html).toContain(`${record.value.toFixed(1)} / ${record.reference.toFixed(1)}`);
    expect(html).toContain('39s'); expect(html).not.toContain('180s');
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(1);
    expect(html).toContain("Location and chart change together");
  });
  it.each(["connection", "appearance"] as const)("controlled metal %s uses original same-time sample", signal => {
    const html = renderToStaticMarkup(createElement(MetalLayerConcept, { time: 54, language: "en", signal, onSignalChange: vi.fn() }));
    const record = processSample(getProcessScenario("metal")!, signal, 54);
    expect(html).toContain(`${record.value.toFixed(1)} / ${record.reference.toFixed(1)}`);
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(1);
  });
  it("keeps two separate deposition records and classifier when graph selection is linked", () => {
    const html = renderToStaticMarkup(createElement(DepositionWorkspace, { time: 48, language: "en", selectedSignal: "electrical", onSignalChange: vi.fn(), onInteraction: vi.fn() }));
    expect(html.match(/data-selected="true"/g)).toHaveLength(1);
    expect(html.match(/<option/g)).toHaveLength(3); expect(html.match(/<button/g)).toHaveLength(5);
    expect(html).toContain("not evidence that they concern the same wafer");
  });
  it.each([0, 55, 56, 70, 81, 82, 90])("packaging appearance does not erase connection evidence at %s", time => {
    const html = renderToStaticMarkup(createElement(PackagingObservationWorkspace, { time, language: "en", signal: "appearance" }));
    const sample = processSample(getProcessScenario("packaging")!, "appearance", time);
    expect(html).toContain(`data-value="${sample.value}"`);
    expect(html).toContain(`data-time="${time}"`);
    expect(html).toContain('Connection evidence, preserved independently');
    expect(html).toContain(time < 56 ? "No band exit observed yet" : "First band exit: 56s");
    expect(html).toContain(time < 82 ? "has not yet been observed" : "First return inside: 82s");
  });
  it("fixed index axes contain all original wafer/EDS/package records without inferring units", () => {
    for (let time = 0; time <= 90; time++) {
      for (const process of ["eds", "packaging"] as const) for (const signal of getProcessScenario(process)!.signals) {
        const sample = processSample(getProcessScenario(process)!, signal.id, time);
        expect(sample.value).toBeGreaterThanOrEqual(80); expect(sample.value).toBeLessThanOrEqual(120);
      }
      for (const region of waferRegions) {
        const samples = waferInspectionComparison(region, time);
        for (const sample of [samples.surface, samples.thickness]) {
          expect(sample.value).toBeGreaterThanOrEqual(80); expect(sample.value).toBeLessThanOrEqual(120);
        }
      }
    }
  });
  it("places original workspaces before optional full graph; does not mount EDS/package twice", () => {
    const page = read("client/src/pages/ProcessTraining.tsx");
    expect(page.indexOf('<OxidationWorkspace language=')).toBeLessThan(page.indexOf('>{recordChart}</details>'));
    expect(page).toContain('scenario.processId === "oxidation" ? <ProcessRecordContext');
    expect(page).toContain('onInteraction={pauseObservationView} selectedSignal={signalId}');
    expect(page).toContain('setInspectionSelection(Math.min(time, attempt.elapsed))');
    const etch = read("client/src/pages/EtchTraining.tsx");
    expect(etch).toContain('signal={selected} onSignalChange={signal => { setRunning(false); setSelected(signal); }}');
    expect(etch).toContain('signal={reviewSignal} until={reviewTime}');
    expect(etch).toContain('setSelected("pressure"); setReviewSignal("pressure");');
    expect(etch).toContain('setReviewSignal("pressure"); setReviewTime(time);');
    expect(etch).toContain('ETCH_DURATION');
  });
  it("keeps view state out of persistence, scoring and AI contracts", () => {
    for (const file of ["RecordBand", "EdsObservationWorkspace", "PackagingObservationWorkspace", "MetalLayerConcept", "EtchChamberConcept"]) {
      expect(read(`client/src/components/${file}.tsx`)).not.toMatch(/\bfetch\(|trpc|sessionStorage|localStorage|useEffect|dangerouslySetInnerHTML/);
    }
    for (const file of ["shared/trainingRecord.ts", "shared/trainingDraft.ts", "shared/judgmentCoach.ts"]) expect(read(file)).not.toMatch(/reviewSignal|selectedSignal|localSignal|RecordBand/);
    const css = read("client/src/components/process-studio.css");
    for (const token of ["min-height:44px", ":focus-visible", "prefers-reduced-motion:reduce", "@media(max-width:760px)"]) expect(css).toContain(token);
  });
});
