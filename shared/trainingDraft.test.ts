import { describe, expect, it } from "vitest";
import { emptyEtchAttempt } from "./etchScenario";
import { emptyProcessAttempt, processScenarios } from "./processScenarios";
import { restoreTrainingDraft, toTrainingDraft, trainingDraftSchema } from "./trainingDraft";

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
      { ...draft, stage: "review" }, { ...draft, stage: "decision" }, { ...draft, comparison: "same-condition" },
      { ...draft, scenarioId: "wafer" }]) expect(trainingDraftSchema.safeParse(invalid).success).toBe(false);
    expect(trainingDraftSchema.safeParse(draft).success).toBe(true);
  });
  it("accepts coherent no-change choices only in process modules", () => {
    const scenario = processScenarios.find(s => s.processId === "oxidation")!;
    const valid = { ...draft, scenarioId: scenario.id, signal: "none", onset: "none", comparison: "same-condition" };
    expect(trainingDraftSchema.safeParse(valid).success).toBe(true);
    expect(trainingDraftSchema.safeParse({ ...valid, onset: "70" }).success).toBe(false);
  });
});
