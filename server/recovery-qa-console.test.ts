import http from "node:http";
import { afterEach, describe, expect, it, vi } from "vitest";
const database = vi.hoisted(() => ({ connect: vi.fn(), schema: vi.fn() }));
vi.mock("mysql2/promise", () => ({ createConnection: database.connect }));
vi.mock("./accountRecoverySchema", () => ({ inspectRecoverySchema: database.schema }));
import { startRecoveryQaConsole, BROWSER_QA_LOGIN_ID } from "../scripts/recovery-qa-console";

const HOST = "synthetic-owned.eu-central-1.aws.tidbcloud.com";
const USER = "synthetic-owned.root";
const PASSWORD = "synthetic-private-qa-password:@/?#";
const QA_PASSWORD = "only-synthetic-browser-qa-password";
const OWNER = { id: 77, openId: "local_browser_qa_00000000-0000-0000-0000-000000000077" };
const opened: Awaited<ReturnType<typeof startRecoveryQaConsole>>[] = [];
afterEach(async () => {
  // Synthetic mocked owners only: normal close must refuse unsettled cleanup.
  await Promise.all(opened.splice(0).map(consoleServer => consoleServer.close().catch(() => new Promise<void>(resolve => { consoleServer.server.close(() => resolve()); consoleServer.server.closeIdleConnections(); }))));
  vi.restoreAllMocks(); database.connect.mockReset(); database.schema.mockReset();
});
async function fixture(options: { previewOnly?: boolean; storageAdapter?: boolean } = {}) {
  const prepare = vi.fn().mockResolvedValue({ passed: true, checks: { privatePreparationKey: true } });
  const run = vi.fn().mockResolvedValue({ passed: true, checks: { privateCheckKey: true, otherPrivateKey: true } });
  const validate = vi.fn().mockResolvedValue({ passed: true, checks: { privateScopeCheck: true } });
  const seed = vi.fn().mockResolvedValue({ passed: true, owner: { ...OWNER } });
  const cleanup = vi.fn().mockResolvedValue({ passed: true });
  const consoleServer = await startRecoveryQaConsole({ port: 0, previewOnly: options.previewOnly, dependencies: { prepare, run, validate, ...(options.storageAdapter ? {} : { seed, cleanup }) } }); opened.push(consoleServer);
  const post = (path: string, data: unknown, headers: Record<string, string> = {}) => fetch(consoleServer.url + path, { method: "POST", headers: { Origin: consoleServer.url, "Content-Type": "application/json", ...headers }, body: JSON.stringify(data) });
  const configure = () => post("/configure", { host: HOST, user: USER });
  const passed = async () => { await configure(); await post("/run", { password: PASSWORD }); };
  return { ...consoleServer, prepare, run, validate, seed, cleanup, post, configure, passed };
}
function raw(url: string, headers: Record<string, string>) {
  return new Promise<{ status: number; body: string }>((resolve, reject) => {
    const request = http.get(url + "/state", { headers }, response => { let body = ""; response.on("data", chunk => { body += chunk; }); response.on("end", () => resolve({ status: response.statusCode!, body })); });
    request.on("error", reject);
  });
}

