import { z } from "zod";
import { ETCH_DURATION, type EtchAttempt } from "./etchScenario";
import { getProcessScenario, type ProcessAttempt } from "./processScenarios";

export const coachDimensions = ["reference", "onset", "cross-sensor", "uncertainty", "checks"] as const;
export type CoachDimension = typeof coachDimensions[number];
export const coachStrengths = ["signal", "reference", "uncertainty"] as const;
export type CoachStrength = typeof coachStrengths[number];
const etchCoachRequestSchema = z.object({
  consent: z.literal(true),
  scenarioId: z.literal("etch-chamber-a-01"),
  language: z.enum(["ko", "en", "ja"]),
  elapsed: z.literal(ETCH_DURATION),
  submitted: z.literal(true),
  marker: z.number().int().min(0).max(ETCH_DURATION).nullable(),
  answer: z.object({
    signal: z.enum(["pressure", "flow", "rf", "temperature"]),
    onset: z.string().regex(/^(0|[1-9]\d{0,2})$/).refine(v => Number(v) <= ETCH_DURATION),
    comparison: z.enum(["same-phase", "whole-run"]),
    certainty: z.enum(["uncertain", "certain"]),
    facts: z.string().trim().min(10).max(1200),
    checks: z.string().trim().min(10).max(1200),
  }).strict(),
}).strict();
const processCoachRequestSchema = z.object({
  consent: z.literal(true), scenarioId: z.string().min(1).max(64), language: z.enum(["ko", "en", "ja"]),
  elapsed: z.literal(90), submitted: z.literal(true), marker: z.number().int().min(0).max(90).nullable(),
  answer: z.object({ signal: z.string().min(1).max(32),
    onset: z.string().regex(/^(none|0|[1-9]\d?)$/).refine(value => value === "none" || Number(value) <= 90),
    comparison: z.enum(["same-condition", "whole-run"]), certainty: z.enum(["uncertain", "certain"]),
    facts: z.string().trim().min(10).max(1200), checks: z.string().trim().min(10).max(1200),
  }).strict(),
}).strict().superRefine((request, context) => {
  const scenario = getProcessScenario(request.scenarioId);
  if (!scenario || scenario.id !== request.scenarioId || scenario.id === "etch-chamber-a-01" || scenario.duration !== request.elapsed) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["scenarioId"], message: "Unknown process scenario" });
  } else if (request.answer.signal !== "none" && !scenario.signals.some(signal => signal.id === request.answer.signal)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["answer", "signal"], message: "Unknown scenario signal" });
  }
  if ((request.answer.signal === "none") !== (request.answer.onset === "none")) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["answer", "onset"], message: "No-change choices must use no onset" });
  }
});
export const judgmentCoachRequestSchema = z.union([etchCoachRequestSchema, processCoachRequestSchema]);
export type JudgmentCoachRequest = z.infer<typeof judgmentCoachRequestSchema>;

// This is a separate, explicitly requested transmission, never part of record saving.
export function toJudgmentCoachRequest(attempt: EtchAttempt, language: "ko" | "en" | "ja") {
  return judgmentCoachRequestSchema.parse({ consent: true, scenarioId: "etch-chamber-a-01", language,
    elapsed: attempt.elapsed, submitted: attempt.submitted, marker: attempt.marker,
    answer: { signal: attempt.answer.signal, onset: attempt.answer.onset,
      comparison: attempt.answer.comparison, certainty: attempt.answer.certainty,
      facts: attempt.answer.facts, checks: attempt.answer.checks } });
}

export function toProcessJudgmentCoachRequest(attempt: ProcessAttempt, language: "ko" | "en" | "ja") {
  return processCoachRequestSchema.parse({ consent: true, scenarioId: attempt.scenarioId, language,
    elapsed: attempt.elapsed, submitted: attempt.submitted, marker: attempt.marker,
    answer: { signal: attempt.answer.signal, onset: attempt.answer.onset,
      comparison: attempt.answer.comparison, certainty: attempt.answer.certainty,
      facts: attempt.answer.facts, checks: attempt.answer.checks } });
}

export const coachEvidenceIds = ["phase-reference", "pressure-trend", "other-signals", "cause-unknown", "record-comparison"] as const;
export const judgmentCoachFeedbackSchema = z.object({
  strengths: z.array(z.enum(coachStrengths)).max(2),
  reflections: z.array(z.object({
    dimension: z.enum(coachDimensions),
    evidenceId: z.enum(coachEvidenceIds),
    answerQuote: z.string().trim().min(10).max(1200),
    question: z.string().trim().min(8).max(300),
  }).strict()).min(2).max(3),
}).strict();
export type JudgmentCoachFeedback = z.infer<typeof judgmentCoachFeedbackSchema>;
// The model supplies questions only. Original quotes and fixed choice labels are server-owned.
export const judgmentCoachModelFeedbackSchema = z.object({
  reflections: z.array(z.object({
    dimension: z.enum(coachDimensions), evidenceId: z.enum(coachEvidenceIds),
    answerSource: z.enum(["facts", "checks"]), question: z.string().trim().min(8).max(300),
  }).strict()).min(2).max(3),
}).strict();
export type JudgmentCoachResult = {
  status: "ready"; language: "ko" | "en" | "ja"; provider: "nvidia"; model: string;
  feedback: JudgmentCoachFeedback;
} | {
  status: "unavailable"; reason: "not-configured" | "provider-error" | "invalid-response" | "cooldown";
  retryAfterSeconds?: number;
};
