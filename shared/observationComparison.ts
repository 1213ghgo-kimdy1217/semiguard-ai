import { etchSample, etchSignals, type EtchSignal } from "./etchScenario";
import { getProcessScenario, processSample } from "./processScenarios";

export const OBSERVATION_PIN_LIMIT = 3;
const horizon = (until: number, duration: number) => Math.max(0, Math.min(duration, Number.isFinite(until) ? Math.floor(until) : 0));

/** View-only bookmarks. Do not coerce a future request into an observed record. */
export function observedComparisonTimes(times: readonly number[], until: number, duration: number) {
  const end = horizon(until, duration);
  return Array.from(new Set(times.filter(time => Number.isInteger(time) && time >= 0 && time <= end)))
    .sort((a, b) => a - b).slice(0, OBSERVATION_PIN_LIMIT);
}

export function addComparisonTime(times: readonly number[], requested: number, until: number, duration: number) {
  const current = observedComparisonTimes(times, until, duration);
  if (!Number.isInteger(requested) || requested < 0 || requested > horizon(until, duration)
    || current.includes(requested) || current.length === OBSERVATION_PIN_LIMIT) return current;
  return [...current, requested].sort((a, b) => a - b);
}

/** Reuse authored records; no simulated physical geometry, scoring, or interpolation. */
export function observationComparison(scenarioId: string, signalId: string, times: readonly number[], until: number) {
  const scenario = getProcessScenario(scenarioId);
  if (!scenario || !scenario.signals.some(signal => signal.id === signalId)) return [];
  return observedComparisonTimes(times, until, scenario.duration).map(time => {
    const sample = scenario.processId === "etch"
      ? etchSample(etchSignals.find(signal => signal.id === signalId)!.id as EtchSignal, time)
      : processSample(scenario, signalId, time);
    const context = scenario.processId === "etch" ? { kind: "phase", value: time < 40 ? "A" : "B" }
      : scenario.processId === "oxidation" ? { kind: "group", value: time < 30 ? "A" : "B" }
      : scenario.processId === "eds" ? { kind: "region", value: time < 30 ? "A" : time < 60 ? "B" : "C" }
      : scenario.processId === "wafer" ? { kind: "location", value: "A3" } : null;
    return { ...sample, context, difference: sample.value - sample.reference,
      band: sample.value < sample.low ? "below" as const : sample.value > sample.high ? "above" as const : "inside" as const };
  });
}
