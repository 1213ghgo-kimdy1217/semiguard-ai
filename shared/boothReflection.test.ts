import { describe, expect, it } from "vitest";
import { createBoothState, getBoothSnapshot } from "./boothExperience";
import {
  BOOTH_ATTEMPT_SAMPLE_LIMIT, BOOTH_REFLECTION_FIELD_LIMIT, BOOTH_REFLECTION_LIMIT, BOOTH_REFLECTION_STORAGE_KEY,
  captureBoothAttempt, createBoothReflectionRecord, emptyBoothReflectionFields, loadBoothReflections,
  readBoothAttempt, readBoothReflections, saveBoothReflection, validateBoothReflection,
} from "./boothReflection";

class MemoryStorage {
  data = new Map<string, string>();
  failRead = false; failWrite = false;
  getItem(key: string) { if (this.failRead) throw new Error("blocked"); return this.data.get(key) ?? null; }
  setItem(key: string, value: string) { if (this.failWrite) throw new Error("quota"); this.data.set(key, value); }
}
const fields = { observation: "유량과 압력이 먼저 낮아졌다.", reasoning: "유량을 조절한 뒤 배기 밸브로 압력을 맞췄다.", debrief: "다음에는 먼저 기준값과 변화 순서를 비교하겠다." };
function attempt(id = "attempt-1") {
  const snapshot = getBoothSnapshot(createBoothState());
  snapshot.elapsedMs = 6_000;
  snapshot.events = [
    { id: 1, atMs: 1000, type: "success", message: "지난 체험" },
    { id: 2, atMs: 2000, type: "success", message: "같은 시각의 지난 종료" },
    { id: 3, atMs: 2000, type: "mission", message: "이번 체험 시작" },
    { id: 4, atMs: 6000, type: "control", message: "가스 조절", control: "gasSetpoint", value: 105 },
  ];
  return { snapshot, captured: captureBoothAttempt({ id, scenarioId: "rf-matching", scenarioTitle: "RF 불안정 관찰", outcome: "ended", snapshot,
    startedAtMs: 2000, afterEventId: 2, durationMs: 4000, completedAt: "2026-11-05T01:00:00.000Z",
    samples: [1, 2, 3, 6, 6.1].map(elapsed => ({ elapsed, ...snapshot.values })),
  }) };
}

