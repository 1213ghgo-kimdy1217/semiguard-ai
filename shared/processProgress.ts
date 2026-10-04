import { processScenarios } from "./processScenarios";

type SavedProcessProgress = { userId: number; scenarioIds: readonly string[] };

/** Submission history only: unknown accounts or identifiers never imply proficiency. */
export function processProgress(userId: number | null, saved?: SavedProcessProgress) {
  if (userId === null || saved?.userId !== userId) return null;
  const savedIds = new Set(saved.scenarioIds);
  const submitted = processScenarios.filter(scenario => savedIds.has(scenario.id));
  const unsubmitted = processScenarios.filter(scenario => !savedIds.has(scenario.id));
  return {
    completed: submitted.length,
    total: processScenarios.length,
    scenarioIds: submitted.map(scenario => scenario.id),
    unsubmitted,
    next: unsubmitted[0] ?? null,
  };
}
