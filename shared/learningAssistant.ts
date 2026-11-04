import { z } from "zod";
import { BOOTH_CONTROL_LIMITS, type BoothSnapshot } from "./boothExperience";

const value = (min: number, max: number) =>
  z.number().finite().min(min).max(max);
const boothValuesSchema = z
  .object({
    pressure: value(0, 1000),
    gasFlow: value(0, 1000),
    rfPower: value(0, 2000),
    chamberAmbientTemp: value(-20, 150),
  })
  .strict();
const boothAlarmsSchema = z
  .object({
    pressure: z.boolean(),
    gasFlow: z.boolean(),
    rfPower: z.boolean(),
    chamberAmbientTemp: z.boolean(),
  })
  .strict();
const control = (key: keyof typeof BOOTH_CONTROL_LIMITS) =>
  value(BOOTH_CONTROL_LIMITS[key].min, BOOTH_CONTROL_LIMITS[key].max);
/** Public screen state only. No model internals, camera, essays, or account records. */
export const boothLearningContextSchema = z
  .object({
    version: z.literal(1),
    scenarioId: z.enum([
      "rf-matching",
      "gas-delivery",
      "exhaust-restriction",
      "combined",
    ]),
    stage: z.enum(["brief", "experience", "review"]),
    mode: z.enum(["free", "mission"]),
    missionStatus: z.enum(["idle", "active", "won", "failed", "cancelled"]),
    elapsedMs: value(0, 86_400_000),
    remainingMs: value(0, 120_000),
    stableMs: value(0, 5000),
    matchingQuality: value(0, 1),
    values: boothValuesSchema,
    alarms: boothAlarmsSchema,
    controls: z
      .object({
        rfSetpoint: control("rfSetpoint"),
        gasSetpoint: control("gasSetpoint"),
        exhaustValve: control("exhaustValve"),
        matching: control("matching"),
      })
      .strict(),
    capturedAtMs: z.number().finite().int().positive(),
  })
  .strict()
  .superRefine((context, check) => {
    const age = Date.now() - context.capturedAtMs;
    if (age > 120_000 || age < -30_000)
      check.addIssue({
        code: "custom",
        path: ["capturedAtMs"],
        message: "Refresh the displayed simulation context before sending",
      });
    const expectedStatus =
      context.stage === "brief"
        ? ["idle"]
        : context.stage === "experience"
          ? context.mode === "mission"
            ? ["active"]
            : ["idle"]
          : context.mode === "mission"
            ? ["won", "failed", "cancelled"]
            : ["idle"];
    if (!expectedStatus.includes(context.missionStatus))
      check.addIssue({
        code: "custom",
        path: ["missionStatus"],
        message: "Stage and mission status do not match",
      });
  });
export type BoothLearningContext = z.infer<typeof boothLearningContextSchema>;
export function createBoothLearningContext(
  snapshot: BoothSnapshot,
  stage: BoothLearningContext["stage"],
  now = Date.now()
): BoothLearningContext {
  return boothLearningContextSchema.parse({
    version: 1,
    scenarioId: snapshot.selectedScenario,
    stage,
    mode: snapshot.mode,
    missionStatus: snapshot.mission.status,
    elapsedMs: snapshot.elapsedMs,
    remainingMs: snapshot.mission.remainingMs,
    stableMs: snapshot.mission.stableMs,
    matchingQuality: snapshot.matchingQuality,
    values: { ...snapshot.values },
    alarms: { ...snapshot.alarms },
    controls: { ...snapshot.controls },
    capturedAtMs: now,
  });
}

export const learningQuestionSchema = z
  .object({
    consent: z.literal(true),
    language: z.enum(["ko", "en", "ja"]),
    question: z.string().trim().min(2).max(800),
    boothContext: boothLearningContextSchema.optional(),
  })
  .strict();
export const learningAnswerSchema = z
  .object({
    answer: z.string().trim().min(10).max(1600),
    destination: z.enum(["training", "learn", "live", "dashboard", "none"]),
  })
  .strict();
export type LearningAssistantResult =
  | {
      status: "ready";
      provider: "nvidia";
      model: string;
      answer: string;
      destination: z.infer<typeof learningAnswerSchema>["destination"];
    }
  | {
      status: "unavailable";
      reason:
        | "not-configured"
        | "cooldown"
        | "provider-error"
        | "invalid-response";
    };