describe("finished booth evidence and reflection persistence", () => {
  it("captures only this run with relative timing and freezes detached evidence", () => {
    const { snapshot, captured } = attempt();
    expect(captured.events.map(item => [item.id, item.atMs])).toEqual([[3, 0], [4, 4000]]);
    expect(captured.samples.map(item => item.elapsed)).toEqual([0, 1, 4]);
    expect(captured.finalSnapshot.elapsedMs).toBe(4000);
    expect(captured.finalSnapshot.events).toEqual(captured.events);
    snapshot.values.rfPower = 1;
    snapshot.controls.gasSetpoint = 130;
    snapshot.events[2].message = "live engine changed";
    expect(captured.values.rfPower).toBe(500);
    expect(captured.controls.gasSetpoint).toBe(100);
    expect(captured.events[0].message).toBe("이번 체험 시작");
    expect(() => { captured.finalSnapshot.values.rfPower = 2; }).toThrow();
    expect(Object.isFrozen(captured.finalSnapshot.scenario.hints)).toBe(true);
    expect(Object.isFrozen(captured.samples[0])).toBe(true);
  });

  it("bounds long sample and event histories before storing a run", () => {
    const snapshot = getBoothSnapshot(createBoothState());
    snapshot.elapsedMs = 100_000;
    snapshot.events = Array.from({ length: 100 }, (_, i) => ({ id: i, atMs: i * 100, type: "control" as const, message: "조절" }));
    const captured = captureBoothAttempt({ id: "long", scenarioId: "combined", scenarioTitle: "복합 이상", outcome: "ended", snapshot,
      samples: Array.from({ length: 500 }, (_, i) => ({ elapsed: i / 10, ...snapshot.values })),
    });
    expect(captured.events).toHaveLength(50);
    expect(captured.samples).toHaveLength(BOOTH_ATTEMPT_SAMPLE_LIMIT);
    expect(captured.events[0].id).toBe(50);
  });

  it("restores draft text and exactly the same captured final values after reload", () => {
    const storage = new MemoryStorage(), { captured } = attempt();
    const draft = createBoothReflectionRecord(captured, { ...fields, debrief: "작성 중\n다음 확인" }, "draft", "2026-11-05T01:01:00.000Z");
    expect(saveBoothReflection(storage, draft).ok).toBe(true);
    const reloaded = loadBoothReflections(storage);
    expect(reloaded.issue).toBeNull();
    expect(reloaded.records[0].fields).toEqual(draft.fields);
    expect(reloaded.records[0].attempt.finalSnapshot.values).toEqual(captured.finalSnapshot.values);
    expect(reloaded.records[0].status).toBe("draft");
    expect(reloaded.records[0].submittedAt).toBeNull();
  });

  it("stores a submitted review and permits editing the same run without losing other runs", () => {
    const storage = new MemoryStorage();
    const first = attempt("first").captured, second = attempt("second").captured;
    expect(saveBoothReflection(storage, createBoothReflectionRecord(first, fields, "submitted")).ok).toBe(true);
    expect(saveBoothReflection(storage, createBoothReflectionRecord(second, emptyBoothReflectionFields(), "draft")).ok).toBe(true);
    const changed = { ...fields, debrief: "압력 회복 뒤 매칭도 확인한다." };
    expect(saveBoothReflection(storage, createBoothReflectionRecord(first, changed, "draft")).ok).toBe(true);
    const records = loadBoothReflections(storage).records;
    expect(records.map(item => item.attempt.id)).toEqual(["first", "second"]);
    expect(records[0].fields.debrief).toBe(changed.debrief);
    expect(records[0].status).toBe("draft");
    expect(records[1].fields).toEqual(emptyBoothReflectionFields());
  });

  it("retains the latest ten attempts rather than replacing another run's evidence", () => {
    const storage = new MemoryStorage();
    for (let i = 0; i < 12; i++) expect(saveBoothReflection(storage, createBoothReflectionRecord(attempt("run-" + i).captured, fields, "draft")).ok).toBe(true);
    const records = loadBoothReflections(storage).records;
    expect(records).toHaveLength(BOOTH_REFLECTION_LIMIT);
    expect(records[0].attempt.id).toBe("run-11");
    expect(records.at(-1)?.attempt.id).toBe("run-2");
  });

  it("reports blocked or quota storage without falsely claiming success or deleting previous data", () => {
    const storage = new MemoryStorage(), record = createBoothReflectionRecord(attempt().captured, fields, "draft");
    expect(saveBoothReflection(storage, record).ok).toBe(true);
    const original = storage.getItem(BOOTH_REFLECTION_STORAGE_KEY);
    storage.failWrite = true;
    expect(saveBoothReflection(storage, createBoothReflectionRecord(attempt("other").captured, fields, "submitted"))).toEqual({ ok: false, issue: "unavailable" });
    expect(storage.getItem(BOOTH_REFLECTION_STORAGE_KEY)).toBe(original);
    storage.failRead = true;
    expect(loadBoothReflections(storage)).toEqual({ records: [], issue: "unavailable" });
    expect(saveBoothReflection(storage, record)).toEqual({ ok: false, issue: "unavailable" });
  });

  it("fails closed for corrupt records, unknown scenarios and excessive documents", () => {
    const storage = new MemoryStorage();
    storage.setItem(BOOTH_REFLECTION_STORAGE_KEY, "broken");
    expect(saveBoothReflection(storage, createBoothReflectionRecord(attempt().captured, fields, "draft"))).toEqual({ ok: false, issue: "invalid" });
    expect(storage.getItem(BOOTH_REFLECTION_STORAGE_KEY)).toBe("broken");
    expect(readBoothAttempt({ ...attempt().captured, scenarioId: "unknown" })).toBeNull();
    expect(readBoothAttempt({ ...attempt().captured, outcome: "won", score: null })).toBeNull();
    expect(readBoothAttempt({ ...attempt().captured, finalSnapshot: { ...attempt().captured.finalSnapshot, lampBrightness: Infinity } })).toBeNull();
    expect(readBoothReflections("x".repeat(2_000_001)).issue).toBe("invalid");
  });

  it("requires short meaningful entries and bounds draft fields", () => {
    expect(validateBoothReflection(fields)).toEqual([]);
    expect(validateBoothReflection({ observation: "   ", reasoning: "...", debrief: "ok" })).toEqual(["observation", "reasoning", "debrief"]);
    const clipped = createBoothReflectionRecord(attempt().captured, { ...fields, observation: "가".repeat(4000) }, "draft");
    expect(clipped.fields.observation).toHaveLength(BOOTH_REFLECTION_FIELD_LIMIT);
    const storage = new MemoryStorage();
    expect(saveBoothReflection(storage, createBoothReflectionRecord(attempt().captured, emptyBoothReflectionFields(), "submitted"))).toEqual({ ok: false, issue: "invalid" });
  });
});
