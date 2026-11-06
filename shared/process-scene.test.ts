import { describe, expect, it } from "vitest";
import { etchSample, type EtchSignal } from "./etchScenario";
import { getProcessScenario, processSample, processScenarios } from "./processScenarios";
import { readProcessScene } from "./processScene";

describe("observed-only visual process records", () => {
  it.each(processScenarios)("keeps $processId scene readings identical to its existing record engine", scenario => {
    for (const requested of [0, 17, 29, 30, 32, 40, 48, 60, 70, scenario.duration]) {
      const time = Math.min(requested, scenario.duration);
      const scene = readProcessScene(scenario, time, scenario.duration);
      expect(scene.processId).toBe(scenario.processId);
      expect(scene.time).toBe(time);
      expect(scene.channels.map(channel => channel.id)).toEqual(scenario.signals.map(signal => signal.id));
      for (const channel of scene.channels) {
        const expected = scenario.processId === "etch"
          ? etchSample(channel.id as EtchSignal, time)
          : processSample(scenario, channel.id, time);
        for (const key of ["value", "reference", "low", "high"] as const) expect(channel[key]).toBe(expected[key]);
        const signal = scenario.signals.find(item => item.id === channel.id)!;
        expect(channel.name).toEqual(signal.name);
        expect(channel.location).toEqual(signal.location);
        expect(Number.isFinite(channel.delta)).toBe(true);
        expect(channel.delta).toBeGreaterThanOrEqual(-2);
        expect(channel.delta).toBeLessThanOrEqual(2);
      }
    }
  });

  it.each(processScenarios)("never reads an unobserved future point for $processId", scenario => {
    for (const observedUntil of [0, 13.9, 29, 39, Math.min(69, scenario.duration)]) {
      const observedTime = Math.floor(observedUntil);
      const future = readProcessScene(scenario, scenario.duration + 100, observedUntil);
      const observed = readProcessScene(scenario, observedTime, observedTime);
      expect(future).toEqual(observed);
      expect(future.time).toBeLessThanOrEqual(observedUntil);
    }
  });

  it.each([NaN, Infinity, -Infinity, -5, 11.8, 500])("bounds invalid or fractional requested time %s", requested => {
    for (const scenario of processScenarios) {
      const scene = readProcessScene(scenario, requested, 20);
      expect(Number.isInteger(scene.time)).toBe(true);
      expect(scene.time).toBeGreaterThanOrEqual(0);
      expect(scene.time).toBeLessThanOrEqual(20);
      for (const channel of scene.channels) for (const key of ["value", "reference", "low", "high", "delta"] as const) expect(Number.isFinite(channel[key])).toBe(true);
    }
  });

  it.each([NaN, Infinity, -Infinity, -4, 17.8, 10000])("bounds observation limit %s before computing a scene", observedUntil => {
    for (const scenario of processScenarios) {
      const scene = readProcessScene(scenario, scenario.duration, observedUntil);
      const cap = Number.isFinite(observedUntil) ? Math.max(0, Math.min(scenario.duration, Math.floor(observedUntil))) : 0;
      expect(scene.time).toBe(cap);
    }
  });

  it("keeps a normal oxidation group change tied to its matching reference", () => {
    const oxidation = getProcessScenario("oxidation")!;
    const before = readProcessScene(oxidation, 29, 90);
    const after = readProcessScene(oxidation, 30, 90);
    expect(after.channels[0].value - before.channels[0].value).toBeGreaterThan(15);
    expect(after.channels[0].reference - before.channels[0].reference).toBeGreaterThan(15);
    for (const scene of [before, after]) for (const channel of scene.channels) {
      expect(channel.value).toBeGreaterThan(channel.low);
      expect(channel.value).toBeLessThan(channel.high);
      expect(Math.abs(channel.delta)).toBeLessThan(0.2);
    }
  });

  it("uses the original etch phase baseline rather than the other-process engine", () => {
    const etch = getProcessScenario("etch")!;
    const phaseA = readProcessScene(etch, 39, 180);
    const phaseB = readProcessScene(etch, 40, 180);
    expect(phaseA.channels[0].low).toBe(76);
    expect(phaseB.channels[0].low).toBe(96);
    expect(readProcessScene(etch, 180, 39)).toEqual(phaseA);
  });

  it("does not turn visual selection data into answer keys or mutate scenarios", () => {
    for (const scenario of processScenarios) {
      const before = JSON.stringify(scenario);
      const scene = readProcessScene(scenario, scenario.duration, scenario.duration);
      for (const key of ["expectedSignal", "changeTime", "events", "objective", "criteria", "score", "correct", "answer"]) expect(scene).not.toHaveProperty(key);
      for (const channel of scene.channels) for (const key of ["expected", "correct", "fault", "severity", "answer"]) expect(channel).not.toHaveProperty(key);
      expect(JSON.stringify(scenario)).toBe(before);
    }
  });
});
