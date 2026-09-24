import { ETCH_DURATION, etchSignals, type EtchSignal } from "./etchScenario";

export type LiveNote = { id: number; time: number; recordedAt: number; signal: EtchSignal; text: string };
export function addLiveNote(notes: LiveNote[], time: number, elapsed: number, signal: EtchSignal, text: string): LiveNote[] {
  if (!Number.isInteger(elapsed) || elapsed < 0 || elapsed > ETCH_DURATION ||
      !Number.isInteger(time) || time < 0 || time > elapsed ||
      !etchSignals.some(s => s.id === signal) || !text.trim() || text.length > 1200 || notes.length >= 30) return notes;
  return [...notes, { id: Math.max(0, ...notes.map(n => n.id)) + 1, time, recordedAt: elapsed, signal, text: text.trim() }];
}
