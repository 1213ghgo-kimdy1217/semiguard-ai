import { describe, expect, it } from "vitest";
import { processScenarios } from "./processScenarios";
import { processProgress } from "./processProgress";

const ids = processScenarios.map(scenario => scenario.id);
const saved = (scenarioIds: readonly string[], userId = 42) => ({ userId, scenarioIds });

describe("owner-bound process submission path, not proficiency", () => {
  it("does not derive personal progress for a guest", () => {
    expect(processProgress(null, saved(ids))).toBeNull();
  });
  it("does not mistake an unloaded response for eight unsubmitted processes", () => {
    expect(processProgress(42, undefined)).toBeNull();
  });
  it("rejects a cached result belonging to a different account", () => {
    expect(processProgress(43, saved(ids))).toBeNull();
  });
  it("starts with wafer only after a valid empty personal response", () => {
    const progress = processProgress(42, saved([]))!;
    expect(progress.completed).toBe(0); expect(progress.total).toBe(8);
    expect(progress.next).toBe(processScenarios[0]);
    expect(progress.unsubmitted).toEqual(processScenarios);
  });
  it("counts unique recognized submissions in learning order", () => {
    const progress = processProgress(42, saved([ids[3], ids[0], ids[3], "unknown", ids[1], ids[2]]))!;
    expect(progress.completed).toBe(4); expect(progress.scenarioIds).toEqual(ids.slice(0, 4));
    expect(progress.unsubmitted).toEqual(processScenarios.slice(4));
    expect(progress.next).toBe(processScenarios[4]);
  });
  it("suggests the first missing process rather than the largest submitted index", () => {
    expect(processProgress(42, saved([ids[0], ids[2], ids[7]]))!.next).toBe(processScenarios[1]);
  });
  it("has no next unsubmitted process after all eight distinct submissions", () => {
    const progress = processProgress(42, saved([...ids, ...ids]))!;
    expect(progress.completed).toBe(8); expect(progress.unsubmitted).toEqual([]);
    expect(progress.next).toBeNull();
  });
  it("does not treat unknown identifiers as completed modules", () => {
    expect(processProgress(42, saved(["unknown"]))!.completed).toBe(0);
  });
  it("does not mutate the supplied progress or return personal identity", () => {
    const snapshot = Object.freeze({ userId: 42, scenarioIds: Object.freeze([ids[2], ids[0]]) });
    const result = processProgress(42, snapshot)!;
    expect(snapshot.scenarioIds).toEqual([ids[2], ids[0]]);
    expect(result).not.toHaveProperty("userId");
    expect(result.next).toBe(processScenarios[1]);
  });
});
