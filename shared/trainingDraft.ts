import { z } from "zod";
import { etchSignals, type EtchAttempt } from "./etchScenario";
import { getProcessScenario, type ProcessAttempt } from "./processScenarios";

export const draftScenarioSchema = z.string().max(64).refine(id => getProcessScenario(id)?.id === id);
export const trainingDraftSchema = z.object({
  version: z.literal(1), scenarioId: draftScenarioSchema,
  elapsed: z.number().int().min(0).max(180), marker: z.number().int().min(0).max(180).nullable(),
  stage: z.enum(["brief", "observe", "decision"]),
  signal: z.string().max(32), onset: z.string().max(4),
  comparison: z.enum(["", "same-phase", "same-condition", "whole-run"]),
  certainty: z.enum(["", "uncertain", "certain"]),
}).strict().superRefine((draft, ctx) => {
  const scenario = getProcessScenario(draft.scenarioId);
  if (!scenario) return;
  const etch = scenario.processId === "etch";
  const signals = etch ? etchSignals : scenario.signals;
  // Learners can write before observation ends. A decision checkpoint is not a submission.
  const invalid = draft.elapsed > scenario.duration || (draft.marker !== null && draft.marker > draft.elapsed)
    || (draft.signal !== "" && !(signals.some(s => s.id === draft.signal) || (!etch && draft.signal === "none")))
    || (draft.onset !== "" && !(draft.onset === "none" && draft.signal === "none")
      && (!/^(0|[1-9]\d{0,2})$/.test(draft.onset) || Number(draft.onset) > draft.elapsed))
    || (draft.signal === "none" && draft.onset !== "" && draft.onset !== "none")
    || (etch ? draft.comparison === "same-condition" : draft.comparison === "same-phase");
  if (invalid) ctx.addIssue({ code: "custom", message: "Invalid partial practice choices" });
});
export type TrainingDraft = z.infer<typeof trainingDraftSchema>;

/** An allowlist: never copy written answers, identity, scores, or submission state. */
export function toTrainingDraft(scenarioId: string, attempt: EtchAttempt | ProcessAttempt, stage: TrainingDraft["stage"]): TrainingDraft {
  return trainingDraftSchema.parse({ version: 1, scenarioId, elapsed: attempt.elapsed, marker: attempt.marker, stage,
    signal: attempt.answer.signal, onset: attempt.answer.onset, comparison: attempt.answer.comparison, certainty: attempt.answer.certainty });
}

export function restoreTrainingDraft(raw: unknown) {
  const draft = trainingDraftSchema.parse(raw);
  return { version: 1 as const, scenarioId: draft.scenarioId, elapsed: draft.elapsed, marker: draft.marker, submitted: false,
    answer: { signal: draft.signal, onset: draft.onset, comparison: draft.comparison, certainty: draft.certainty, facts: "", checks: "" } };
}
