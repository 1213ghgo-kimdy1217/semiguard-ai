import { createServer, type Server } from "node:http";
import express from "express";
import type { MySql2Database } from "drizzle-orm/mysql2";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RECOVERY_QA_BRANCH, RECOVERY_QA_DATABASE, RECOVERY_QA_MAIL_BUDGET_KEY, recoveryQaChecks, recoveryQaGate, recoveryQaMailAvailable, recoveryQaMode, recoveryQaRouteAllowed, reserveRecoveryQaMail } from "./recoveryQa";
import { sendRecoveryMail } from "./recoveryMail";

const mockedDb = vi.hoisted(() => ({ open: vi.fn() }));
vi.mock("./db", () => ({ getDb: mockedDb.open }));

const qaEnvironment = () => ({
  SEMIGUARD_RECOVERY_QA: "1", VERCEL_ENV: "preview", VERCEL_GIT_COMMIT_REF: RECOVERY_QA_BRANCH,
  DATABASE_URL: `mysql://synthetic:synthetic@db.example.invalid:4000/${RECOVERY_QA_DATABASE}?ssl=${encodeURIComponent(JSON.stringify({ rejectUnauthorized: true, verifyIdentity: true }))}`,
  RECOVERY_QA_RECIPIENT: "qa@example.invalid",
});
let server: Server | undefined;
afterEach(async () => {
  vi.restoreAllMocks(); mockedDb.open.mockReset();
  vi.unstubAllEnvs(); vi.unstubAllGlobals();
  if (server) {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server!.close(error => error ? reject(error) : resolve()));
    server = undefined;
  }
});

