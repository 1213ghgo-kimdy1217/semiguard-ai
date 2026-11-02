import { createHash } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import type { RequestHandler } from "express";
import { z } from "zod";
import { accountRecoveryLimits } from "../drizzle/schema";

export const RECOVERY_QA_DATABASE = "semiguard_recovery_qa_20261102";
export const RECOVERY_QA_BRANCH = "feat/account-recovery-20261101";
// A lifetime attempt budget, deliberately independent of API keys, accounts,
// recipients, application instances and fixed-window request counters.
export const RECOVERY_QA_MAIL_BUDGET_KEY = createHash("sha256")
  .update("semiguard-recovery-qa-mail-attempts-v1").digest("hex");
const budgetExpiry = new Date("2037-01-01T00:00:00.000Z");
type Environment = Record<string, string | undefined>;
type Database = MySql2Database<Record<string, unknown>>;

export type RecoveryQaChecks = {
  previewEnvironment: boolean;
  expectedBranch: boolean;
  connectionScope: boolean;
  verifiedTls: boolean;
};

/** Fixed boolean categories only. Never return actual environment/connection values. */
export function recoveryQaChecks(environment: Environment = process.env): RecoveryQaChecks {
  const checks: RecoveryQaChecks = {
    previewEnvironment: environment.VERCEL_ENV === "preview",
    expectedBranch: environment.VERCEL_GIT_COMMIT_REF === RECOVERY_QA_BRANCH,
    connectionScope: false,
    verifiedTls: false,
  };
  try {
    const url = new URL(environment.DATABASE_URL ?? "");
    // A URL query must not override mysql2's selected database or weaken TLS.
    const parameters = Array.from(url.searchParams);
    const sslParameters = parameters.filter(([key]) => key === "ssl");
    checks.connectionScope = url.protocol === "mysql:" && Boolean(url.hostname && url.username && url.password) && !url.hash
      && decodeURIComponent(url.pathname) === `/${RECOVERY_QA_DATABASE}` && parameters.length === 1 && sslParameters.length === 1;
    if (sslParameters.length !== 1) return checks;
    const ssl = JSON.parse(sslParameters[0][1]) as Record<string, unknown>;
    checks.verifiedTls = Boolean(ssl && typeof ssl === "object" && !Array.isArray(ssl)
      && ssl.rejectUnauthorized === true && ssl.verifyIdentity === true
      && Object.keys(ssl).every(key => ["rejectUnauthorized", "verifyIdentity", "ca"].includes(key)));
  } catch { /* A malformed value is classified without printing it or an error. */ }
  return checks;
}

/** No connection, environment file loading, logging or secret extraction. */
export function recoveryQaMode(environment: Environment = process.env): "off" | "enabled" | "invalid" {
  if (environment.SEMIGUARD_RECOVERY_QA !== "1") return "off";
  return Object.values(recoveryQaChecks(environment)).every(Boolean) ? "enabled" : "invalid";
}

// These two existing status queries can share a browser tRPC batch with auth.me.
// Measurement status reads a consent cookie only; withdrawal remains fail-closed
// when its other application tables are absent from the five-table QA schema.
const queries = new Set(["auth.me", "auth.withdrawalStatus", "practiceMeasurement.status", "accountRecovery.availability", "accountRecovery.status"]);
const mutations = new Set(["auth.login", "auth.logout", "accountRecovery.enroll", "accountRecovery.confirmEmail", "accountRecovery.request", "accountRecovery.reset"]);
export function recoveryQaRouteAllowed(path: string, method: string) {
  if (path === "/api/health") return method === "GET" || method === "HEAD";
  const match = /^\/api\/trpc\/([A-Za-z.]+(?:,[A-Za-z.]+)*)$/.exec(path);
  if (!match) return false;
  const procedures = match[1].split(",");
  if (procedures.length > 10) return false;
  if (method === "GET") return procedures.every(name => queries.has(name));
  // Recovery mutation handlers independently reject batches and require origin.
  return method === "POST" && procedures.length === 1 && mutations.has(procedures[0]);
}

/** Put after the maintenance barrier but before parsing or authentication. */
export const recoveryQaGate: RequestHandler = (req, res, next) => {
  const mode = recoveryQaMode();
  if (mode === "off") { next(); return; }
  const api = /^\/api(?:\/|$)/i.test(req.path);
  const storage = /^\/manus-storage(?:\/|$)/i.test(req.path);
  if (!api && !storage) { next(); return; }
  res.set("Cache-Control", "no-store");
  if (mode === "invalid") {
    const healthRead = req.path === "/api/health" && (req.method === "GET" || req.method === "HEAD");
    res.status(503).json({
      error: { code: "RECOVERY_QA_UNAVAILABLE", message: "The isolated recovery test environment is unavailable." },
      ...(healthRead ? { checks: recoveryQaChecks() } : {}),
    });
    return;
  }
  if (storage || !recoveryQaRouteAllowed(req.path, req.method)) {
    res.status(403).json({ error: { code: "RECOVERY_QA_SCOPE", message: "This operation is outside the isolated recovery test scope." } });
    return;
  }
  next();
};

export function recoveryQaMailAvailable(environment: Environment = process.env) {
  const mode = recoveryQaMode(environment);
  if (mode === "off") return true;
  return mode === "enabled" && z.email().safeParse(environment.RECOVERY_QA_RECIPIENT).success;
}

export async function reserveRecoveryQaMail(
  recipient: string,
  options: { environment?: Environment; database?: () => Promise<Database | null> } = {},
) {
  const environment = options.environment ?? process.env;
  const mode = recoveryQaMode(environment);
  if (mode === "off") return;
  const normalize = (value: string) => value.trim().toLowerCase();
  const expected = environment.RECOVERY_QA_RECIPIENT;
  if (mode !== "enabled" || !expected || !z.email().safeParse(expected).success
    || normalize(recipient) !== normalize(expected)) throw new Error("RECOVERY_QA_MAIL_BLOCKED");
  try {
    // Lazy import avoids opening/reading DB configuration on normal mail calls.
    const getDatabase = options.database ?? (async () => (await import("./db")).getDb());
    const database = await getDatabase();
    if (!database) throw new Error();
    await database.transaction(async tx => {
      // Defend against a wrongly reused pool as well as an incorrect URL.
      const [rows] = await tx.execute(sql`SELECT DATABASE() AS qa_database`);
      if ((rows as unknown as { qa_database?: string }[])[0]?.qa_database !== RECOVERY_QA_DATABASE) throw new Error();
      await tx.insert(accountRecoveryLimits).values({ key: RECOVERY_QA_MAIL_BUDGET_KEY, hits: 0, expiresAt: budgetExpiry })
        .onDuplicateKeyUpdate({ set: { key: sql`${accountRecoveryLimits.key}` } });
      const [row] = await tx.select({ hits: accountRecoveryLimits.hits }).from(accountRecoveryLimits)
        .where(eq(accountRecoveryLimits.key, RECOVERY_QA_MAIL_BUDGET_KEY)).limit(1).for("update");
      if (!row || !Number.isSafeInteger(row.hits) || row.hits < 0 || row.hits >= 6) throw new Error();
      await tx.update(accountRecoveryLimits).set({ hits: row.hits + 1 })
        .where(eq(accountRecoveryLimits.key, RECOVERY_QA_MAIL_BUDGET_KEY));
    });
    // Reservation commits before any provider request. Failure/timeouts still
    // consume an attempt, so retries cannot exceed the approved total.
  } catch { throw new Error("RECOVERY_QA_MAIL_BLOCKED"); }
}
