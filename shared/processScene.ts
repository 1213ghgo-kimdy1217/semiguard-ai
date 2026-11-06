import { etchEvidence } from "./etchScenario";
import { processSample, type LocalizedText, type ProcessId, type ProcessScenario } from "./processScenarios";

export type ProcessSceneChannel = {
  id: string; name: LocalizedText; location: LocalizedText;
  value: number; reference: number; low: number; high: number; delta: number;
};
export type ProcessSceneState = { processId: ProcessId; time: number; channels: ProcessSceneChannel[] };
const bound = (value: number, maximum: number) => Number.isFinite(value) ? Math.max(0, Math.min(maximum, Math.floor(value))) : 0;

/** Read-only picture encodings of existing records, never a new scored simulation. */
export function readProcessScene(scenario: ProcessScenario, time: number, observedUntil: number): ProcessSceneState {
  const observed = bound(observedUntil, scenario.duration);
  const selected = bound(time, observed);
  const etch = scenario.processId === "etch" ? etchEvidence(selected, observed) : null;
  return {
    processId: scenario.processId, time: selected,
    channels: scenario.signals.map(signal => {
      const sample = etch ? etch.find(row => row.id === signal.id)! : processSample(scenario, signal.id, selected);
      return { id: signal.id, name: signal.name, location: signal.location,
        value: sample.value, reference: sample.reference, low: sample.low, high: sample.high,
        delta: Math.max(-2, Math.min(2, (sample.value - sample.reference) / Math.max(1, sample.high - sample.low))) };
    }),
  };
}
