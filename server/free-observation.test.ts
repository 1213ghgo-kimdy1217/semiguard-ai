import { describe, expect, it } from "vitest";
import { freeEvidence, freeSignalSample, freeSignalSamples } from "../shared/freeObservation";
import { etchSample } from "../shared/etchScenario";

describe("independent free-observation simulation", () => {
  it("is reproducible within a run but differs between runs", () => {
    expect(freeSignalSample("pressure", 90, 1234)).toEqual(freeSignalSample("pressure", 90, 1234));
    const first = ["pressure", "flow", "rf", "temperature"].map(signal =>
      freeSignalSamples(signal as "pressure" | "flow" | "rf" | "temperature", 180, 1234).map(row => row.value));
    const second = ["pressure", "flow", "rf", "temperature"].map(signal =>
      freeSignalSamples(signal as "pressure" | "flow" | "rf" | "temperature", 180, 5678).map(row => row.value));
    expect(second).not.toEqual(first);
  });

  it("continues beyond the training scenario and lets earlier windows be inspected", () => {
    const sample = freeSignalSample("flow", 3600, 1234);
    expect(sample.time).toBe(3600);
    const chart = freeSignalSamples("flow", 3600, 1234);
    expect(chart.at(-1)?.time).toBe(3600);
    expect(chart[0].time).toBe(3300);
    expect(chart.length).toBeLessThanOrEqual(302);
    expect(freeSignalSamples("flow", 3600, 1234, 120).map(row => row.time)).toEqual(expect.arrayContaining([120]));
    expect(freeSignalSamples("flow", 3600, 1234, 120).at(-1)?.time).toBe(300);
    expect(freeEvidence(3600, 3600, 1234)).toHaveLength(4);
  });

  it("does not borrow the fixed Scenario 01 pressure trace", () => {
    expect(freeSignalSample("pressure", 70, 1234).value).not.toBe(etchSample("pressure", 70).value);
  });
});
