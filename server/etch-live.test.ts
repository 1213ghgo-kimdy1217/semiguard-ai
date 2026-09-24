import { describe, expect, it } from "vitest";
import { addLiveNote, emptyLiveSession, restoreLiveSession } from "../shared/etchLive";

describe("free observation notes", () => {
  it("keeps selected time separate from recording time and permits repeated notes", () => {
    const first = addLiveNote([], 5, 20, "pressure", "같은 단계와 비교");
    const second = addLiveNote(first, 5, 25, "flow", "다른 센서도 비교");
    expect(first).toHaveLength(1);
    expect(second).toHaveLength(2);
    expect(second[1]).toMatchObject({ id: 2, time: 5, recordedAt: 25, signal: "flow" });
  });
  it("rejects future, invalid, empty and oversized notes", () => {
    for (const t of [-1, 21, 1.5, NaN]) expect(addLiveNote([], t, 20, "pressure", "근거")).toEqual([]);
    expect(addLiveNote([], 1, 181, "pressure", "근거")).toHaveLength(1);
    expect(addLiveNote([], 1, 20, "pressure", " ")).toEqual([]);
    expect(addLiveNote([], 1, 20, "pressure", "a".repeat(1201))).toEqual([]);
  });
  it("allows more than thirty notes and does not reuse remaining IDs after removal", () => {
    let notes = addLiveNote([], 0, 0, "pressure", "첫 기록");
    for (let i = 1; i < 30; i++) notes = addLiveNote(notes, 0, 0, "pressure", "기록");
    expect(addLiveNote(notes, 0, 0, "pressure", "추가 기록")).toHaveLength(31);
    const next = addLiveNote(notes.slice(1), 0, 0, "pressure", "새 기록");
    expect(next.at(-1)?.id).toBe(31);
  });
});

describe("free observation tab session", () => {
  it("restores a bounded run and its notes after a page reload", () => {
    const notes = addLiveNote([], 70, 95, "pressure", "같은 단계의 압력 기록을 비교합니다.");
    const session = { version: 2, seed: 1234, elapsed: 95, selected: "pressure", inspection: 70, notes };
    expect(restoreLiveSession(JSON.stringify(session))).toEqual(session);
    expect(emptyLiveSession(1234)).toEqual({ version: 2, seed: 1234, elapsed: 0, selected: "pressure", inspection: null, notes: [] });
  });

  it("rejects malformed or future observations instead of restoring them", () => {
    const valid = { version: 2, seed: 1234, elapsed: 95, selected: "pressure", inspection: 70, notes: addLiveNote([], 70, 95, "pressure", "근거") };
    for (const invalid of [
      null,
      "not json",
      JSON.stringify({ ...valid, version: 1 }),
      JSON.stringify({ ...valid, seed: 0 }),
      JSON.stringify({ ...valid, selected: "unknown" }),
      JSON.stringify({ ...valid, inspection: 96 }),
      JSON.stringify({ ...valid, notes: [{ ...valid.notes[0], time: 96 }] }),
      JSON.stringify({ ...valid, notes: [{ ...valid.notes[0], recordedAt: 69 }] }),
      JSON.stringify({ ...valid, notes: [valid.notes[0], valid.notes[0]] }),
      JSON.stringify({ ...valid, notes: [{ ...valid.notes[0], text: " " }] }),
    ]) expect(restoreLiveSession(invalid)).toBeNull();
  });
});