describe("loopback-only recovery QA credential console", () => {
  it("serves only static same-origin UI and a credential-free initial state", async () => {
    const f = await fixture();
    const response = await fetch(f.url);
    expect(response.headers.get("content-security-policy")).toContain("frame-ancestors 'none'");
    expect(response.headers.get("content-security-policy")).toContain("script-src 'self'");
    expect(response.headers.get("access-control-allow-origin")).toBeNull();
    expect(response.headers.get("cache-control")).toBe("no-store");
    const html = await response.text(); expect(html).toContain('type="password"'); expect(html).toContain('src="/client.js"'); expect(html).toContain("[hidden]{display:none!important}");
    const js = await (await fetch(f.url + "/client.js")).text();
    expect(js).toContain("field.value=''"); expect(js).toContain("navigator.clipboard.writeText(result.url)");
    expect(js).not.toContain("console."); expect(js).not.toContain("localStorage"); expect(js).not.toContain("sessionStorage");
    expect(await (await fetch(f.url + "/state")).json()).toMatchObject({ configured: false, phase: "configure", totalChecks: 0 });
    expect(f.prepare).not.toHaveBeenCalled(); expect(f.run).not.toHaveBeenCalled();
  });
  it("rejects hostile Host headers and Origin/content-type bypasses before configuration", async () => {
    const f = await fixture();
    expect((await raw(f.url, { Host: "attacker.invalid" })).status).toBe(403);
    for (const headers of [{ Origin: "https://foreign.invalid" }, { Origin: "" }, { "Content-Type": "text/plain" }, { Origin: f.url + "/" }]) {
      expect((await f.post("/configure", { host: HOST, user: USER }, headers)).status).toBe(403);
    }
    expect(f.prepare).not.toHaveBeenCalled();
  });
  it("locks the reviewed target once and never returns private host/user metadata", async () => {
    const f = await fixture();
    for (const host of ["tidbcloud.com", "bad.tidbcloud.com.attacker.invalid", "127.0.0.1", HOST + ":4000"]) expect((await f.post("/configure", { host, user: USER })).status).toBe(400);
    const response = await f.configure(); expect(response.status).toBe(200);
    const text = await response.text(); expect(text).not.toContain(HOST); expect(text).not.toContain(USER);
    expect(JSON.parse(text)).toEqual({ configured: true, phase: "ready", schema: "semiguard_recovery_qa_20261102" });
    expect((await f.configure()).status).toBe(409);
    expect(await (await fetch(f.url + "/state")).text()).not.toMatch(/expectedHost|expectedUser|synthetic-owned/);
  });
  it("bounds JSON input and rejects unrelated fields before any DB operation", async () => {
    const f = await fixture(); await f.configure();
    expect((await f.post("/run", { password: "A".repeat(9000) })).status).toBe(413);
    expect((await f.post("/run", { password: PASSWORD, database: "production" })).status).toBe(400);
    expect((await f.post("/run", { password: "" })).status).toBe(400);
    expect((await f.post("/run", { password: "bad\nsecret" })).status).toBe(400);
    expect(f.prepare).not.toHaveBeenCalled(); expect(f.run).not.toHaveBeenCalled();
  });
  it("runs only the fixed QA schema with verified TLS and emits aggregate counts only", async () => {
    const f = await fixture(); await f.configure();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {}), error = vi.spyOn(console, "error").mockImplementation(() => {});
    const response = await f.post("/run", { password: PASSWORD });
    const text = await response.text();
    expect(JSON.parse(text)).toMatchObject({ phase: "passed", passed: true, passedChecks: 3, totalChecks: 3 });
    for (const privateValue of [HOST, USER, PASSWORD, "privatePreparationKey", "privateCheckKey", "mysql:"]) expect(text).not.toContain(privateValue);
    const [connection, target] = f.prepare.mock.calls[0]; const parsed = new URL(connection);
    expect(parsed.hostname).toBe(HOST); expect(parsed.port).toBe("4000"); expect(decodeURIComponent(parsed.username)).toBe(USER); expect(decodeURIComponent(parsed.password)).toBe(PASSWORD);
    expect(parsed.pathname).toBe("/semiguard_recovery_qa_20261102");
    expect(JSON.parse(parsed.searchParams.get("ssl")!)).toEqual({ rejectUnauthorized: true, verifyIdentity: true });
    expect(target).toEqual({ expectedHost: HOST, expectedUser: USER }); expect(f.run).toHaveBeenCalledWith(connection, target);
    expect((await f.post("/run", { password: PASSWORD })).status).toBe(409);
    expect(warn).not.toHaveBeenCalled(); expect(error).not.toHaveBeenCalled();
  });
  it("does not allow concurrent runs or forgetting while an uncertain operation is running", async () => {
    const f = await fixture(); await f.configure();
    let release!: (value: unknown) => void;
    f.prepare.mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
    const first = f.post("/run", { password: PASSWORD });
    await vi.waitFor(() => expect(f.prepare).toHaveBeenCalledOnce());
    expect((await f.post("/run", { password: PASSWORD })).status).toBe(409);
    expect((await f.post("/forget", {})).status).toBe(409);
    expect((await f.post("/copy", {})).status).toBe(409);
    release({ passed: false, checks: { somePrivateFailure: false } });
    expect(await (await first).json()).toMatchObject({ phase: "review", passed: false, totalChecks: 1, passedChecks: 0 });
    expect(f.run).not.toHaveBeenCalled(); expect((await f.post("/run", { password: PASSWORD })).status).toBe(409);
  });
  it("sanitizes thrown preparation errors and requires review without a retry", async () => {
    const f = await fixture(); await f.configure();
    f.prepare.mockRejectedValueOnce(new Error(`private-password:${PASSWORD};host:${HOST}`));
    const text = await (await f.post("/run", { password: PASSWORD })).text();
    expect(JSON.parse(text)).toMatchObject({ phase: "review", passed: false }); expect(text).not.toContain(PASSWORD); expect(text).not.toContain(HOST);
    expect(f.run).not.toHaveBeenCalled(); expect((await f.post("/copy", {})).status).toBe(409); expect((await f.post("/run", { password: PASSWORD })).status).toBe(409);
  });
  it("returns the private URL only through a guarded copy after success, then forgets it", async () => {
    const f = await fixture();
    expect((await f.post("/copy", {})).status).toBe(409); await f.configure();
    expect((await f.post("/copy", {})).status).toBe(409); await f.post("/run", { password: PASSWORD });
    expect((await f.post("/copy", {}, { Origin: "https://foreign.invalid" })).status).toBe(403);
    expect((await fetch(f.url + "/copy")).status).toBe(404);
    const copied = await (await f.post("/copy", {})).json(); expect(copied.url).toBe(f.prepare.mock.calls[0][0]);
    expect(await (await fetch(f.url + "/state")).text()).not.toContain("mysql:");
    expect(await (await f.post("/forget", {})).json()).toMatchObject({ phase: "forgotten" });
    expect((await f.post("/copy", {})).status).toBe(409); expect((await f.post("/run", { password: PASSWORD })).status).toBe(409);
  });
  it("continues in Preview-only mode without creating the original four harness accounts again", async () => {
    const f = await fixture({ previewOnly: true }); await f.passed();
    expect(f.validate).toHaveBeenCalledOnce(); expect(f.prepare).not.toHaveBeenCalled(); expect(f.run).not.toHaveBeenCalled();
    expect(await (await fetch(f.url + "/state")).json()).toMatchObject({ mode: "preview-only", phase: "passed", browserPhase: "not-seeded" });
    const client = await (await fetch(f.url + "/client.js")).text(); expect(client).toContain("Preview용 스키마 범위 확인 완료."); expect(client).not.toContain("가상 시험 검사를 통과했습니다.");
  });
  it("creates one fixed-ID synthetic account only after QA scope checks and never returns its password or owner metadata", async () => {
    const f = await fixture({ previewOnly: true });
    expect((await f.post("/seed", { password: QA_PASSWORD })).status).toBe(409);
    await f.passed(); expect((await f.post("/seed", { password: "short" })).status).toBe(400);
    const response = await f.post("/seed", { password: QA_PASSWORD }); const text = await response.text();
    expect(JSON.parse(text)).toMatchObject({ seeded: true, loginId: BROWSER_QA_LOGIN_ID, browserPhase: "seeded", cleanupRequired: true });
    for (const value of [QA_PASSWORD, PASSWORD, OWNER.openId, '"id":77', "mysql:"]) expect(text).not.toContain(value);
    expect(f.seed).toHaveBeenCalledOnce();
    expect(f.seed).toHaveBeenCalledWith(f.validate.mock.calls[0][0], { expectedHost: HOST, expectedUser: USER }, QA_PASSWORD);
    expect((await f.post("/seed", { password: QA_PASSWORD })).status).toBe(409);
    expect((await f.post("/forget", {})).status).toBe(409);
    await expect(f.close()).rejects.toThrow("CONSOLE_CLEANUP_REVIEW_REQUIRED");
  });
  it("copies a random Preview-only JWT secret only after seeding and erases it after exact-owner cleanup", async () => {
    const f = await fixture({ previewOnly: true }); await f.passed();
    expect((await f.post("/copy-jwt", {})).status).toBe(409);
    await f.post("/seed", { password: QA_PASSWORD });
    expect((await fetch(f.url + "/copy-jwt")).status).toBe(404);
    expect((await f.post("/copy-jwt", {}, { Origin: "https://foreign.invalid" })).status).toBe(403);
    const copied = await (await f.post("/copy-jwt", {})).json(); expect(copied.secret).toMatch(/^[A-Za-z0-9_-]{43}$/);
    for (const route of ["/", "/state", "/client.js"]) expect(await (await fetch(f.url + route)).text()).not.toContain(copied.secret);
    expect(await (await f.post("/cleanup", {})).json()).toMatchObject({ browserPhase: "cleaned", cleanupRequired: false });
    expect(f.cleanup).toHaveBeenCalledWith(f.validate.mock.calls[0][0], { expectedHost: HOST, expectedUser: USER }, OWNER);
    expect((await f.post("/copy-jwt", {})).status).toBe(409);
    expect((await f.post("/cleanup", {})).status).toBe(409);
    expect((await f.post("/forget", {})).status).toBe(200);
  });
  it("keeps uncertain seed/cleanup state and connection metadata for review instead of retrying or forgetting", async () => {
    const f = await fixture({ previewOnly: true }); await f.passed();
    f.seed.mockResolvedValueOnce({ passed: false, owner: { ...OWNER } });
    expect(await (await f.post("/seed", { password: QA_PASSWORD })).json()).toMatchObject({ browserPhase: "seed-review", cleanupRequired: true });
    expect((await f.post("/seed", { password: QA_PASSWORD })).status).toBe(409); expect((await f.post("/forget", {})).status).toBe(409);
    f.cleanup.mockRejectedValueOnce(new Error(`private-detail:${PASSWORD}`));
    const text = await (await f.post("/cleanup", {})).text(); expect(text).not.toContain(PASSWORD);
    expect(JSON.parse(text)).toMatchObject({ browserPhase: "cleanup-review", cleanupRequired: true });
    expect((await f.post("/cleanup", {})).status).toBe(409); expect((await f.post("/forget", {})).status).toBe(409);
    await expect(f.close()).rejects.toThrow("CONSOLE_CLEANUP_REVIEW_REQUIRED");
  });
});

