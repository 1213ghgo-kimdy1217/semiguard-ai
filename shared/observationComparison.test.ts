import { describe, expect, it } from "vitest";
import { addComparisonTime, observationComparison, observedComparisonTimes } from "./observationComparison";
import { etchSample, type EtchSignal } from "./etchScenario";
import { processSample, processScenarios } from "./processScenarios";

describe("view-only observed comparison bookmarks", () => {
  it("deduplicates and sorts valid observed integer positions without mutating input", () => {
    const raw = Object.freeze([10, 1, 5, 5, 0.5, -1, NaN, Infinity, 91]);
    expect(observedComparisonTimes(raw, 10, 90)).toEqual([1, 5, 10]);
    expect(raw).toHaveLength(9);
  });
  it("does not substitute future or invalid input with an observed sample", () => {
    for (const requested of [11, 90, 2.5, NaN, Infinity, -1]) {
      expect(addComparisonTime([1, 5], requested, 10, 90)).toEqual([1, 5]);
    }
    expect(observedComparisonTimes([0, 1, 5], NaN, 90)).toEqual([0]);
    expect(observedComparisonTimes([1, 5, 10], -1, 90)).toEqual([]);
  });
  it("caps at three without silently replacing an existing bookmark", () => {
    expect(addComparisonTime([1, 5], 10, 12, 90)).toEqual([1, 5, 10]);
    expect(addComparisonTime([1, 5, 10], 12, 12, 90)).toEqual([1, 5, 10]);
    expect(addComparisonTime([1, 5], 5, 12, 90)).toEqual([1, 5]);
    expect(addComparisonTime([1, 5, 10], 91, 200, 90)).toEqual([1, 5, 10]);
  });
  it.each(processScenarios)("uses the existing $processId engine for every signal", scenario => {
    const before = JSON.stringify(scenario);
    for (const signal of scenario.signals) {
      const times = [0, Math.floor(scenario.duration / 2), scenario.duration];
      const records = observationComparison(scenario.id, signal.id, times, scenario.duration);
      expect(records.map(record => record.time)).toEqual(times);
      records.forEach((record, index) => {
        const original = scenario.processId === "etch" ? etchSample(signal.id as EtchSignal, times[index]) : processSample(scenario, signal.id, times[index]);
        expect(record).toMatchObject(original);
        expect(record.difference).toBe(original.value - original.reference);
        expect(record.band).toBe(original.value < original.low ? "below" : original.value > original.high ? "above" : "inside");
      });
      expect(observationComparison(scenario.id, signal.id, [0, scenario.duration], 10)).toHaveLength(1);
    }
    expect(JSON.stringify(scenario)).toBe(before);
  });
  it("labels changing normal contexts instead of treating raw increases as faults", () => {
    const oxide = observationComparison("oxidation", "film", [29, 30], 30);
    expect(oxide.map(record => record.context)).toEqual([{ kind: "group", value: "A" }, { kind: "group", value: "B" }]);
    expect(oxide.every(record => record.band === "inside")).toBe(true);
    const etch = observationComparison("etch", "pressure", [39, 40], 40);
    expect(etch.map(record => record.context)).toEqual([{ kind: "phase", value: "A" }, { kind: "phase", value: "B" }]);
    expect(etch.every(record => record.band === "inside")).toBe(true);
    expect(observationComparison("wafer", "surface", [1], 1)[0].context).toEqual({ kind: "location", value: "A3" });
    expect(observationComparison("eds", "die", [29, 30, 60], 60).map(record => record.context?.value)).toEqual(["A", "B", "C"]);
  });
  it("rejects unknown scenarios or signal IDs without producing evidence", () => {
    expect(observationComparison("unknown", "surface", [1], 10)).toEqual([]);
    expect(observationComparison("wafer", "pressure", [1], 10)).toEqual([]);
  });
});
