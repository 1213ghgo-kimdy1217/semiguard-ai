import { getProcessScenario, processSample } from "./processScenarios";
import { referenceBandPosition } from "./inspectionEvidence";

const scenario = getProcessScenario("eds")!;
/** Region summaries are replay positions, not physical dies or equipment diagnoses. */
export function edsObservation(time: number, observedUntil: number) {
  const until = Math.min(processSample(scenario, "die", time).time,
    processSample(scenario, "die", observedUntil).time);
  return ["A", "B", "C"].flatMap((region, index) => {
    const start = index * 30;
    if (start > until) return [];
    const end = Math.min(index === 2 ? scenario.duration : start + 29, until);
    const die = processSample(scenario, "die", end);
    const comparison = processSample(scenario, "comparison", end);
    return [{ region, start, end, die, comparison,
      dieBand: referenceBandPosition(die), comparisonBand: referenceBandPosition(comparison) }];
  });
}