function syntheticStorage(existingUsers = 0) {
  const statements: { sql: string; values: unknown[] }[] = [];
  const users: { id: number; openId: string }[] = existingUsers ? [{ id: 55, openId: "local_unrelated" }] : [];
  let revocations = 0;
  const connection = {
    execute: vi.fn(async (query: string | { sql: string }, values: unknown[] = []) => {
      const sql = typeof query === "string" ? query : query.sql; statements.push({ sql, values });
      if (/SELECT DATABASE/.test(sql)) return [[{ matches: 1 }], []];
      if (/information_schema.TABLES/.test(sql)) return [["users", "account_revocations", "account_recovery_emails", "account_recovery_tokens", "account_recovery_limits"].map(name => ({ name })), []];
      if (/SELECT COUNT.+account_revocations/.test(sql)) return [[{ count: revocations }], []];
      if (/SELECT COUNT.+users/.test(sql)) return [[{ count: users.length }], []];
      if (/^INSERT INTO users/.test(sql)) { users.push({ id: 77, openId: values[0] as string }); return [{ insertId: 77 }, []]; }
      if (/^SELECT openId FROM users/.test(sql)) return [users.filter(user => user.id === values[0]).map(({ openId }) => ({ openId })), []];
      if (/^DELETE FROM users/.test(sql)) { const index = users.findIndex(user => user.id === values[0] && user.openId === values[1]); if (index < 0) return [{ affectedRows: 0 }, []]; users.splice(index, 1); return [{ affectedRows: 1 }, []]; }
      return [[], []];
    }),
    beginTransaction: vi.fn(), commit: vi.fn(), rollback: vi.fn(), end: vi.fn(),
  };
  database.connect.mockResolvedValue(connection); database.schema.mockResolvedValue({ state: "ready", missing: [] });
  return { statements, users, connection, revoke: () => { revocations = 1; } };
}

