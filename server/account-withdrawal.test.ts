import { beforeEach, describe, expect, it, vi } from "vitest";
import { getTableName, type SQL } from "drizzle-orm";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import { accountWithdrawalSchema } from "../shared/accountWithdrawal";
import { withdrawAccount, getWithdrawalStatus } from "./accountWithdrawal";
import { hashPassword } from "./password";
import { ensureAccountRevocationStorage, revokedSubjectHash } from "./accountRevocations";
import { clearWithdrawnDrafts, withdrawalWasConfirmed } from "../client/src/lib/withdrawalCleanup";

const mock = vi.hoisted(() => ({ getDb: vi.fn() }));
vi.mock("./db", () => ({ getDb: mock.getDb }));
vi.mock("./_core/env", () => ({ ENV: { cookieSecret: "synthetic-withdrawal-test-secret" } }));
const input = { confirmation: "DELETE", acknowledged: true, password: "qa-only-password" } as const;
const hash = hashPassword(input.password);
const direct = ["training_drafts", "training_attempts", "anomaly_logs", "product_activity_events", "user_onboarding_progress", "first_use_feedback", "user_stats", "social_account_links", "chat_feedback"];

/** No production DB connection. Compile Drizzle predicates and exercise rollback in memory. */
function fixture(options: { files?: boolean; admin?: boolean; passwordless?: boolean; failAt?: string } = {}) {
  let rows: Record<string, any[]> = {
    users: [{ id: 21, openId: "local_synthetic-21", passwordHash: options.passwordless ? null : hash, role: options.admin ? "admin" : "user" }, { id: 22, openId: "local_other-22", role: "user" }],
    chat_sessions: [{ id: 101, userId: 21 }, { id: 102, userId: 22 }],
    chat_messages: [{ id: 201, sessionId: 101 }, { id: 202, sessionId: 102 }],
    manual_documents: [{ id: 301, userId: 21, fileKey: options.files ? "synthetic-file" : null, sourceType: "text" }, { id: 302, userId: 22, fileKey: null, sourceType: "text" }],
    manual_chunks: [{ id: 401, documentId: 301 }, { id: 402, documentId: 302 }],
    data_sharing: [{ id: 1, ownerId: 21, sharedWithUserId: 22 }, { id: 2, ownerId: 22, sharedWithUserId: 21 }, { id: 3, ownerId: 22, sharedWithUserId: 23 }],
    account_revocations: [], practice_activity_events: [{ participantId: "p-unlinked" }], visitor_stats: [{ visitors: 5 }],
  };
  for (const name of direct) rows[name] = [{ id: 1, userId: 21 }, { id: 2, userId: 22 }];
  const operations: { kind: string; table: string; sql?: string; params?: unknown[] }[] = [];
  const query = (predicate: SQL) => new MySqlDialect().sqlToQuery(predicate);
  const matches = (name: string, row: any, sql: string, params: any[]) => {
    if (name === "users") return row.id === params[0] && (params.length === 1 || row.openId === params[1]);
    if (name === "data_sharing") return row.ownerId === params[0] || row.sharedWithUserId === params[1];
    if (name === "chat_messages") return params.includes(row.sessionId);
    if (name === "manual_chunks") return params.includes(row.documentId);
    if (name === "account_revocations") return row.subjectHash === params[0];
    return row.userId === params[0] && (!sql.includes("is not null") || row.fileKey !== null || row.sourceType === "upload");
  };
  const database: any = {
    execute: vi.fn(async () => [[], []]),
    select: () => ({ from: (table: any) => ({ where: (predicate: SQL) => {
      const name = getTableName(table), q = query(predicate);
      operations.push({ kind: "read", table: name, ...q });
      const result = rows[name].filter(row => matches(name, row, q.sql, q.params));
      const chain = { limit: () => chain, for: () => chain, then: (resolve: any) => Promise.resolve(result).then(resolve) };
      return chain;
    } }) }),
    insert: (table: any) => ({ values: async (value: any) => { const name = getTableName(table); operations.push({ kind: "insert", table: name }); rows[name].push(value); } }),
    delete: (table: any) => ({ where: async (predicate: SQL) => {
      const name = getTableName(table), q = query(predicate);
      operations.push({ kind: "delete", table: name, ...q });
      if (name === options.failAt) throw new Error("synthetic-driver-error-must-not-leak");
      rows[name] = rows[name].filter(row => !matches(name, row, q.sql, q.params));
    } }),
    transaction: vi.fn(async (fn: any) => { const before = structuredClone(rows); try { return await fn(database); } catch (error) { rows = before; throw error; } }),
  };
  mock.getDb.mockResolvedValue(database);
  return { database, operations, rows: () => rows };
}
beforeEach(() => vi.clearAllMocks());

