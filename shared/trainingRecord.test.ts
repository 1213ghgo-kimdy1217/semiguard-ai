import { describe, expect, it } from "vitest";
import { ETCH_DURATION, emptyEtchAttempt } from "./etchScenario";
import { ETCH_SCENARIO_ID, toProcessTrainingSubmission, toTrainingRecord, toTrainingSubmission } from "./trainingRecord";
import { emptyProcessAttempt, processScenarios } from "./processScenarios";

const completed = () => ({ ...emptyEtchAttempt(), elapsed: ETCH_DURATION, submitted: true,
  answer: { signal: "pressure", onset: "70", comparison: "same-phase", certainty: "uncertain",
    facts: "압력이 같은 단계 기준보다 계속 높아집니다.", checks: "유량과 RF 추세를 먼저 비교하고 이력을 확인합니다." } });

describe("personal training record", () => {
  it("stores only validated choice-based results, not written answers", () => {
    const submission = toTrainingSubmission(completed());
    const record = toTrainingRecord(submission);
    expect(record).toMatchObject({ scenarioId: "etch-chamber-a-01", onset: 70, signalMatched: 1, onsetMatched: 1 });
    expect(JSON.stringify(submission)).not.toContain("압력이");
    expect(JSON.stringify(record)).not.toContain("압력이");
    expect(JSON.stringify(record)).not.toContain("유량과");
  });

  it("rejects unfinished or fabricated completion", () => {
    const submission = toTrainingSubmission(completed());
    expect(() => toTrainingRecord({ ...submission, elapsed: 20 })).toThrow();
    expect(() => toTrainingRecord({ ...submission, submitted: false })).toThrow();
    expect(() => toTrainingRecord({ ...submission, onset: 181 })).toThrow();
    expect(() => toTrainingRecord({ ...submission, facts: "never send this" })).toThrow();
  });

  it.each(processScenarios.filter(scenario => scenario.processId !== "etch"))("keeps $processId records choice-only under their stable scenario ID", scenario => {
    const attempt = { ...emptyProcessAttempt(scenario), elapsed: scenario.duration, submitted: true, marker: 45,
      answer: { signal: scenario.expectedSignal, onset: scenario.changeTime === null ? "none" : String(scenario.changeTime),
        comparison: "same-condition", certainty: "uncertain", facts: "Private written observation, never persisted.", checks: "Private written comparison plan, never persisted." } };
    const submission = toProcessTrainingSubmission(attempt);
    const record = toTrainingRecord(submission);
    expect(record).toMatchObject({ scenarioId: scenario.id, signalMatched: 1, onsetMatched: 1, comparisonMatched: 1, certaintyMatched: 1 });
    expect(record.onset).toBe(scenario.changeTime ?? -1);
    expect(JSON.stringify(submission)).not.toContain("Private written");
    expect(JSON.stringify(record)).not.toContain("Private written");
  });

  it("validates scenario-specific choices without requiring a correct answer or written text", () => {
    const scenario = processScenarios.find(item => item.processId === "wafer")!;
    const valid = { scenarioId: scenario.id, elapsed: 90, submitted: true, marker: null,
      signal: "thickness", onset: 5, comparison: "whole-run", certainty: "certain" };
    expect(toTrainingRecord(valid)).toMatchObject({ signalMatched: 0, onsetMatched: 0, comparisonMatched: 0, certaintyMatched: 0 });
    for (const changed of [{ scenarioId: "unknown" }, { scenarioId: "wafer" }, { scenarioId: ETCH_SCENARIO_ID },
      { signal: "pressure" }, { elapsed: 180 }, { marker: 91 }, { onset: 91 }, { onset: -1 },
      { signal: "none", onset: 20 }, { comparison: "same-phase" }, { userId: 1 }, { facts: "never persist" }]) {
      expect(() => toTrainingRecord({ ...valid, ...changed })).toThrow();
    }
    expect(toTrainingRecord({ ...valid, signal: "none", onset: -1 })).toMatchObject({ signal: "none", onset: -1, signalMatched: 0 });
  });
});
