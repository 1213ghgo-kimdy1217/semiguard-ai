import { describe, expect, it } from "vitest";
import { checkChoices, emptyAnswer, evaluateAnswer, evidenceChoices, isComplete, restoreAttempt, trainingSensors } from "../shared/trainingScenario";
const correct = () => ({ sensor: "vibration", onset: "6", certainty: "uncertain", evidence: evidenceChoices.slice(0, 2), order: [...checkChoices], explanation: "진동이 정상 상한보다 높고 지속 상승하지만 다른 센서는 정상 범위에 있어 원인을 확정할 수 없습니다." });
describe("Scenario 01", () => {
  it("shows selected time and does not mark alternative check orders wrong", () => {
    const rows = evaluateAnswer({ ...correct(), onset: "8", order: [...checkChoices].reverse() });
    expect(rows.find(r => r.label === "변화 시점 확인")?.selected).toBe("16분");
    expect(rows.find(r => r.label === "다음 확인 순서")?.ok).toBe(true);
    expect(rows.find(r => r.label === "다음 확인 순서")?.detail).toContain("정오를 판정하지 않습니다");
  });
  it("uses aligned deterministic samples and only vibration exceeds the baseline", () => {
    for (const s of trainingSensors) { expect(s.values).toHaveLength(13); if (s.id !== "vibration") expect(s.values.every(v => v >= s.range[0] && v <= s.range[1])).toBe(true); }
  });
  it("rejects incomplete and duplicate ordering", () => { expect(isComplete(emptyAnswer())).toBe(false); expect(isComplete({ ...correct(), order: Array(3).fill(checkChoices[0]) })).toBe(false); expect(() => evaluateAnswer(emptyAnswer())).toThrow(); });
  it("gives criterion feedback, not AI grading", () => { expect(evaluateAnswer(correct()).every(r => r.ok)).toBe(true); expect(evaluateAnswer({ ...correct(), certainty: "certain", onset: "0" }).filter(r => !r.ok)).toHaveLength(2); });
  it("restores only valid versioned records and never incomplete results", () => { expect(restoreAttempt("bad")).toBeNull(); expect(restoreAttempt(JSON.stringify({ version: 1, answer: emptyAnswer(), submitted: true }))?.submitted).toBe(false); expect(restoreAttempt(JSON.stringify({ version: 1, answer: correct(), submitted: true }))?.submitted).toBe(true); });
});
