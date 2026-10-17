import { getProcessScenario, processSample } from "./processScenarios";

export type OxidationReference = "matching" | "group-a";
export type PhotoSignal = "position" | "shape";
const oxidation = getProcessScenario("oxidation")!;
const photo = getProcessScenario("photo")!;

/** Read-only views of the original teaching records. No new scored signals. */
export function oxidationComparison(time: number, requestedReference: OxidationReference) {
  const selectedTime = processSample(oxidation, "film", time).time;
  const switched = selectedTime >= oxidation.events[0].time;
  const reference = switched ? requestedReference : "matching";
  const referenceTime = reference === "group-a" ? oxidation.events[0].time - 1 : selectedTime;
  return {
    time: selectedTime, group: switched ? "B" : "A", reference,
    referenceGroup: reference === "group-a" ? "A" : switched ? "B" : "A",
    referenceTime, otherGroupAvailable: switched,
    records: oxidation.signals.map(signal => {
      const sample = processSample(oxidation, signal.id, selectedTime);
      const compared = processSample(oxidation, signal.id, referenceTime);
      return { signal, sample, compared, difference: sample.value - compared.reference };
    }),
  };
}

/** A diagram encoding, not physical pattern geometry or a reconstructed image. */
export function photoObservation(time: number, pinnedTime: number, signal: PhotoSignal) {
  const current = processSample(photo, signal, time);
  const boundedPin = Number.isFinite(pinnedTime) ? Math.max(0, Math.floor(pinnedTime)) : 0;
  const pinned = processSample(photo, signal, Math.min(current.time, boundedPin));
  const frame = (sample: typeof current) => ({
    ...sample, difference: sample.value - sample.reference,
    displayOffset: Math.max(-36, Math.min(36, (sample.value - sample.reference) * 2)),
  });
  return { signal, current: frame(current), pinned: frame(pinned) };
}
