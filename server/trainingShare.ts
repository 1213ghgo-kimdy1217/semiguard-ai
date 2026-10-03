import { createHmac } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getProcessScenario } from "../shared/processScenarios";
import { toTrainingRecord } from "../shared/trainingRecord";
import { ENV } from "./_core/env";
import { getTrainingAttempt } from "./trainingRecords";

const scope = "semiguard-choice-share-v1";
const lifetime = 7 * 24 * 60 * 60;
const choicesSchema = z.object({ scenarioId: z.string().max(64), signal: z.string().max(32),
  onset: z.number().int(), marker: z.number().int().nullable(), comparison: z.string().max(32), certainty: z.string().max(32) }).strict();
const key = () => {
  if (!ENV.cookieSecret) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Sharing is unavailable." });
  // Domain separation: a shared learning token cannot become a sign-in session.
  return createHmac("sha256", ENV.cookieSecret).update(scope).digest();
};
function sanitize(raw: unknown) {
  const choices = choicesSchema.parse(raw);
  const scenario = getProcessScenario(choices.scenarioId);
  if (!scenario || scenario.id !== choices.scenarioId) throw new Error("Unknown module");
  const { scenarioId: _id, ...rest } = choices;
  return toTrainingRecord(scenario.processId === "etch"
    ? { ...rest, elapsed: scenario.duration, submitted: true }
    : { ...choices, elapsed: scenario.duration, submitted: true });
}

export async function signSharedChoices(raw: unknown, now = Math.floor(Date.now() / 1000)) {
  const record = sanitize(raw);
  const { scenarioId, signal, onset, marker, comparison, certainty } = record;
  const token = await new SignJWT({ choices: { scenarioId, signal, onset, marker, comparison, certainty } })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" }).setIssuer(scope).setAudience(scope)
    .setIssuedAt(now).setExpirationTime(now + lifetime).sign(key());
  return { token, expiresAt: new Date((now + lifetime) * 1000).toISOString() };
}

export async function shareTrainingAttempt(userId: number, id: number) {
  const record = await getTrainingAttempt(userId, id);
  if (!record) throw new TRPCError({ code: "NOT_FOUND", message: "Record not available." });
  const { scenarioId, signal, onset, marker, comparison, certainty } = record;
  return signSharedChoices({ scenarioId, signal, onset, marker, comparison, certainty });
}

export async function readSharedChoices(token: string, now = new Date()) {
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ["HS256"], issuer: scope, audience: scope, currentDate: now });
    if (typeof payload.iat !== "number" || typeof payload.exp !== "number" || payload.exp - payload.iat !== lifetime
      || payload.iat > Math.floor(now.getTime() / 1000)) throw new Error("Invalid lifetime");
    return { record: sanitize(payload.choices), expiresAt: new Date(payload.exp * 1000).toISOString() };
  } catch { throw new TRPCError({ code: "NOT_FOUND", message: "Shared link is invalid or expired." }); }
}
