import { describe, expect, it } from "vitest";
import { ETCH_DURATION, emptyEtchAttempt } from "./etchScenario";
import { toTrainingRecord, toTrainingSubmission } from "./trainingRecord";

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
});
