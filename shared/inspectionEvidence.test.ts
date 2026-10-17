import { describe, expect, it } from "vitest";
import { depositionEvidence, metalObservation, referenceBandPosition } from "./inspectionEvidence";
import { getProcessScenario, processSample } from "./processScenarios";

describe("inspection evidence without new signals or scores", () => {
  it("classifies deposition claims using only each original inspection's own band", () => {
    const scenario = getProcessScenario("deposition")!;
    for (let time = 0; time <= scenario.duration; time++) {
      const film = depositionEvidence(time, "film-difference");
      expect(film.film).toEqual(processSample(scenario, "film", time));
      expect(film.electrical).toEqual(processSample(scenario, "electrical", time));
      expect(film.supportedBy).toBe(time >= 48 ? "film" : "insufficient");
      expect(depositionEvidence(time, "electrical-in-band").supportedBy).toBe("electrical");
      expect(depositionEvidence(time, "equipment-cause").supportedBy).toBe("insufficient");
    }
    expect(scenario.expectedSignal).toBe("film"); expect(scenario.changeTime).toBe(48);
  });
  it.each([0, 41, 42, 47, 48, 53, 54, 59, 60, 89, 90])("partitions only observed metal records through %s without duplicates", until => {
    const scenario = getProcessScenario("metal")!;
    const view = metalObservation(until, until);
    const rows = view.windows.flatMap(window => window.rows);
    expect(rows.map(row => row.time)).toEqual(Array.from({ length: until + 1 }, (_, index) => index));
    expect(view.windows.every(window => window.end <= until && window.rows.length <= 6)).toBe(true);
    expect(view.selected.end).toBe(until);
    for (const row of rows) {
      expect(row.connection).toEqual(processSample(scenario, "connection", row.time));
      expect(row.appearance).toEqual(processSample(scenario, "appearance", row.time));
    }
  });
  it("counts recurrence and temporary return rather than treating one inside-band interval as resolution", () => {
    const view = metalObservation(48, 59);
    const at = (start: number) => view.windows.find(window => window.start === start)!;
    expect(at(36).connectionOutside).toBe(0); expect(at(42).connectionOutside).toBe(6);
    expect(at(48).connectionOutside).toBe(0); expect(at(54).connectionOutside).toBe(6);
    expect(view.windows.every(window => window.appearanceOutside === 0)).toBe(true);
    expect(view.selected.start).toBe(48); expect(view.selectedTime).toBe(48);
    expect(view.until).toBe(59);
    expect(view.windows.flatMap(window => window.rows).every(row => row.time <= view.until)).toBe(true);
  });
  it.each([NaN, Infinity, -Infinity, -5, 1000, 48.8])("bounds snapshot and observation input %s", time => {
    const deposition = depositionEvidence(time, "film-difference");
    expect(deposition.time).toBeGreaterThanOrEqual(0); expect(deposition.time).toBeLessThanOrEqual(90);
    const metal = metalObservation(1000, time);
    expect(metal.until).toBeGreaterThanOrEqual(0); expect(metal.until).toBeLessThanOrEqual(90);
    expect(metal.selectedTime).toBeLessThanOrEqual(metal.until);
    expect(metal.windows.flatMap(window => window.rows).every(row => row.time <= metal.until)).toBe(true);
    expect(metalObservation(time, 41).selectedTime).toBeLessThanOrEqual(41);
  });
  it("treats boundary equality as inside, not a new out-of-band record", () => {
    const sample = { time: 0, value: 96, reference: 100, low: 96, high: 104 };
    expect(referenceBandPosition(sample)).toBe("inside");
    expect(referenceBandPosition({ ...sample, value: 104 })).toBe("inside");
    expect(referenceBandPosition({ ...sample, value: 95.9 })).toBe("below");
    expect(referenceBandPosition({ ...sample, value: 104.1 })).toBe("above");
  });
});
