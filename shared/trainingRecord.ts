import { z } from "zod";
import { ETCH_DURATION, type EtchAttempt } from "./etchScenario";
import { getProcessScenario, processChoiceCriteria, type ProcessAttempt } from "./processScenarios";

export const ETCH_SCENARIO_ID = "etch-chamber-a-01";

export function toTrainingSubmission(attempt: EtchAttempt) {
  return { elapsed: attempt.elapsed, submitted: attempt.submitted, marker: attempt.marker,
    signal: attempt.answer.signal, onset: Number(attempt.answer.onset),
    comparison: attempt.answer.comparison, certainty: attempt.answer.certainty };
}

export function toProcessTrainingSubmission(attempt: ProcessAttempt) {
  return { scenarioId: attempt.scenarioId, elapsed: attempt.elapsed, submitted: attempt.submitted,
    marker: attempt.marker, signal: attempt.answer.signal,
    // -1 represents the learner's explicit "no deviation established" choice, not an observed time.
    onset: attempt.answer.onset === "none" ? -1 : Number(attempt.answer.onset),
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

const processSubmissionSchema = z.object({
  scenarioId: z.string().min(1).max(64), elapsed: z.literal(90), submitted: z.literal(true),
  marker: z.number().int().min(0).max(90).nullable(), signal: z.string().min(1).max(32),
  onset: z.number().int().min(-1).max(90),
  comparison: z.enum(["same-condition", "whole-run"]), certainty: z.enum(["uncertain", "certain"]),
}).strict().superRefine((attempt, context) => {
  const scenario = getProcessScenario(attempt.scenarioId);
  if (!scenario || scenario.id !== attempt.scenarioId || scenario.id === ETCH_SCENARIO_ID || scenario.duration !== attempt.elapsed) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["scenarioId"], message: "Unknown process scenario" });
  } else if (attempt.signal !== "none" && !scenario.signals.some(signal => signal.id === attempt.signal)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["signal"], message: "Unknown scenario signal" });
  }
  if ((attempt.signal === "none") !== (attempt.onset === -1)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["onset"], message: "No-change choices must use no onset" });
  }
});

// Record saving sends choices only. Optional AI coaching uses a separate explicit-consent request.
export function toTrainingRecord(raw: unknown) {
  if (raw && typeof raw === "object" && "scenarioId" in raw) {
    const attempt = processSubmissionSchema.parse(raw);
    const scenario = getProcessScenario(attempt.scenarioId)!;
    const criteria = processChoiceCriteria(scenario, { signal: attempt.signal,
      onset: attempt.onset === -1 ? "none" : String(attempt.onset), comparison: attempt.comparison,
      certainty: attempt.certainty });
    return { scenarioId: scenario.id, signal: attempt.signal, onset: attempt.onset,
      marker: attempt.marker, comparison: attempt.comparison, certainty: attempt.certainty, ...criteria };
  }
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
