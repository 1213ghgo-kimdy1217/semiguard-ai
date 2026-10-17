import { getProcessScenario, processSample } from "./processScenarios";

export const waferRegions = ["A1", "A2", "A3", "B1", "B2", "B3", "C1", "C2", "C3"] as const;
export type WaferRegion = typeof waferRegions[number];
export type WaferInspectionSignal = "surface" | "thickness";
export const WAFER_TRACE_REGION: WaferRegion = "A3";
const scenario = getProcessScenario("wafer")!;
// Authored spatial teaching extension. A3 is exactly the existing saved/scored trace.
// Other regions illustrate location-matched comparisons, not actual die/metrology data.
const surfaceWeights: Record<WaferRegion, number> = {
  A1: 0, A2: .22, A3: 1, B1: 0, B2: 0, B3: .35, C1: 0, C2: 0, C3: 0,
};

export function waferInspectionSample(region: WaferRegion, signal: WaferInspectionSignal, time: number) {
  if (!waferRegions.includes(region) || !["surface", "thickness"].includes(signal)) throw new Error("Unknown wafer inspection location or signal.");
  const trace = processSample(scenario, signal, time);
  if (region === WAFER_TRACE_REGION) return { ...trace, difference: trace.value - trace.reference };
  const index = waferRegions.indexOf(region);
  const shift = (index - 4) * .15;
  const reference = trace.reference + shift;
  const weight = signal === "surface" ? surfaceWeights[region] : 0;
  const difference = (trace.value - trace.reference) * weight + Math.sin(trace.time * .13 + index) * .28;
  return { time: trace.time, value: reference + difference, reference,
    low: trace.low + shift, high: trace.high + shift, difference };
}

/** Only the supplied snapshot is compared. No future record or cause inference. */
export function waferInspectionComparison(region: WaferRegion, time: number) {
  const surface = waferInspectionSample(region, "surface", time);
  const thickness = waferInspectionSample(region, "thickness", time);
  const largestSurface = waferRegions.reduce((largest, candidate) => {
    const sample = waferInspectionSample(candidate, "surface", time);
    return Math.abs(sample.difference) > Math.abs(largest.sample.difference) ? { region: candidate, sample } : largest;
  }, { region: waferRegions[0] as WaferRegion, sample: waferInspectionSample(waferRegions[0], "surface", time) });
  return { region, surface, thickness, largestSurface };
}