describe("Preview-only account storage boundary with a recording connection, no live DB", () => {
  it("hashes one password, uses role=user, and cleans only the captured ID/openId while preserving shared counters and other users", async () => {
    const db = syntheticStorage(); const f = await fixture({ previewOnly: true, storageAdapter: true }); await f.passed();
    expect(await (await f.post("/seed", { password: QA_PASSWORD })).json()).toMatchObject({ browserPhase: "seeded" });
    const insert = db.statements.find(row => row.sql.startsWith("INSERT INTO users"))!;
    expect(insert.values[3]).toBe(BROWSER_QA_LOGIN_ID); expect(insert.values[4]).toMatch(/^scrypt\$/); expect(insert.values).not.toContain(QA_PASSWORD); expect(insert.sql).toContain(",0,'user')");
    const owned = { ...db.users[0] }; db.users.push({ id: 88, openId: "local_unrelated" });
    expect(await (await f.post("/cleanup", {})).json()).toMatchObject({ browserPhase: "cleaned" });
    expect(db.users).toEqual([{ id: 88, openId: "local_unrelated" }]);
    const deletes = db.statements.filter(row => row.sql.startsWith("DELETE"));
    expect(deletes).toHaveLength(3); expect(deletes.every(row => !/account_recovery_limits|account_revocations/.test(row.sql))).toBe(true);
    expect(deletes.at(-1)?.values).toEqual([owned.id, owned.openId]); expect(db.connection.commit).toHaveBeenCalledTimes(2);
    expect(database.connect.mock.calls[0][0]).toMatchObject({ host: HOST, user: USER, database: "semiguard_recovery_qa_20261102", port: 4000, ssl: { rejectUnauthorized: true, verifyIdentity: true } });
    expect(db.statements.some(row => /^(?:CREATE|DROP|ALTER)\b/i.test(row.sql))).toBe(false);
  });
  it.each(["nonempty", "incompatible"])("refuses seeding a %s schema before an INSERT", async condition => {
    const db = syntheticStorage(condition === "nonempty" ? 1 : 0);
    if (condition === "incompatible") database.schema.mockResolvedValue({ state: "partial", missing: ["synthetic-missing-index"] });
    const f = await fixture({ previewOnly: true, storageAdapter: true }); await f.passed();
    expect(await (await f.post("/seed", { password: QA_PASSWORD })).json()).toMatchObject({ browserPhase: "seed-review" });
    expect(db.statements.some(row => row.sql.startsWith("INSERT"))).toBe(false);
    expect((await f.post("/seed", { password: QA_PASSWORD })).status).toBe(409);
  });
  it("stops cleanup for unknown revocation metadata without deleting any rows", async () => {
    const db = syntheticStorage(); const f = await fixture({ previewOnly: true, storageAdapter: true }); await f.passed(); await f.post("/seed", { password: QA_PASSWORD }); db.revoke();
    expect(await (await f.post("/cleanup", {})).json()).toMatchObject({ browserPhase: "cleanup-review", cleanupRequired: true });
    expect(db.statements.some(row => row.sql.startsWith("DELETE"))).toBe(false); expect(db.users).toHaveLength(1);
  });
  it("does not delete data if the captured user ID now belongs to a different subject", async () => {
    const db = syntheticStorage(); const f = await fixture({ previewOnly: true, storageAdapter: true }); await f.passed(); await f.post("/seed", { password: QA_PASSWORD }); db.users[0].openId = "local_replacement";
    expect(await (await f.post("/cleanup", {})).json()).toMatchObject({ browserPhase: "cleanup-review" });
    expect(db.statements.some(row => row.sql.startsWith("DELETE"))).toBe(false); expect(db.connection.rollback).toHaveBeenCalledOnce();
  });
});
