import { etchSignals, type EtchSignal } from "./etchScenario";

// A repeatable, synthetic stream for open-ended practice. Scenario 01 never uses this generator.
const CYCLE_SECONDS = 240;
const CHART_POINT_LIMIT = 300;

function mix(seed: number, cycle: number) {
  let value = (seed ^ Math.imul(cycle + 1, 0x9e3779b1)) >>> 0;
  value = Math.imul(value ^ (value >>> 16), 0x7feb352d);
  value = Math.imul(value ^ (value >>> 15), 0x846ca68b);
  return (value ^ (value >>> 16)) >>> 0;
}

export function freePhase(time: number) {
  return time % CYCLE_SECONDS < 40 ? "A" : "B";
}

export function freeSignalSample(signal: EtchSignal, time: number, seed: number) {
  if (!Number.isSafeInteger(time) || time < 0 || !Number.isSafeInteger(seed) || seed < 1) {
    throw new Error("Invalid free-observation sample request.");
  }
  const index = etchSignals.findIndex(item => item.id === signal);
  if (index < 0) throw new Error("Unknown free-observation signal.");
  const cycle = Math.floor(time / CYCLE_SECONDS);
  const withinCycle = time % CYCLE_SECONDS;
  const phase = freePhase(time);
  const baseline = phase === "A" ? 80 : 100;
  const profile = mix(seed, cycle);
  const eventSignal = profile % (etchSignals.length + 1); // One profile has no excursion.
  const onset = 55 + (Math.floor(profile / 5) % 85);
  const duration = 50 + (Math.floor(profile / 425) % 45);
  const progress = (withinCycle - onset) / duration;
  const excursion = eventSignal === index && progress > 0 && progress < 1
    ? (9 + (Math.floor(profile / 19125) % 10)) * Math.sin(Math.PI * progress)
    : 0;
  const phaseOffset = (seed % 1009) / 1009;
  const reference = baseline + Math.sin(time * 0.19 + index + phaseOffset) * 0.5;
  const value = baseline + Math.sin(time * 0.27 + index + phaseOffset) * 0.7 + excursion;
  return { time, phase, reference, value, low: baseline - 4, high: baseline + 4 };
}

export function freeSignalSamples(signal: EtchSignal, until: number, seed: number, viewedAt = until) {
  if (!Number.isSafeInteger(until) || until < 0 || !Number.isSafeInteger(viewedAt) || viewedAt < 0 || viewedAt > until) {
    throw new Error("Invalid observation time.");
  }
  const start = Math.max(0, Math.min(viewedAt - Math.floor(CHART_POINT_LIMIT / 2), until - CHART_POINT_LIMIT));
  const end = Math.min(until, start + CHART_POINT_LIMIT);
  const samples = [];
  for (let time = start; time <= end; time++) samples.push(freeSignalSample(signal, time, seed));
  return samples;
}

export function freeEvidence(time: number, observedUntil: number, seed: number) {
  if (!Number.isSafeInteger(time) || time < 0 || !Number.isSafeInteger(observedUntil) || time > observedUntil) {
    throw new Error("Cannot inspect an unobserved time.");
  }
  return etchSignals.map(signal => {
    const sample = freeSignalSample(signal.id, time, seed);
    return { ...signal, ...sample, difference: sample.value - sample.reference };
  });
}