describe("account withdrawal transaction", () => {
  it("deletes only the authenticated account and children, plus incoming/outgoing sharing edges", async () => {
    const f = fixture();
    expect(await withdrawAccount(21, input, false)).toEqual({ success: true });
    const rows = f.rows();
    expect(rows.users.map(row => row.id)).toEqual([22]);
    for (const name of direct) expect(rows[name]).toEqual([{ id: 2, userId: 22 }]);
    expect(rows.chat_sessions).toEqual([{ id: 102, userId: 22 }]);
    expect(rows.chat_messages).toEqual([{ id: 202, sessionId: 102 }]);
    expect(rows.manual_documents.map(row => row.id)).toEqual([302]);
    expect(rows.manual_chunks).toEqual([{ id: 402, documentId: 302 }]);
    expect(rows.data_sharing.map(row => row.id)).toEqual([3]);
    expect(rows.account_revocations).toEqual([{ subjectHash: revokedSubjectHash("local_synthetic-21") }]);
    expect(rows.practice_activity_events).toEqual([{ participantId: "p-unlinked" }]);
    expect(rows.visitor_stats).toEqual([{ visitors: 5 }]);
    expect(f.operations.filter(op => op.kind === "delete").every(op => op.sql && op.params?.length)).toBe(true);
    expect(f.operations.at(-1)?.table).toBe("users");
  });
  it("rolls back the revocation and all prior row deletions on a failed statement", async () => {
    const f = fixture({ failAt: "training_attempts" }); const before = structuredClone(f.rows());
    await expect(withdrawAccount(21, input, false)).rejects.toMatchObject({ code: "SERVICE_UNAVAILABLE", message: "WITHDRAWAL_UNAVAILABLE" });
    expect(f.rows()).toEqual(before);
  });
  it.each(["incorrect", ""])("does not modify an account for password %s", async password => {
    const f = fixture(); const before = structuredClone(f.rows());
    await expect(withdrawAccount(21, { ...input, password }, true)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(f.rows()).toEqual(before); expect(f.operations.some(op => op.kind === "delete")).toBe(false);
  });
  it.each([{ files: true }, { admin: true }])("fails safely for blocked account %j", async options => {
    const f = fixture(options); const before = structuredClone(f.rows());
    await expect(withdrawAccount(21, input, true)).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(f.rows()).toEqual(before);
  });
  it("requires a recent server-verified login for an account without a password", async () => {
    const f = fixture({ passwordless: true });
    await expect(withdrawAccount(21, input, false)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(f.rows().users).toHaveLength(2);
    expect(await withdrawAccount(21, input, true)).toEqual({ success: true });
  });
  it("rejects a deleted/stale account rather than deleting a different user", async () => {
    const f = fixture();
    await expect(withdrawAccount(900, input, true)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(f.rows().users).toHaveLength(2);
  });
  it("returns availability only, not profile, files or credentials", async () => {
    fixture(); expect(await getWithdrawalStatus(21)).toEqual({ passwordRequired: true, blocked: null });
    fixture({ files: true }); expect((await getWithdrawalStatus(21)).blocked).toBe("files");
    fixture({ admin: true }); expect((await getWithdrawalStatus(21)).blocked).toBe("admin");
  });
  it("does not offer deletion when a read-only transactional storage probe fails", async () => {
    const f = fixture(); f.database.execute.mockRejectedValueOnce(new Error("missing synthetic table"));
    await expect(getWithdrawalStatus(21)).rejects.toMatchObject({ code: "SERVICE_UNAVAILABLE", message: "WITHDRAWAL_UNAVAILABLE" });
    expect(f.operations.some(op => op.kind === "delete")).toBe(false);
    expect(f.rows().users).toHaveLength(2);
  });
  it("checks every deletion store with LIMIT 0 inside a transaction, never reading user records in probes", async () => {
    const f = fixture(); await getWithdrawalStatus(21);
    expect(f.database.transaction).toHaveBeenCalledOnce();
    const queries = f.database.execute.mock.calls.map(([value]: any[]) => new MySqlDialect().sqlToQuery(value).sql);
    expect(queries).toHaveLength(16);
    expect(queries.every((query: string) => /^SELECT .+ LIMIT 0$/.test(query))).toBe(true);
  });
});

describe("revocation preparation and strict confirmation", () => {
  it("prepares only the approved additive table, once per database, outside the destructive transaction", async () => {
    const f = fixture(); await Promise.all([ensureAccountRevocationStorage(f.database), ensureAccountRevocationStorage(f.database)]);
    expect(f.database.execute).toHaveBeenCalledOnce();
    const q = new MySqlDialect().sqlToQuery(f.database.execute.mock.calls[0][0]).sql;
    expect(q).toMatch(/^CREATE TABLE IF NOT EXISTS account_revocations/);
    expect(q).not.toMatch(/ALTER|DROP|DELETE|TRUNCATE/i);
  });
  it("retries a failed preparation, never caches a false success", async () => {
    const f = fixture(); f.database.execute.mockRejectedValueOnce(new Error("unavailable"));
    await expect(ensureAccountRevocationStorage(f.database)).rejects.toThrow("unavailable");
    await ensureAccountRevocationStorage(f.database); expect(f.database.execute).toHaveBeenCalledTimes(2);
  });
  it("stores a domain-separated keyed digest, not raw identity", () => {
    expect(revokedSubjectHash("local_BADGE-TEST")).toMatch(/^[a-f0-9]{64}$/);
    expect(revokedSubjectHash("local_BADGE-TEST")).not.toContain("BADGE");
    expect(revokedSubjectHash("local_other")).not.toBe(revokedSubjectHash("local_BADGE-TEST"));
  });
  it.each([{ confirmation: "delete", acknowledged: true }, { confirmation: "DELETE", acknowledged: false }, { ...input, userId: 22 }, { ...input, openId: "other" }])("rejects invalid confirmation or caller-selected identity %j", raw => {
    expect(accountWithdrawalSchema.safeParse(raw).success).toBe(false);
  });
  it("clears only the withdrawing account's process drafts in this tab", () => {
    const data = new Map([["semiguard.process-training.v1.photo-v1.21", "a"], ["semiguard.etch.scenario01.v1.21", "a"], ["semiguard.process-training.v1.photo-v1.22", "other"], ["semiguard_lang", "ja"], ["semiguard.process-training.v1.photo-v1.guest", "guest"]]);
    clearWithdrawnDrafts({ get length() { return data.size; }, key: index => [...data.keys()][index] ?? null, removeItem: key => { data.delete(key); } }, 21);
    expect([...data.values()]).toEqual(["other", "ja", "guest"]);
  });
  it("does not claim success from a manually opened completion address without a recent one-time notice", () => {
    const now = 1792200000000;
    expect(withdrawalWasConfirmed(String(now - 100), now)).toBe(true);
    for (const raw of [null, "", "garbage", String(now + 1), String(now - 300001)]) expect(withdrawalWasConfirmed(raw, now)).toBe(false);
  });
});