describe("isolated Preview recovery scope", () => {
  it("leaves the normal application untouched unless the exact QA flag is set", () => {
    expect(recoveryQaMode({})).toBe("off");
    expect(recoveryQaMode({ SEMIGUARD_RECOVERY_QA: "true" })).toBe("off");
    expect(recoveryQaMode({ SEMIGUARD_RECOVERY_QA: "0" })).toBe("off");
    expect(recoveryQaMode(qaEnvironment())).toBe("enabled");
  });
  it.each([
    { VERCEL_ENV: "production" }, { VERCEL_ENV: "development" }, { VERCEL_GIT_COMMIT_REF: "main" },
    { DATABASE_URL: "mysql://synthetic:synthetic@db.example.invalid/semiguard_ai_final_20261101" },
    { DATABASE_URL: qaEnvironment().DATABASE_URL + "&database=semiguard_ai_final_20261101" },
    { DATABASE_URL: qaEnvironment().DATABASE_URL + "&ssl={}" },
    { DATABASE_URL: `mysql://synthetic:synthetic@db.example.invalid/${RECOVERY_QA_DATABASE}?ssl={"rejectUnauthorized":false,"verifyIdentity":true}` },
    { DATABASE_URL: `mysql://synthetic:synthetic@db.example.invalid/${RECOVERY_QA_DATABASE}` },
    { DATABASE_URL: "not-a-url" },
  ])("fails closed for a wrong environment, target or unsafe connection option", override => {
    expect(recoveryQaMode({ ...qaEnvironment(), ...override })).toBe("invalid");
  });
  it.each([
    [{ VERCEL_ENV: "private-environment-value" }, { previewEnvironment: false, expectedBranch: true, connectionScope: true, verifiedTls: true }],
    [{ VERCEL_GIT_COMMIT_REF: "private-branch-value" }, { previewEnvironment: true, expectedBranch: false, connectionScope: true, verifiedTls: true }],
    [{ DATABASE_URL: "" }, { previewEnvironment: true, expectedBranch: true, connectionScope: false, verifiedTls: false }],
    [{ DATABASE_URL: "private-malformed-url" }, { previewEnvironment: true, expectedBranch: true, connectionScope: false, verifiedTls: false }],
    [{ DATABASE_URL: qaEnvironment().DATABASE_URL.replace(RECOVERY_QA_DATABASE, "private-schema-value") }, { previewEnvironment: true, expectedBranch: true, connectionScope: false, verifiedTls: true }],
    [{ DATABASE_URL: qaEnvironment().DATABASE_URL + "&database=private-schema-value" }, { previewEnvironment: true, expectedBranch: true, connectionScope: false, verifiedTls: true }],
    [{ DATABASE_URL: qaEnvironment().DATABASE_URL + "&ssl={}" }, { previewEnvironment: true, expectedBranch: true, connectionScope: false, verifiedTls: false }],
    [{ DATABASE_URL: qaEnvironment().DATABASE_URL.replace(/ssl=.*/, "ssl=%7Bprivate-malformed-json") }, { previewEnvironment: true, expectedBranch: true, connectionScope: true, verifiedTls: false }],
    [{ DATABASE_URL: `mysql://synthetic:synthetic@db.example.invalid/${RECOVERY_QA_DATABASE}?ssl={"rejectUnauthorized":false,"verifyIdentity":true}` }, { previewEnvironment: true, expectedBranch: true, connectionScope: true, verifiedTls: false }],
    [{ DATABASE_URL: `mysql://synthetic:synthetic@db.example.invalid/${RECOVERY_QA_DATABASE}?ssl={"rejectUnauthorized":true,"verifyIdentity":true,"database":"private-schema-value"}` }, { previewEnvironment: true, expectedBranch: true, connectionScope: true, verifiedTls: false }],
  ])("classifies invalid QA configuration with only the four allowlisted booleans", (override, expected) => {
    const checks = recoveryQaChecks({ ...qaEnvironment(), ...override });
    expect(checks).toEqual(expected);
    expect(Object.keys(checks).sort()).toEqual(["connectionScope", "expectedBranch", "previewEnvironment", "verifiedTls"]);
    expect(Object.values(checks).every(value => typeof value === "boolean")).toBe(true);
    expect(JSON.stringify(checks)).not.toMatch(/private-|synthetic|example\.invalid|semiguard_recovery_qa/);
    expect(recoveryQaMode({ ...qaEnvironment(), ...override })).toBe("invalid");
  });
  it("accepts only approved procedures/methods and wholly permitted read batches", () => {
    expect(recoveryQaRouteAllowed("/api/health", "GET")).toBe(true);
    expect(recoveryQaRouteAllowed("/api/trpc/auth.me,accountRecovery.availability,accountRecovery.status", "GET")).toBe(true);
    expect(recoveryQaRouteAllowed("/api/trpc/auth.me,practiceMeasurement.status,auth.withdrawalStatus", "GET")).toBe(true);
    expect(recoveryQaRouteAllowed("/api/trpc/auth.login", "POST")).toBe(true);
    for (const path of ["/api/trpc/auth.signup", "/api/trpc/auth.withdraw", "/api/trpc/training.saveAttempt", "/api/trpc/learning.ask", "/api/oauth/callback", "/api/oauth/google/callback", "/api/trpc/auth.me,training.history", "/api/trpc/auth%2Eme", "/api/trpc/auth.me/", "/api//trpc/auth.me"]) {
      expect(recoveryQaRouteAllowed(path, "GET"), path).toBe(false);
      expect(recoveryQaRouteAllowed(path, "POST"), path).toBe(false);
    }
    expect(recoveryQaRouteAllowed("/api/trpc/auth.login,auth.logout", "POST")).toBe(false);
    expect(recoveryQaRouteAllowed("/api/trpc/accountRecovery.reset", "GET")).toBe(false);
  });
  it("blocks disallowed HTTP requests before JSON parsing or any downstream action", async () => {
    for (const [key, value] of Object.entries(qaEnvironment())) vi.stubEnv(key, value);
    const reached = vi.fn(); const app = express();
    app.use(recoveryQaGate); app.use(express.json());
    app.all("*", (_req, res) => { reached(); res.json({ reached: true }); });
    server = createServer(app);
    await new Promise<void>(resolve => server!.listen(0, "127.0.0.1", resolve));
    const address = server.address(); if (!address || typeof address === "string") throw new Error("test-port");
    const base = `http://127.0.0.1:${address.port}`;
    for (const path of ["/api/trpc/auth.signup", "/api/trpc/learning.ask", "/api/oauth/google/callback", "/manus-storage/private-object"]) {
      const response = await fetch(base + path, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{" });
      expect(response.status).toBe(403); expect(response.headers.get("cache-control")).toBe("no-store");
    }
    expect(reached).not.toHaveBeenCalled();
    expect((await fetch(base + "/api/trpc/auth.me,accountRecovery.availability")).status).toBe(200);
    expect((await fetch(base + "/login")).status).toBe(200);
    expect(reached).toHaveBeenCalledTimes(2);
    vi.stubEnv("VERCEL_ENV", "production");
    const invalidHealth = await fetch(base + "/api/health");
    expect(invalidHealth.status).toBe(503);
    expect(await invalidHealth.json()).toEqual({
      error: { code: "RECOVERY_QA_UNAVAILABLE", message: "The isolated recovery test environment is unavailable." },
      checks: { previewEnvironment: false, expectedBranch: true, connectionScope: true, verifiedTls: true },
    });
    const headHealth = await fetch(base + "/api/health", { method: "HEAD" });
    expect(headHealth.status).toBe(503); expect(await headHealth.text()).toBe("");
    for (const [path, method] of [["/api/trpc/auth.me", "GET"], ["/api/trpc/auth.login", "POST"], ["/api/health", "POST"], ["/manus-storage/private-object", "GET"]]) {
      const blocked = await fetch(base + path, { method });
      expect(blocked.status).toBe(503);
      expect(Object.keys(await blocked.json())).toEqual(["error"]);
    }
    expect(reached).toHaveBeenCalledTimes(2);
    expect(mockedDb.open).not.toHaveBeenCalled();
    vi.stubEnv("SEMIGUARD_RECOVERY_QA", "0");
    expect((await fetch(base + "/api/trpc/ordinary-unrelated-query")).status).toBe(200);
  });
});

// This models transaction serialization/rollback for unit tests. The separate
// approved TiDB harness must verify actual database concurrency and atomicity.
function budgetDatabase(selectedDatabase = RECOVERY_QA_DATABASE) {
  let hits: number | null = null; let tail = Promise.resolve();
  const keys: string[] = []; let writes = 0;
  const database = {
    async transaction<T>(callback: (tx: unknown) => Promise<T>) {
      const previous = tail; let release!: () => void;
      tail = new Promise<void>(resolve => { release = resolve; }); await previous;
      let local = hits;
      const tx = {
        execute: async () => [[{ qa_database: selectedDatabase }]],
        insert: () => ({ values: (value: { key: string; hits: number; expiresAt: Date }) => ({ onDuplicateKeyUpdate: async () => {
          writes++; keys.push(value.key); expect(value.expiresAt.toISOString()).toBe("2037-01-01T00:00:00.000Z");
          if (local === null) local = value.hits;
        } }) }),
        select: () => ({ from: () => ({ where: () => ({ limit: () => ({ for: async () => local === null ? [] : [{ hits: local }] }) }) }) }),
        update: () => ({ set: (value: { hits: number }) => ({ where: async () => { writes++; local = value.hits; } }) }),
      };
      try { const result = await callback(tx); hits = local; return result; }
      finally { release(); }
    },
  } as unknown as MySql2Database<Record<string, unknown>>;
  return { database, hits: () => hits, writes: () => writes, keys };
}

describe("six-attempt durable QA mail reservation", () => {
  it("does not access any database for normal operation or a wrong/unconfigured QA recipient", async () => {
    const database = vi.fn();
    await reserveRecoveryQaMail("any@example.invalid", { environment: {}, database });
    expect(database).not.toHaveBeenCalled();
    expect(recoveryQaMailAvailable({})).toBe(true);
    expect(recoveryQaMailAvailable({ ...qaEnvironment(), RECOVERY_QA_RECIPIENT: "" })).toBe(false);
    for (const environment of [qaEnvironment(), { ...qaEnvironment(), RECOVERY_QA_RECIPIENT: "" }, { ...qaEnvironment(), VERCEL_ENV: "production" }]) {
      await expect(reserveRecoveryQaMail("other@example.invalid", { environment, database })).rejects.toThrow(/^RECOVERY_QA_MAIL_BLOCKED$/);
    }
    expect(database).not.toHaveBeenCalled();
  });
  it("reserves at most six attempts across concurrent callers and different key values", async () => {
    const f = budgetDatabase();
    const results = await Promise.allSettled(Array.from({ length: 12 }, (_, index) => reserveRecoveryQaMail("QA@EXAMPLE.INVALID", {
      environment: { ...qaEnvironment(), RECOVERY_MAIL_API_KEY: `synthetic-key-${index}` }, database: async () => f.database,
    })));
    expect(results.filter(item => item.status === "fulfilled")).toHaveLength(6);
    expect(results.filter(item => item.status === "rejected")).toHaveLength(6);
    expect(f.hits()).toBe(6); expect(new Set(f.keys)).toEqual(new Set([RECOVERY_QA_MAIL_BUDGET_KEY]));
    await expect(reserveRecoveryQaMail("qa@example.invalid", { environment: qaEnvironment(), database: async () => f.database })).rejects.toThrow(/^RECOVERY_QA_MAIL_BLOCKED$/);
    expect(f.hits()).toBe(6);
  });
  it("checks the actual selected database before writing and sanitizes failures", async () => {
    const wrong = budgetDatabase("semiguard_ai_final_20261101");
    await expect(reserveRecoveryQaMail("qa@example.invalid", { environment: qaEnvironment(), database: async () => wrong.database })).rejects.toThrow(/^RECOVERY_QA_MAIL_BLOCKED$/);
    expect(wrong.writes()).toBe(0);
    await expect(reserveRecoveryQaMail("qa@example.invalid", { environment: qaEnvironment(), database: async () => { throw new Error("private-driver-connection-details"); } })).rejects.toThrow(/^RECOVERY_QA_MAIL_BLOCKED$/);
  });
  it("counts failed provider attempts before dispatch and blocks a seventh attempt", async () => {
    for (const [key, value] of Object.entries(qaEnvironment())) vi.stubEnv(key, value);
    vi.stubEnv("SEMIGUARD_ACCOUNT_RECOVERY_ENABLED", "1"); vi.stubEnv("RECOVERY_MAIL_API_KEY", "synthetic-key");
    vi.stubEnv("RECOVERY_MAIL_FROM", "sender@example.invalid"); vi.stubEnv("RECOVERY_PUBLIC_ORIGIN", "https://example.invalid");
    const f = budgetDatabase(); mockedDb.open.mockResolvedValue(f.database);
    const provider = vi.fn().mockImplementation(async () => { expect(f.hits()).toBeGreaterThan(0); return new Response("private-detail", { status: 503 }); });
    vi.stubGlobal("fetch", provider);
    const mail = { to: "qa@example.invalid", language: "ko" as const, kind: "password" as const, token: "A".repeat(43) };
    for (let i = 0; i < 6; i++) await expect(sendRecoveryMail(mail)).rejects.toThrow(/^RECOVERY_MAIL_FAILED$/);
    expect(f.hits()).toBe(6);
    await expect(sendRecoveryMail(mail)).rejects.toThrow(/^RECOVERY_QA_MAIL_BLOCKED$/);
    expect(provider).toHaveBeenCalledTimes(6); expect(f.hits()).toBe(6);
  });
  it("rejects a different recipient before DB reservation or a provider call", async () => {
    for (const [key, value] of Object.entries(qaEnvironment())) vi.stubEnv(key, value);
    vi.stubEnv("SEMIGUARD_ACCOUNT_RECOVERY_ENABLED", "1"); vi.stubEnv("RECOVERY_MAIL_API_KEY", "synthetic-key");
    vi.stubEnv("RECOVERY_MAIL_FROM", "sender@example.invalid"); vi.stubEnv("RECOVERY_PUBLIC_ORIGIN", "https://example.invalid");
    const provider = vi.fn(); vi.stubGlobal("fetch", provider);
    await expect(sendRecoveryMail({ to: "another@example.invalid", language: "ko", kind: "id", loginId: "synthetic" })).rejects.toThrow(/^RECOVERY_QA_MAIL_BLOCKED$/);
    expect(mockedDb.open).not.toHaveBeenCalled(); expect(provider).not.toHaveBeenCalled();
  });
});
