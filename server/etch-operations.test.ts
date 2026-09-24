import { describe, expect, it } from "vitest";
import { emptyOperationsSession, firstPersistentOutside, nextOperationsTime, operationsEvidence, operationsStorageKey, restoreOperationsSession, validOperationsNote } from "../shared/etchOperations";

describe("etch observation workspace", () => {
  it("separates temporary observations by authenticated user", () => {
    expect(operationsStorageKey(1)).not.toBe(operationsStorageKey(2));
    expect(() => operationsStorageKey(0)).toThrow();
  });
  it("advances the simulated stream every three seconds without exceeding its duration", () => {
    expect(nextOperationsTime(0)).toBe(3);
    expect(nextOperationsTime(177)).toBe(180);
    expect(nextOperationsTime(180)).toBe(180);
  });

  it("treats the phase transition as normal and flags only a sustained observed deviation", () => {
    expect(firstPersistentOutside("pressure", 69)).toBeNull();
    expect(firstPersistentOutside("flow", 180)).toBeNull();
    const onset = firstPersistentOutside("pressure", 180);
    expect(onset).not.toBeNull();
    expect(onset!).toBeGreaterThan(70);
    expect(firstPersistentOutside("pressure", onset! + 3)).toBeNull();
    expect(firstPersistentOutside("pressure", onset! + 6)).toBe(onset);
  });

  it("compares only observed values with the same-phase reference", () => {
    expect(operationsEvidence(180, 45).every(row => row.time === 45 && row.phase === "B" && !row.outside)).toBe(true);
    const later = operationsEvidence(140, 140);
    expect(later.find(row => row.id === "pressure")?.outside).toBe(true);
    expect(later.filter(row => row.outside)).toHaveLength(1);
  });

  it("restores bounded local notes and rejects future or malformed records", () => {
    const note = { id: "note-1", time: 12, signal: "pressure" as const, fact: "같은 단계의 기록보다 압력이 높게 관찰됨", possibility: "원인 미확정", nextCheck: "다른 신호와 기록 확인" };
    expect(validOperationsNote(note, 12)).toBe(true);
    expect(validOperationsNote(note, 9)).toBe(false);
    expect(validOperationsNote({ ...note, time: 11 }, 12)).toBe(false);
    const session = { ...emptyOperationsSession(), elapsed: 12, notes: [note] };
    expect(restoreOperationsSession(JSON.stringify(session))).toEqual(session);
    expect(restoreOperationsSession(JSON.stringify({ ...session, elapsed: 11 }))).toBeNull();
    expect(restoreOperationsSession(JSON.stringify({ ...session, inspection: 11 }))).toBeNull();
    expect(restoreOperationsSession(JSON.stringify({ ...session, notes: [note, note] }))).toBeNull();
    expect(restoreOperationsSession("bad JSON")).toBeNull();
  });
});
