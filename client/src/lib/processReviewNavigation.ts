import type { ProcessScenario } from "../../../shared/processScenarios";

/** View-only signal selection; never derive navigation from model prose. */
export function processReviewSignal(scenario: Pick<ProcessScenario, "signals">, preferred?: string): string {
  return scenario.signals.find(signal => signal.id === preferred)?.id ?? scenario.signals[0].id;
}

/** These authored follow-up events explicitly describe the other inspection. */
export function processEventReviewSignal(scenario: ProcessScenario, eventIndex: number): string {
  const secondary = eventIndex === 1 && ["wafer", "deposition", "metal"].includes(scenario.processId);
  return processReviewSignal(scenario, secondary ? scenario.signals[1]?.id : undefined);
}
