import { describe, expect, it } from "vitest";
import { getProcessScenario, processSample } from "./processScenarios";
import { oxidationComparison, photoObservation } from "./processObservation";

describe("read-only process-specific observation views", () => {
  it("keeps every oxidation value and matching reference identical to the saved/scored trace", () => {
    const scenario = getProcessScenario("oxidation")!;
    for (let time = 0; time <= scenario.duration; time++) {
      const view = oxidationComparison(time, "matching");
      expect(view.group).toBe(time < 30 ? "A" : "B");
      for (const record of view.records) {
        const sample = processSample(scenario, record.signal.id, time);
        expect(record.sample).toEqual(sample); expect(record.compared).toEqual(sample);
        expect(record.difference).toBe(sample.value - sample.reference);
        expect(sample.value).toBeGreaterThan(sample.low); expect(sample.value).toBeLessThan(sample.high);
      }
    }
    expect(scenario.expectedSignal).toBe("none"); expect(scenario.changeTime).toBeNull();
  });
  it("only offers a previously observed other-group reference and labels its source", () => {
    const early = oxidationComparison(29, "group-a");
    expect(early.otherGroupAvailable).toBe(false); expect(early.reference).toBe("matching");
    expect(early.referenceTime).toBe(29);
    const later = oxidationComparison(30, "group-a");
    expect(later.group).toBe("B"); expect(later.referenceGroup).toBe("A"); expect(later.referenceTime).toBe(29);
    expect(later.records[0].compared).toEqual(processSample(getProcessScenario("oxidation")!, "film", 29));
    expect(later.records[0].difference).toBeGreaterThan(17);
    expect(oxidationComparison(30, "matching").records[0].difference).toBeLessThan(1);
  });
  it.each([0, 31, 32, 44, 45, 90])("encodes photo time %s without changing its original position/shape records", time => {
    const scenario = getProcessScenario("photo")!;
    for (const signal of ["position", "shape"] as const) {
      const view = photoObservation(time, 10, signal);
      const sample = processSample(scenario, signal, time);
      for (const key of ["value", "reference", "time", "low", "high"] as const) expect(view.current[key]).toBe(sample[key]);
      expect(view.current.displayOffset).toBeCloseTo((sample.value - sample.reference) * 2);
      expect(view.pinned.time).toBe(Math.min(10, time));
    }
  });
  it("distinguishes the transient position difference from shape and the returned record", () => {
    const during = photoObservation(32, 31, "position");
    const after = photoObservation(45, 32, "position");
    expect(during.current.difference).toBeGreaterThan(10);
    expect(Math.abs(during.pinned.difference)).toBeLessThan(1);
    expect(after.pinned).toEqual(during.current);
    expect(Math.abs(after.current.difference)).toBeLessThan(1);
    expect(Math.abs(photoObservation(32, 31, "shape").current.difference)).toBeLessThan(1);
  });
  it.each([NaN, Infinity, -Infinity, -10, 1000, 31.8])("bounds synthetic snapshot input %s and never exposes a future pinned frame", time => {
    const oxidation = oxidationComparison(time, "group-a");
    expect(oxidation.time).toBeGreaterThanOrEqual(0); expect(oxidation.time).toBeLessThanOrEqual(90);
    expect(oxidation.referenceTime).toBeLessThanOrEqual(oxidation.time);
    const photo = photoObservation(time, 1000, "position");
    expect(photo.pinned.time).toBeLessThanOrEqual(photo.current.time);
    expect(photo.pinned.time).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(photo.current.displayOffset)).toBe(true);
    expect(photoObservation(45, time, "shape").pinned.time).toBeLessThanOrEqual(45);
  });
});
