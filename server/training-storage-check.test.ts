import express from "express";
import { createServer, type Server } from "node:http";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { inspectTrainingStorage, registerTrainingStorageCheck } from "./trainingStorageCheck";

const mocks = vi.hoisted(() => ({ getDb: vi.fn(), getUserByOpenId: vi.fn(), verifySession: vi.fn() }));
vi.mock("./db", () => ({ getDb: mocks.getDb, getUserByOpenId: mocks.getUserByOpenId }));
vi.mock("./_core/sdk", () => ({ sdk: { verifySession: mocks.verifySession } }));

const columns = [
  ["id", "int"], ["user_id", "int"], ["attempt_key", "varchar", 36],
  ["scenario_id", "varchar", 64], ["signal", "varchar", 32], ["onset", "int"],
  ["marker", "int"], ["comparison", "varchar", 32], ["certainty", "varchar", 32],
  ["signal_matched", "int"], ["onset_matched", "int"], ["comparison_matched", "int"],
  ["certainty_matched", "int"], ["created_at", "timestamp"],
].map(([name, type, length]) => ({ name, type, length: length ?? null,
  nullable: name === "marker" ? "YES" : "NO", extra: name === "id" ? "auto_increment" : "",
  defaultValue: name === "created_at" ? "CURRENT_TIMESTAMP" : null }));
const indexes = [
  { name: "PRIMARY", position: 1, column: "id", nonUnique: 0, prefix: null as number | null },
  { name: "retry", position: 1, column: "user_id", nonUnique: 0, prefix: null as number | null },
  { name: "retry", position: 2, column: "attempt_key", nonUnique: 0, prefix: null as number | null },
  { name: "timeline", position: 1, column: "user_id", nonUnique: 1, prefix: null as number | null },
  { name: "timeline", position: 2, column: "created_at", nonUnique: 1, prefix: null as number | null },
];
const ready = { ready: true, checks: { readable: true, columns: true, primaryKey: true, retryKey: true, ownerTimeline: true } };
const unavailable = { ready: false, checks: { readable: false, columns: false, primaryKey: false, retryKey: false, ownerTimeline: false } };
function configure(columnRows = columns, indexRows = indexes) {
  const execute = vi.fn().mockResolvedValueOnce([[], []])
    .mockResolvedValueOnce([columnRows, []]).mockResolvedValueOnce([indexRows, []]);
  mocks.getDb.mockResolvedValue({ execute });
  return execute;
}
let server: Server | undefined;
beforeEach(() => vi.resetAllMocks());
afterEach(async () => {
  if (server) await new Promise<void>(resolve => server!.close(() => resolve()));
  server = undefined;
});

describe("read-only training storage preflight", () => {
  it("checks active runtime schema without retrieving records or exposing metadata", async () => {
    const execute = configure();
    expect(await inspectTrainingStorage()).toEqual(ready);
    const queries = execute.mock.calls.map(([query]) => new MySqlDialect().sqlToQuery(query).sql);
    expect(queries).toHaveLength(3);
    expect(queries.every(query => /^SELECT\b/.test(query))).toBe(true);
    expect(queries[0]).toContain("FROM training_attempts LIMIT 0");
    expect(queries.slice(1).every(query => query.includes("TABLE_SCHEMA = DATABASE()"))).toBe(true);
  });
  it.each(["marker", "attempt_key", "created_at"])("rejects incompatible column %s", async name => {
    configure(columns.map(column => column.name === name ? { ...column, type: "text", nullable: "YES", length: 2, defaultValue: null } : column));
    expect((await inspectTrainingStorage()).ready).toBe(false);
  });
  it("requires auto-increment and all columns", async () => {
    configure(columns.map(column => ({ ...column, extra: "" })));
    expect((await inspectTrainingStorage()).checks.columns).toBe(false);
    configure(columns.slice(1));
    expect((await inspectTrainingStorage()).checks.columns).toBe(false);
  });
  it.each(["PRIMARY", "retry", "timeline"])("requires %s index semantics", async name => {
    configure(columns, indexes.filter(index => index.name !== name));
    expect((await inspectTrainingStorage()).ready).toBe(false);
  });
  it("rejects reversed or non-unique retry keys", async () => {
    configure(columns, indexes.map(index => index.name === "retry" ? { ...index, position: 3 - index.position } : index));
    expect((await inspectTrainingStorage()).checks.retryKey).toBe(false);
    configure(columns, indexes.map(index => index.name === "retry" ? { ...index, nonUnique: 1 } : index));
    expect((await inspectTrainingStorage()).checks.retryKey).toBe(false);
  });
  it("returns only booleans when storage is unavailable or a driver error contains secrets", async () => {
    mocks.getDb.mockResolvedValue(null);
    expect(await inspectTrainingStorage()).toEqual(unavailable);
    mocks.getDb.mockRejectedValue(new Error("mysql://private-user:private-password@host/private-db"));
    expect(await inspectTrainingStorage()).toEqual(unavailable);
    const execute = vi.fn().mockRejectedValue(new Error("private driver details"));
    mocks.getDb.mockResolvedValue({ execute });
    expect(await inspectTrainingStorage()).toEqual(unavailable);
  });
  it("rejects prefix-only keys", async () => {
    configure(columns, indexes.map(index => index.column === "attempt_key" ? { ...index, prefix: 8 } : index));
    expect((await inspectTrainingStorage()).checks.retryKey).toBe(false);
  });
  it("does not add a write path or invoke session synchronization", () => {
    const source = readFileSync(resolve(process.cwd(), "server/trainingStorageCheck.ts"), "utf8");
    expect(source).not.toMatch(/\b(?:INSERT|UPDATE|DELETE|ALTER|CREATE|DROP)\s+/);
    expect(source).not.toMatch(/sdk\.authenticateRequest\(|upsertUser\(|\.insert\(|\.update\(|\.delete\(/);
  });
  async function start() {
    const app = express();
    registerTrainingStorageCheck(app);
    server = createServer(app);
    await new Promise<void>(resolve => server!.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Missing test port");
    return `http://127.0.0.1:${address.port}/api/internal/training-storage-check`;
  }
  it("rejects unauthenticated requests before storage inspection", async () => {
    mocks.verifySession.mockResolvedValue(null);
    const response = await fetch(await start());
    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(mocks.getDb).not.toHaveBeenCalled();
    expect(mocks.getUserByOpenId).not.toHaveBeenCalled();
  });
  it("rejects deleted local accounts", async () => {
    mocks.verifySession.mockResolvedValue({ openId: "test-user" });
    mocks.getUserByOpenId.mockResolvedValue(undefined);
    const response = await fetch(await start(), { headers: { Cookie: "app_session_id=test-only" } });
    expect(response.status).toBe(401);
    expect(mocks.getDb).not.toHaveBeenCalled();
  });
  it("returns non-cacheable readiness for an existing authenticated account", async () => {
    configure();
    mocks.verifySession.mockResolvedValue({ openId: "test-user" });
    mocks.getUserByOpenId.mockResolvedValue({ id: 27 });
    const response = await fetch(await start(), { headers: { Cookie: "app_session_id=test-only" } });
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual(ready);
    expect(mocks.verifySession).toHaveBeenCalledWith("test-only");
    expect(mocks.getUserByOpenId).toHaveBeenCalledWith("test-user");
  });
  it("does not leak authentication/database errors", async () => {
    mocks.verifySession.mockRejectedValue(new Error("private auth failure"));
    const response = await fetch(await start());
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "Storage check unavailable." });
  });
});
