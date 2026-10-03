import { z } from "zod";

export const learningQuestionSchema = z.object({
  consent: z.literal(true),
  language: z.enum(["ko", "en", "ja"]),
  question: z.string().trim().min(2).max(800),
}).strict();
export const learningAnswerSchema = z.object({
  answer: z.string().trim().min(10).max(1600),
  destination: z.enum(["training", "learn", "live", "dashboard", "none"]),
}).strict();
export type LearningAssistantResult =
  | { status: "ready"; provider: "nvidia"; model: string; answer: string; destination: z.infer<typeof learningAnswerSchema>["destination"] }
  | { status: "unavailable"; reason: "not-configured" | "cooldown" | "provider-error" | "invalid-response" };
