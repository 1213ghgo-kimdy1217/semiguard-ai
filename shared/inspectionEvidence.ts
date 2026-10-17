import { getProcessScenario, processSample, processSamples } from "./processScenarios";

export type EvidenceClaim = "film-difference" | "electrical-in-band" | "equipment-cause";
export type EvidenceSource = "film" | "electrical" | "insufficient";
type InspectionSample = ReturnType<typeof processSample>;
const deposition = getProcessScenario("deposition")!;
const metal = getProcessScenario("metal")!;
export function referenceBandPosition(sample: InspectionSample): "below" | "inside" | "above" {
  return sample.value < sample.low ? "below" : sample.value > sample.high ? "above" : "inside";
}

/** Only supplied synthetic records support these claims, never equipment causes. */
export function depositionEvidence(time: number, claim: EvidenceClaim) {
  const film = processSample(deposition, "film", time);
  const electrical = processSample(deposition, "electrical", time);
  const supportedBy: EvidenceSource = claim === "equipment-cause" ? "insufficient"
    : claim === "film-difference" ? referenceBandPosition(film) === "inside" ? "insufficient" : "film"
    : referenceBandPosition(electrical) === "inside" ? "electrical" : "insufficient";
  return { time: film.time, film, electrical, supportedBy };
}

/** Group already-observed integer replay positions; no interpolation or prediction. */
export function metalObservation(time: number, observedUntil: number) {
  const connection = processSamples(metal, "connection", observedUntil);
  const appearance = processSamples(metal, "appearance", observedUntil);
  const until = connection[connection.length - 1].time;
  const selectedTime = Math.min(until, processSample(metal, "connection", time).time);
  const windows = [];
  for (let start = 0; start <= until; start += 6) {
    const end = Math.min(start + 5, until);
    const rows = connection.slice(start, end + 1).map(sample => ({
      time: sample.time, connection: sample, appearance: appearance[sample.time],
      connectionBand: referenceBandPosition(sample), appearanceBand: referenceBandPosition(appearance[sample.time]),
    }));
    windows.push({ start, end, rows,
      connectionOutside: rows.filter(row => row.connectionBand !== "inside").length,
      appearanceOutside: rows.filter(row => row.appearanceBand !== "inside").length,
    });
  }
  return { until, selectedTime, windows, selected: windows[Math.floor(selectedTime / 6)] };
}
