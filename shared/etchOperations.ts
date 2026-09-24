import { ETCH_DURATION, etchEvidence, etchSample, etchSignals, type EtchSignal } from "./etchScenario";

export const OPERATIONS_STEP = 3;
export const OPERATIONS_STORAGE_KEY = "semiguard.etch.operations.v1";
export function operationsStorageKey(userId: number) {
  if (!Number.isSafeInteger(userId) || userId <= 0) throw new Error("A valid user is required for observation storage.");
  return `${OPERATIONS_STORAGE_KEY}.user.${userId}`;
}

export type OperationsNote = {
  id: string;
  time: number;
  signal: EtchSignal;
  fact: string;
  possibility: string;
  nextCheck: string;
};

export type OperationsSession = {
  version: 1;
  elapsed: number;
  selected: EtchSignal;
  inspection: number | null;
  notes: OperationsNote[];
};

export const emptyOperationsSession = (): OperationsSession => ({
  version: 1, elapsed: 0, selected: "pressure", inspection: null, notes: [],
});

export const nextOperationsTime = (elapsed: number) =>
  Math.min(ETCH_DURATION, Math.max(0, elapsed) + OPERATIONS_STEP);

export function firstPersistentOutside(signal: EtchSignal, observedUntil: number) {
  const end = Math.min(ETCH_DURATION, Math.max(0, Math.floor(observedUntil / OPERATIONS_STEP) * OPERATIONS_STEP));
  let streak = 0;
  let start: number | null = null;
  let phase = "";
  for (let time = 0; time <= end; time += OPERATIONS_STEP) {
    const sample = etchSample(signal, time);
    const outside = sample.value < sample.low || sample.value > sample.high;
    if (outside) {
      streak = sample.phase === phase ? streak + 1 : 1;
      start = streak === 1 ? time : start;
      if (streak >= 3) return start;
    } else {
      streak = 0;
      start = null;
    }
    phase = sample.phase;
  }
  return null;
}

export function operationsEvidence(time: number, observedUntil: number) {
  return etchEvidence(time, observedUntil).map(row => ({
    ...row,
    outside: row.value < row.low || row.value > row.high,
  }));
}

export function validOperationsNote(note: OperationsNote, observedUntil: number) {
  return typeof note.id === "string" && note.id.length > 0 && note.id.length <= 100 &&
    Number.isInteger(note.time) && note.time >= 0 && note.time <= observedUntil && note.time % OPERATIONS_STEP === 0 &&
    etchSignals.some(signal => signal.id === note.signal) &&
    typeof note.fact === "string" && note.fact.trim().length >= 10 && note.fact.length <= 600 &&
    [note.possibility, note.nextCheck].every(value => typeof value === "string" && value.length <= 600);
}

export function restoreOperationsSession(raw: string | null): OperationsSession | null {
  try {
    const value = JSON.parse(raw || "null");
    if (value?.version !== 1 || !Number.isInteger(value.elapsed) || value.elapsed < 0 ||
      value.elapsed > ETCH_DURATION || value.elapsed % OPERATIONS_STEP !== 0 ||
      !etchSignals.some(signal => signal.id === value.selected) ||
      !(value.inspection === null || Number.isInteger(value.inspection) && value.inspection >= 0 && value.inspection <= value.elapsed && value.inspection % OPERATIONS_STEP === 0) ||
      !Array.isArray(value.notes) || value.notes.length > 30 ||
      !value.notes.every((note: OperationsNote) => validOperationsNote(note, value.elapsed)) ||
      new Set(value.notes.map((note: OperationsNote) => note.id)).size !== value.notes.length) return null;
    return value;
  } catch { return null; }
}
