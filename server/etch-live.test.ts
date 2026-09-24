import { describe, expect, it } from "vitest";
import { addLiveNote } from "../shared/etchLive";

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
    expect(addLiveNote([], 1, 181, "pressure", "근거")).toEqual([]);
    expect(addLiveNote([], 1, 20, "pressure", " ")).toEqual([]);
    expect(addLiveNote([], 1, 20, "pressure", "a".repeat(1201))).toEqual([]);
  });
  it("limits notes to thirty and does not reuse remaining IDs after removal", () => {
    let notes = addLiveNote([], 0, 0, "pressure", "첫 기록");
    for (let i = 1; i < 30; i++) notes = addLiveNote(notes, 0, 0, "pressure", "기록");
    expect(addLiveNote(notes, 0, 0, "pressure", "초과")).toBe(notes);
    const next = addLiveNote(notes.slice(1), 0, 0, "pressure", "새 기록");
    expect(next.at(-1)?.id).toBe(31);
  });
});
