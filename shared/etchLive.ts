import { ETCH_DURATION, etchSignals, type EtchSignal } from "./etchScenario";

export type LiveNote = { id: number; time: number; recordedAt: number; signal: EtchSignal; text: string };
export type LiveSession = { version: 2; seed: number; elapsed: number; selected: EtchSignal; inspection: number | null; notes: LiveNote[] };
export const emptyLiveSession = (seed: number): LiveSession => ({ version: 2, seed, elapsed: 0, selected: "pressure", inspection: null, notes: [] });

export function restoreLiveSession(raw: string | null): LiveSession | null {
  if (!raw || raw.length > 1_000_000) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object") return null;
    const session = value as Record<string, unknown>;
    if (session.version !== 2 || !Number.isSafeInteger(session.seed) || (session.seed as number) < 1 ||
        !Number.isSafeInteger(session.elapsed) || (session.elapsed as number) < 0 ||
        !etchSignals.some(s => s.id === session.selected) ||
        (session.inspection !== null && (!Number.isSafeInteger(session.inspection) || (session.inspection as number) < 0 || (session.inspection as number) > (session.elapsed as number))) ||
        !Array.isArray(session.notes)) return null;
    const ids = new Set<number>();
    for (const item of session.notes) {
      if (!item || typeof item !== "object") return null;
      const note = item as Record<string, unknown>;
      if (!Number.isSafeInteger(note.id) || (note.id as number) < 1 || ids.has(note.id as number) ||
          !Number.isSafeInteger(note.time) || (note.time as number) < 0 ||
          !Number.isSafeInteger(note.recordedAt) || (note.recordedAt as number) < (note.time as number) || (note.recordedAt as number) > (session.elapsed as number) ||
          !etchSignals.some(s => s.id === note.signal) || typeof note.text !== "string" || !note.text.trim() || note.text.length > 1200) return null;
      ids.add(note.id as number);
    }
    return session as LiveSession;
  } catch { return null; }
}

export function addLiveNote(notes: LiveNote[], time: number, elapsed: number, signal: EtchSignal, text: string): LiveNote[] {
  if (!Number.isSafeInteger(elapsed) || elapsed < 0 ||
      !Number.isSafeInteger(time) || time < 0 || time > elapsed ||
      !etchSignals.some(s => s.id === signal) || !text.trim() || text.length > 1200) return notes;
  const nextId = notes.reduce((largest, note) => Math.max(largest, note.id), 0) + 1;
  return [...notes, { id: nextId, time, recordedAt: elapsed, signal, text: text.trim() }];
}

// The old fixed-trace session is never migrated onto a different signal. Export it instead.
export function restoreLegacyLiveSession(raw: string | null) {
  if (!raw || raw.length > 50_000) return null;
  try {
    const value = JSON.parse(raw);
    if (value?.version !== 1 || !Number.isInteger(value.elapsed) || value.elapsed < 0 || value.elapsed > ETCH_DURATION ||
      !Array.isArray(value.notes) || value.notes.length > 30 ||
      !value.notes.every((note: LiveNote) => Number.isSafeInteger(note.id) && Number.isInteger(note.time) && note.time >= 0 && note.time <= value.elapsed &&
        Number.isInteger(note.recordedAt) && note.recordedAt >= note.time && note.recordedAt <= value.elapsed &&
        etchSignals.some(signal => signal.id === note.signal) && typeof note.text === "string" && note.text.length <= 1200)) return null;
    return value as { version: 1; elapsed: number; notes: LiveNote[] };
  } catch { return null; }
}
