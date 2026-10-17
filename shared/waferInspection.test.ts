import { describe, expect, it } from "vitest";
import { getProcessScenario, processSample } from "./processScenarios";
import { waferInspectionComparison, waferInspectionSample, waferRegions, WAFER_TRACE_REGION, type WaferRegion, type WaferInspectionSignal } from "./waferInspection";
import { restoreTrainingDraft, toTrainingDraft } from "./trainingDraft";
import { toProcessTrainingSubmission, toTrainingRecord } from "./trainingRecord";
import { emptyProcessAttempt } from "./processScenarios";

const scenario = getProcessScenario("wafer")!;
describe("authored wafer inspection map", () => {
  it("uses nine unique teaching regions", () => {
    expect(waferRegions).toHaveLength(9);
    expect(new Set(waferRegions).size).toBe(9);
    expect(WAFER_TRACE_REGION).toBe("A3");
  });
  it.each(["surface", "thickness"] as const)("preserves every existing A3 %s sample exactly", signal => {
    for (let time = 0; time <= scenario.duration; time++) {
      const original = processSample(scenario, signal, time);
      expect(waferInspectionSample("A3", signal, time)).toEqual({ ...original, difference: original.value - original.reference });
    }
  });
  it("keeps maps deterministic, snapshot-only and bounded to the existing replay", () => {
    for (const region of waferRegions) for (const signal of ["surface", "thickness"] as const) {
      for (const time of [0, 24, 25, 45, 90]) {
        const sample = waferInspectionSample(region, signal, time);
        expect(waferInspectionSample(region, signal, time)).toEqual(sample);
        expect(sample.time).toBe(time);
        expect(sample.difference).toBeCloseTo(sample.value - sample.reference, 10);
        expect(Object.values(sample).every(Number.isFinite)).toBe(true);
        expect(sample.low).toBeLessThan(sample.reference); expect(sample.reference).toBeLessThan(sample.high);
      }
      expect(waferInspectionSample(region, signal, 999).time).toBe(90);
      for (const time of [-1, Infinity, NaN]) expect(waferInspectionSample(region, signal, time).time).toBe(0);
      expect(waferInspectionSample(region, signal, 25.9).time).toBe(25);
    }
  });
  it("has no large surface deviation before the authored onset and concentrates the later surface difference spatially", () => {
    for (const region of waferRegions) for (let time = 0; time <= 25; time++) {
      expect(Math.abs(waferInspectionSample(region, "surface", time).difference)).toBeLessThan(1.1);
    }
    const comparison = waferInspectionComparison("B2", 90);
    expect(comparison.largestSurface.region).toBe("A3");
    expect(comparison.largestSurface.sample.difference).toBeGreaterThan(17);
    expect(Math.abs(comparison.surface.difference)).toBeLessThan(.3);
    expect(waferInspectionSample("B3", "surface", 90).difference).toBeGreaterThan(5);
    expect(waferInspectionSample("B3", "surface", 90).difference).toBeLessThan(comparison.largestSurface.sample.difference);
    for (const region of waferRegions) for (let time = 0; time <= 90; time++) {
      const thickness = waferInspectionSample(region, "thickness", time);
      expect(thickness.value).toBeGreaterThan(thickness.low); expect(thickness.value).toBeLessThan(thickness.high);
    }
  });
  it("compares only the requested snapshot, not the end-of-run answer", () => {
    for (const time of [0, 24, 25, 40, 90]) {
      const result = waferInspectionComparison("C1", time);
      expect(result.surface.time).toBe(time); expect(result.thickness.time).toBe(time);
      expect(result.largestSurface.sample.time).toBe(time);
      expect(result.surface).toEqual(waferInspectionSample("C1", "surface", time));
      const max = Math.max(...waferRegions.map(region => Math.abs(waferInspectionSample(region, "surface", time).difference)));
      expect(Math.abs(result.largestSurface.sample.difference)).toBeCloseTo(max, 10);
    }
  });
  it("rejects invented regions and inspection kinds", () => {
    expect(() => waferInspectionSample("A4" as WaferRegion, "surface", 90)).toThrow("Unknown wafer");
    expect(() => waferInspectionSample("B2", "pressure" as WaferInspectionSignal, 90)).toThrow("Unknown wafer");
  });
  it("does not change saved choices, scoring, written-answer privacy or checkpoint restoration", () => {
    const attempt = emptyProcessAttempt(scenario);
    attempt.elapsed = 90; attempt.submitted = true;
    attempt.answer = { signal: "surface", onset: "25", comparison: "same-condition", certainty: "uncertain", facts: "Private fictional answer for testing", checks: "Private fictional comparison plan" };
    const before = toProcessTrainingSubmission(attempt);
    for (const region of waferRegions) waferInspectionComparison(region, 90);
    expect(toProcessTrainingSubmission(attempt)).toEqual(before);
    expect(toTrainingRecord(before)).toMatchObject({ scenarioId: scenario.id, signalMatched: 1, onsetMatched: 1, comparisonMatched: 1, certaintyMatched: 1 });
    const draft = toTrainingDraft(scenario.id, attempt, "decision");
    expect(draft).not.toHaveProperty("region"); expect(before).not.toHaveProperty("region");
    expect(JSON.stringify(draft)).not.toContain("Private"); expect(JSON.stringify(before)).not.toContain("Private");
    expect(restoreTrainingDraft(draft).answer).toMatchObject({ signal: "surface", onset: "25", facts: "", checks: "" });
  });
});
