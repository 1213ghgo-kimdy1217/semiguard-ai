import { drizzle } from "drizzle-orm/mysql2";
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ getDb: vi.fn() }));
vi.mock("./db", () => ({ getDb: mocks.getDb }));
vi.mock("./_core/env", () => ({ ENV: { cookieSecret: "synthetic-sql-adapter-test-secret" } }));
import { createRecoveryStore, getRecoveryStore } from "./accountRecoveryStore";

/** Real Drizzle SQL generation with a recording mysql2 connection, no sockets. */
function connection() {
  const statements: { sql: string; params: unknown[] }[] = [];
  let fail = false;
  const client = { query: vi.fn(async (query: any, params: unknown[] = []) => {
    const sql = typeof query === "string" ? query : query.sql;
    statements.push({ sql, params });
    if (fail) throw new Error("synthetic-private-database-error");
    if (/^select `hits`/.test(sql)) return [[[6]], []];
    return [[], []];
  }) };
  mocks.getDb.mockResolvedValue(drizzle(client as any));
  return { statements, client, fail: () => { fail = true; } };
}
beforeEach(() => vi.resetAllMocks());
describe("recovery MySQL storage adapter", () => {
  it("supports an explicitly supplied QA database and revocation digest without calling the application connection factory", async () => {
    const f = connection();
    const database = drizzle(f.client as any);
    mocks.getDb.mockClear();
    const subjectHash = vi.fn(() => "synthetic-run-owned-digest");
    const store = createRecoveryStore(database, subjectHash);
    expect(await store.revoked("local_qa_synthetic")).toBe(false);
    expect(subjectHash).toHaveBeenCalledWith("local_qa_synthetic");
    expect(f.statements[0].params).toEqual(["synthetic-run-owned-digest", 1]);
    expect(mocks.getDb).not.toHaveBeenCalled();
  });
  it("checks additive stores only with no-row SELECTs, never DDL or account records", async () => {
    const f = connection(); const store = await getRecoveryStore();
    expect(await store.ready()).toBe(true);
    expect(f.statements).toHaveLength(5);
    expect(f.statements.every(statement => /^SELECT .+ LIMIT 0$/.test(statement.sql))).toBe(true);
    f.fail(); expect(await store.ready()).toBe(false);
  });
  it("locks users/tokens explicitly and does not interpolate identity/token values", async () => {
    const f = connection(); const store = await getRecoveryStore();
    await store.transaction(async tx => { await tx.user(21, true); await tx.token("synthetic-token-hash", true); });
    expect(f.statements[0].sql).toBe("begin");
    const locked = f.statements.filter(statement => statement.sql.includes("for update"));
    expect(locked).toHaveLength(2);
    expect(locked[0].sql).toContain("from `users`"); expect(locked[1].sql).toContain("from `account_recovery_tokens`");
    expect(locked[0].params).toContain(21); expect(locked[1].params).toContain("synthetic-token-hash");
    expect(locked[1].sql).not.toContain("synthetic-token-hash");
    expect(f.statements.at(-1)?.sql).toBe("commit");
  });
  it("increments durable counters atomically and bounds expired cleanup", async () => {
    const f = connection(); const store = await getRecoveryStore(); const date = new Date("2026-11-01T04:00:00Z");
    expect(await store.transaction(tx => tx.hitLimit({ key: "synthetic-key", maximum: 5, expiresAt: date }))).toBe(false);
    expect(f.statements.some(statement => /on duplicate key update `hits` = `account_recovery_limits`.`hits` \+ 1/.test(statement.sql))).toBe(true);
    await store.purgeExpired(date);
    const cleanup = f.statements.filter(statement => statement.sql.startsWith("delete"));
    expect(cleanup).toHaveLength(2); expect(cleanup.every(statement => /limit \?/.test(statement.sql) && statement.params.at(-1) === 100)).toBe(true);
  });
  it("uses insert rather than duplicate-key replacement for an unowned email, and rolls back later failure", async () => {
    const f = connection(); const store = await getRecoveryStore();
    await store.saveEmail({ userId: 21, email: "synthetic@example.invalid", emailKey: "synthetic-email-key", verifiedAt: new Date() });
    const insert = f.statements.find(statement => statement.sql.startsWith("insert"))!;
    expect(insert.sql).not.toContain("on duplicate key update"); expect(insert.params).toContain("synthetic@example.invalid");
    await expect(store.transaction(async tx => { await tx.changePassword(21, "synthetic-hash", 2); throw new Error("synthetic-failure"); })).rejects.toThrow("synthetic-failure");
    expect(f.statements.at(-1)?.sql).toBe("rollback");
    const update = f.statements.find(statement => statement.sql.startsWith("update"))!;
    expect(update.sql).toContain("`auth_version` = ?"); expect(update.sql).not.toContain("synthetic-hash");
  });
});
