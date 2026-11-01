import { describe, expect, it, vi } from "vitest";
import { RECOVERY_QA_DATABASE, prepareRecoveryQaDatabase, recoveryQaBootstrapSql, runRecoveryQa, runRecoveryQaCli } from "../scripts/qa-account-recovery-tidb";

describe("isolated TiDB QA command safety", () => {
  it("keeps help and prepared SQL offline without reading environment values", async () => {
    const environment = new Proxy({}, { get: () => { throw new Error("No environment access expected"); } });
    const execute = vi.fn(); const write = vi.fn();
    expect(await runRecoveryQaCli([], environment, { write }, execute)).toBe(0);
    expect(await runRecoveryQaCli(["--help"], environment, { write }, execute)).toBe(0);
    expect(await runRecoveryQaCli(["--prepare-sql"], environment, { write }, execute)).toBe(0);
    expect(execute).not.toHaveBeenCalled();
    const sql = recoveryQaBootstrapSql();
    expect(sql).toContain(`USE \`${RECOVERY_QA_DATABASE}\``);
    expect([...sql.matchAll(/^CREATE TABLE (\w+)/gm)].map(match => match[1]).sort()).toEqual([
      "users", "account_revocations", "account_recovery_emails", "account_recovery_tokens", "account_recovery_limits",
    ].sort());
    expect(sql).toContain("ALTER TABLE users ADD COLUMN auth_version int NOT NULL DEFAULT 0");
    expect(sql).not.toMatch(/\b(?:INSERT|UPDATE|DELETE|DROP|TRUNCATE)\s+(?:INTO|FROM|TABLE|DATABASE)\b/i);
  });
  it("refuses production, Preview, missing and encoded-near-match DB names before invoking live work", async () => {
    const execute = vi.fn(); const write = vi.fn();
    for (const database of ["production", "preview", `${RECOVERY_QA_DATABASE}_extra`, ""]) {
      expect(await runRecoveryQaCli(["--run"], { DATABASE_URL: `mysql://synthetic-user:synthetic-password@example.invalid:4000/${database}`, RECOVERY_QA_EXPECTED_HOST: "example.invalid", RECOVERY_QA_EXPECTED_USER: "synthetic-user" }, { write }, execute)).toBe(1);
    }
    expect(await runRecoveryQaCli(["--run"], {}, { write }, execute)).toBe(1);
    expect(execute).not.toHaveBeenCalled();
    expect(write.mock.calls.every(([value]) => JSON.parse(value).checks.approvedQaDatabaseAndHost === false)).toBe(true);
  });
  it("requires explicit --run, passes verified TLS options, and emits only a boolean receipt", async () => {
    const write = vi.fn();
    const environment = { DATABASE_URL: `mysql://synthetic-user:synthetic-password@example.invalid:4000/${RECOVERY_QA_DATABASE}`, RECOVERY_QA_EXPECTED_HOST: "example.invalid", RECOVERY_QA_EXPECTED_USER: "synthetic-user" };
    const execute = vi.fn(async () => ({ passed: true, checks: { cleanupOwnedRows: true } }));
    expect(await runRecoveryQaCli(["--unknown"], environment, { write }, execute)).toBe(1);
    expect(execute).not.toHaveBeenCalled(); write.mockClear();
    expect(await runRecoveryQaCli(["--run"], environment, { write }, execute)).toBe(0);
    expect(execute).toHaveBeenCalledWith(expect.objectContaining({ database: RECOVERY_QA_DATABASE, ssl: { rejectUnauthorized: true, verifyIdentity: true } }));
    expect(JSON.parse(write.mock.calls[0][0])).toEqual({ passed: true, checks: { cleanupOwnedRows: true } });
    expect(write.mock.calls[0][0]).not.toMatch(/synthetic-user|synthetic-password|example\.invalid|semiguard_recovery_qa/);
  });
  it("never prints raw live-operation exceptions", async () => {
    const write = vi.fn();
    const environment = { DATABASE_URL: `mysql://synthetic-user:synthetic-password@example.invalid:4000/${RECOVERY_QA_DATABASE}`, RECOVERY_QA_EXPECTED_HOST: "example.invalid", RECOVERY_QA_EXPECTED_USER: "synthetic-user" };
    const execute = vi.fn(async () => { throw new Error("private-password private-host private-query"); });
    expect(await runRecoveryQaCli(["--run"], environment, { write }, execute)).toBe(1);
    expect(JSON.parse(write.mock.calls[0][0])).toEqual({ passed: false, checks: { qaCompleted: false } });
  });
  it("exports an environment-free private form API and checks the independently supplied host/user", async () => {
    const url = `mysql://synthetic-user:synthetic-password@example.invalid:4000/${RECOVERY_QA_DATABASE}`;
    const execute = vi.fn(async () => ({ passed: true, checks: { cleanupOwnedRows: true } }));
    expect((await runRecoveryQa(url, { expectedHost: "other.invalid", expectedUser: "synthetic-user" }, execute)).passed).toBe(false);
    expect((await runRecoveryQa(url, { expectedHost: "example.invalid", expectedUser: "other-user" }, execute)).passed).toBe(false);
    expect(execute).not.toHaveBeenCalled();
    expect((await runRecoveryQa(url, { expectedHost: "example.invalid", expectedUser: "synthetic-user" }, execute)).passed).toBe(true);
  });
  it("refuses to repair a partial QA schema or issue DDL to an unapproved host", async () => {
    const cluster = { execute: vi.fn(async () => [[{ present: 1 }], []] as const), query: vi.fn(async () => [[], []] as const), end: vi.fn(async () => {}) };
    const qa = { execute: vi.fn(async (sql: string) => sql.includes("AS matches") ? [[{ matches: 1 }], []] as const : [[{ name: "users" }], []] as const),
      query: vi.fn(async () => [[], []] as const), end: vi.fn(async () => {}) };
    const open = vi.fn().mockResolvedValueOnce(cluster).mockResolvedValueOnce(qa);
    const url = `mysql://synthetic-user:synthetic-password@example.invalid:4000/${RECOVERY_QA_DATABASE}`;
    expect((await prepareRecoveryQaDatabase(url, { expectedHost: "other.invalid", expectedUser: "synthetic-user" }, open)).passed).toBe(false);
    expect(open).not.toHaveBeenCalled();
    expect((await prepareRecoveryQaDatabase(url, { expectedHost: "example.invalid", expectedUser: "synthetic-user" }, open)).passed).toBe(false);
    expect(open.mock.calls[0][0].database).toBeUndefined();
    expect(open.mock.calls[1][0].database).toBe(RECOVERY_QA_DATABASE);
    expect(cluster.query).not.toHaveBeenCalled(); expect(qa.query).not.toHaveBeenCalled();
    expect(cluster.end).toHaveBeenCalledOnce(); expect(qa.end).toHaveBeenCalledOnce();
  });
  it("requires the separately pinned user even when host, database and URL credentials are otherwise valid", async () => {
    const environment = { DATABASE_URL: `mysql://synthetic-user:synthetic-password@example.invalid:4000/${RECOVERY_QA_DATABASE}`, RECOVERY_QA_EXPECTED_HOST: "example.invalid" };
    const execute = vi.fn(); const write = vi.fn(); const open = vi.fn();
    for (const expectedUser of [undefined, "", "other-user", " synthetic-user", "synthetic-user\n", "a".repeat(257)]) {
      expect(await runRecoveryQaCli(["--run"], { ...environment, RECOVERY_QA_EXPECTED_USER: expectedUser }, { write }, execute)).toBe(1);
      const target = { expectedHost: "example.invalid", expectedUser: expectedUser ?? "" };
      expect((await runRecoveryQa(environment.DATABASE_URL, target, execute)).passed).toBe(false);
      expect((await prepareRecoveryQaDatabase(environment.DATABASE_URL, target, open)).passed).toBe(false);
    }
    expect(execute).not.toHaveBeenCalled(); expect(open).not.toHaveBeenCalled();
    expect(write.mock.calls.every(([value]) => JSON.parse(value).checks.approvedQaDatabaseAndHost === false)).toBe(true);
    expect(write.mock.calls.flat().join(" ")).not.toMatch(/synthetic-user|synthetic-password|example\.invalid/);
  });
});
