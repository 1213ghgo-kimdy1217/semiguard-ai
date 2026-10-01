import { z } from "zod";
import { ETCH_DURATION, type EtchAttempt } from "./etchScenario";

export const ETCH_SCENARIO_ID = "etch-chamber-a-01";

export function toTrainingSubmission(attempt: EtchAttempt) {
  return { elapsed: attempt.elapsed, submitted: attempt.submitted, marker: attempt.marker,
    signal: attempt.answer.signal, onset: Number(attempt.answer.onset),
    comparison: attempt.answer.comparison, certainty: attempt.answer.certainty };
}

const submissionSchema = z.object({
  elapsed: z.literal(ETCH_DURATION), submitted: z.literal(true),
  marker: z.number().int().min(0).max(ETCH_DURATION).nullable(),
  signal: z.enum(["pressure", "flow", "rf", "temperature"]),
  onset: z.number().int().min(0).max(ETCH_DURATION),
  comparison: z.enum(["same-phase", "whole-run"]),
  certainty: z.enum(["uncertain", "certain"]),
}).strict();

// Only choice-based practice results leave the browser. Free-text answers are never transmitted.
export function toTrainingRecord(raw: unknown) {
  const attempt = submissionSchema.parse(raw);
  return {
    scenarioId: ETCH_SCENARIO_ID,
    signal: attempt.signal,
    onset: attempt.onset,
    marker: attempt.marker,
    comparison: attempt.comparison,
    certainty: attempt.certainty,
    signalMatched: Number(attempt.signal === "pressure"),
    onsetMatched: Number(attempt.onset >= 65 && attempt.onset <= 80),
    comparisonMatched: Number(attempt.comparison === "same-phase"),
    certaintyMatched: Number(attempt.certainty === "uncertain"),
  };
}
