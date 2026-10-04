import { getProcessScenario } from "./processScenarios";

type ReplayRecord = { scenarioId: string; signal: string; onset: number; marker: number | null };
export type TrainingReplayTarget = { source: "onset" | "marker" | "start"; time: number };

// Only canonical saved scenario IDs and bounded virtual times are navigation targets.
// Never infer an onset from the teaching answer, AI text or a no-deviation choice.
export function trainingReplay(record: ReplayRecord) {
  const scenario = getProcessScenario(record.scenarioId);
  if (!scenario || scenario.id !== record.scenarioId) return undefined;
  const savedSignal = scenario.signals.find(signal => signal.id === record.signal);
  const validTime = (time: number) => Number.isInteger(time) && time >= 0 && time <= scenario.duration;
  const targets: TrainingReplayTarget[] = [];
  if (savedSignal && validTime(record.onset)) targets.push({ source: "onset", time: record.onset });
  if (record.marker !== null && validTime(record.marker)) targets.push({ source: "marker", time: record.marker });
  targets.push({ source: "start", time: 0 });
  return { signalId: savedSignal?.id ?? scenario.signals[0].id, targets };
}
