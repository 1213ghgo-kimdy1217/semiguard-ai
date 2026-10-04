import { describe, expect, it } from "vitest";
import { emptyEtchAttempt } from "./etchScenario";
import { emptyProcessAttempt, processScenarios } from "./processScenarios";
import { restoreTrainingDraft, toTrainingDraft, trainingDraftSchema } from "./trainingDraft";
import { toProcessTrainingSubmission, toTrainingRecord, toTrainingSubmission } from "./trainingRecord";

const draft = { version: 1, scenarioId: "etch-chamber-a-01", elapsed: 75, marker: 70,
  stage: "observe", signal: "pressure", onset: "70", comparison: "same-phase", certainty: "uncertain" };
describe("privacy-minimized checkpoints", () => {
  it.each(processScenarios)("supports partial choices for $processId without prose or submission", scenario => {
    const attempt = scenario.processId === "etch" ? emptyEtchAttempt() : emptyProcessAttempt(scenario);
    attempt.answer.facts = "private local draft"; attempt.answer.checks = "another private sentence";
    const result = toTrainingDraft(scenario.id, attempt, "brief");
    expect(JSON.stringify(result)).not.toContain("private");
    expect(result).not.toHaveProperty("submitted");
    const restored = restoreTrainingDraft(result);
    expect(restored.answer.facts).toBe(""); expect(restored.answer.checks).toBe("");
    expect(restored.submitted).toBe(false); expect(restored).not.toHaveProperty("saveKey");
  });
  it("bounds times, choices, stage and ownership-shaped extras", () => {
    for (const invalid of [{ ...draft, userId: 2 }, { ...draft, facts: "secret" }, { ...draft, version: 2 },
      { ...draft, elapsed: 181 }, { ...draft, marker: 76 }, { ...draft, onset: "76" },
      { ...draft, onset: "-1" }, { ...draft, onset: "none" }, { ...draft, signal: "none" },
      { ...draft, stage: "review" }, { ...draft, comparison: "same-condition" },
      { ...draft, scenarioId: "wafer" }]) expect(trainingDraftSchema.safeParse(invalid).success).toBe(false);
    expect(trainingDraftSchema.safeParse(draft).success).toBe(true);
  });
  it("accepts coherent no-change choices only in process modules", () => {
    const scenario = processScenarios.find(s => s.processId === "oxidation")!;
    const valid = { ...draft, scenarioId: scenario.id, signal: "none", onset: "none", comparison: "same-condition" };
    expect(trainingDraftSchema.safeParse(valid).success).toBe(true);
    expect(trainingDraftSchema.safeParse({ ...valid, onset: "70" }).success).toBe(false);
  });
  it.each(processScenarios)("saves an unfinished decision screen for $processId, without prose or completion", scenario => {
    for (const elapsed of [0, 1, Math.floor(scenario.duration / 2), scenario.duration - 1, scenario.duration]) {
      const attempt = scenario.processId === "etch" ? emptyEtchAttempt() : emptyProcessAttempt(scenario);
      attempt.elapsed = elapsed; attempt.marker = elapsed;
      attempt.answer = { signal: scenario.signals[0].id, onset: String(elapsed),
        comparison: scenario.processId === "etch" ? "same-phase" : "same-condition", certainty: "uncertain",
        facts: "private unfinished draft", checks: "private unfinished comparison plan" };
      const saved = toTrainingDraft(scenario.id, attempt, "decision");
      expect(saved.stage).toBe("decision"); expect(saved.elapsed).toBe(elapsed);
      expect(JSON.stringify(saved)).not.toContain("private");
      const restored = restoreTrainingDraft(saved);
      expect(restored).toMatchObject({ elapsed, marker: elapsed, submitted: false,
        answer: { signal: scenario.signals[0].id, onset: String(elapsed), facts: "", checks: "" } });
      expect(restored).not.toHaveProperty("saveKey");
    }
  });
  it.each(processScenarios)("still rejects early final submission for $processId even with all choices", scenario => {
    if (scenario.processId === "etch") {
      const attempt = emptyEtchAttempt(); attempt.elapsed = 10; attempt.submitted = true;
      attempt.answer = { signal: "pressure", onset: "5", comparison: "same-phase", certainty: "uncertain", facts: "completed local prose", checks: "completed local comparison" };
      expect(() => toTrainingRecord(toTrainingSubmission(attempt))).toThrow();
    } else {
      const attempt = emptyProcessAttempt(scenario); attempt.elapsed = 10; attempt.submitted = true;
      attempt.answer = { signal: scenario.signals[0].id, onset: "5", comparison: "same-condition", certainty: "uncertain", facts: "completed local prose", checks: "completed local comparison" };
      expect(() => toTrainingRecord(toProcessTrainingSubmission(attempt))).toThrow();
    }
  });
  it("keeps unseen times, completed stages and identity/prose fields out of decision checkpoints", () => {
    const early = { ...draft, stage: "decision", elapsed: 10, marker: 5, onset: "5" };
    for (const extra of [{ marker: 11 }, { onset: "11" }, { elapsed: 181 }, { stage: "review" },
      { submitted: true }, { userId: 99 }, { facts: "private" }, { saveKey: "another-attempt" }]) {
      expect(trainingDraftSchema.safeParse({ ...early, ...extra }).success).toBe(false);
    }
  });
});
