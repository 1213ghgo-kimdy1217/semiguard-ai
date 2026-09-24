import { ETCH_DURATION, etchSignals, type EtchSignal } from "./etchScenario";

export type LiveNote = { id: number; time: number; recordedAt: number; signal: EtchSignal; text: string };
export type LiveSession = { version: 1; elapsed: number; selected: EtchSignal; inspection: number | null; notes: LiveNote[] };
export const emptyLiveSession = (): LiveSession => ({ version: 1, elapsed: 0, selected: "pressure", inspection: null, notes: [] });

export function restoreLiveSession(raw: string | null): LiveSession | null {
  if (!raw || raw.length > 50_000) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object") return null;
    const session = value as Record<string, unknown>;
    if (session.version !== 1 || !Number.isInteger(session.elapsed) || (session.elapsed as number) < 0 || (session.elapsed as number) > ETCH_DURATION ||
        !etchSignals.some(s => s.id === session.selected) ||
        (session.inspection !== null && (!Number.isInteger(session.inspection) || (session.inspection as number) < 0 || (session.inspection as number) > (session.elapsed as number))) ||
        !Array.isArray(session.notes) || session.notes.length > 30) return null;
    const ids = new Set<number>();
    for (const item of session.notes) {
      if (!item || typeof item !== "object") return null;
      const note = item as Record<string, unknown>;
      if (!Number.isSafeInteger(note.id) || (note.id as number) < 1 || ids.has(note.id as number) ||
          !Number.isInteger(note.time) || (note.time as number) < 0 ||
          !Number.isInteger(note.recordedAt) || (note.recordedAt as number) < (note.time as number) || (note.recordedAt as number) > (session.elapsed as number) ||
          !etchSignals.some(s => s.id === note.signal) || typeof note.text !== "string" || !note.text.trim() || note.text.length > 1200) return null;
      ids.add(note.id as number);
    }
    return session as LiveSession;
  } catch { return null; }
}

export function addLiveNote(notes: LiveNote[], time: number, elapsed: number, signal: EtchSignal, text: string): LiveNote[] {
  if (!Number.isInteger(elapsed) || elapsed < 0 || elapsed > ETCH_DURATION ||
      !Number.isInteger(time) || time < 0 || time > elapsed ||
      !etchSignals.some(s => s.id === signal) || !text.trim() || text.length > 1200 || notes.length >= 30) return notes;
  return [...notes, { id: Math.max(0, ...notes.map(n => n.id)) + 1, time, recordedAt: elapsed, signal, text: text.trim() }];
}
