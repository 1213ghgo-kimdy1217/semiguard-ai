import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import { ENV } from "./_core/env";
import { appRouter } from "./routers";
import { inspectMeasurementStorage, readMeasurementConsent, recordMeasurementEvent, setMeasurementConsent, validMeasurementMetadata } from "./practiceMeasurement";
const mock = vi.hoisted(() => ({ getDb: vi.fn() }));
vi.mock("./db", () => mock);
const columns = [
  { name: "id", definition: "int", nullable: "NO", extra: "auto_increment", defaultValue: null },
  { name: "participant_id", definition: "varchar(64)", nullable: "NO", extra: "", defaultValue: null },
  { name: "event_type", definition: "enum('visit','practice_started','practice_completed')", nullable: "NO", extra: "", defaultValue: null },
  { name: "occurred_at", definition: "timestamp", nullable: "NO", extra: "", defaultValue: "CURRENT_TIMESTAMP" },
];
const indexes = [
  ...["id"].map((col, i) => ({ name: "PRIMARY", position: i + 1, col, nonUnique: 0, prefix: null })),
  ...["participant_id", "occurred_at", "event_type"].map((col, i) => ({ name: "practice_activity_participant_time_idx", position: i + 1, col, nonUnique: 1, prefix: null })),
  ...["occurred_at", "event_type"].map((col, i) => ({ name: "practice_activity_time_type_idx", position: i + 1, col, nonUnique: 1, prefix: null })),
];
const req = (cookie = "") => ({ headers: { host: "semiguard.example", origin: "https://semiguard.example", cookie }, protocol: "https" }) as any;
const res = () => ({ cookie: vi.fn(), clearCookie: vi.fn() }) as any;
const priorSecret = ENV.cookieSecret;
function readyDatabase(...responses: unknown[]) {
  const execute = vi.fn().mockResolvedValueOnce([columns]).mockResolvedValueOnce([indexes]);
  for (const response of responses) execute.mockResolvedValueOnce(response);
  mock.getDb.mockResolvedValue({ execute });
  return execute;
}
async function consentCookie(qa = false) {
  readyDatabase(); const response = res();
  await setMeasurementConsent(req(), response, { enabled: true, qa });
  return `sg_practice_measurement_v1=${response.cookie.mock.calls[0][1]}`;
}
describe("practice measurement storage, consent and reporting", () => {
  beforeEach(() => { vi.clearAllMocks(); ENV.cookieSecret = "synthetic-test-signing-key"; });
  afterEach(() => { ENV.cookieSecret = priorSecret; vi.useRealTimers(); });
  it("checks exact columns and indexes, rejecting incompatible or extra constraints", () => {
    expect(validMeasurementMetadata(columns, indexes)).toBe(true);
    for (const badColumns of [[], columns.slice(1), columns.map(c => c.name === "event_type" ? { ...c, definition: "varchar(30)" } : c),
      columns.map(c => ({ ...c, nullable: "YES" })), columns.map(c => c.name === "occurred_at" ? { ...c, defaultValue: null } : c)]) {
      expect(validMeasurementMetadata(badColumns, indexes)).toBe(false);
    }
    for (const badIndexes of [[], indexes.slice(1), [...indexes, { ...indexes[0], name: "unexpected_unique" }],
      indexes.map(i => i.col === "participant_id" ? { ...i, prefix: 4 } : i), indexes.map(i => ({ ...i, nonUnique: 0 }))]) {
      expect(validMeasurementMetadata(columns, badIndexes)).toBe(false);
    }
  });
  it("inspects this database's metadata only, not table records", async () => {
    const execute = readyDatabase();
    await expect(inspectMeasurementStorage()).resolves.toEqual({ ready: true });
    for (const [query] of execute.mock.calls) {
      const text = new MySqlDialect().sqlToQuery(query).sql;
      expect(text).toContain("information_schema"); expect(text).toContain("DATABASE()");
      expect(text).not.toMatch(/SELECT \*|FROM practice_activity_events|INSERT|UPDATE|DELETE/);
    }
    mock.getDb.mockRejectedValue(new Error("sensitive-connection-error"));
    await expect(inspectMeasurementStorage()).resolves.toEqual({ ready: false });
  });
  it("does not inspect or write the DB before consent, including withdrawal", async () => {
    expect(readMeasurementConsent(req())).toBeNull();
    await expect(recordMeasurementEvent(req(), "visit", false)).resolves.toEqual({ accepted: false, recorded: false });
    const response = res();
    await expect(setMeasurementConsent(req(), response, { enabled: false, qa: false })).resolves.toEqual({ consented: false, qa: false });
    expect(response.clearCookie).toHaveBeenCalled(); expect(mock.getDb).not.toHaveBeenCalled();
  });
  it("requires a signing key and verified storage before issuing a cookie", async () => {
    ENV.cookieSecret = "";
    await expect(setMeasurementConsent(req(), res(), { enabled: true, qa: false })).rejects.toMatchObject({ code: "SERVICE_UNAVAILABLE" });
    expect(mock.getDb).not.toHaveBeenCalled();
    ENV.cookieSecret = "synthetic-test-signing-key"; mock.getDb.mockResolvedValue(null);
    const response = res();
    await expect(setMeasurementConsent(req(), response, { enabled: true, qa: false })).rejects.toMatchObject({ code: "SERVICE_UNAVAILABLE" });
    expect(response.cookie).not.toHaveBeenCalled();
  });
  it("signs an opaque browser ID, keeps it HTTP-only and rejects tampering/expiry", async () => {
    const cookie = await consentCookie(true);
    expect(readMeasurementConsent(req(cookie))).toMatchObject({ qa: true, id: expect.stringMatching(/^qa-/) });
    expect(readMeasurementConsent(req(cookie.replace("qa-", "p-")))).toBeNull();
    expect(readMeasurementConsent(req(`${cookie}0`))).toBeNull();
    expect(readMeasurementConsent(req(cookie), Date.now() + 31 * 86400000)).toBeNull();
    readyDatabase(); const response = res(); await setMeasurementConsent(req(cookie), response, { enabled: true, qa: true });
    expect(response.cookie.mock.calls[0][2]).toMatchObject({ httpOnly: true, secure: true, sameSite: "lax", maxAge: 30 * 86400000 });
    expect(readMeasurementConsent(req(cookie))?.id).toBe(readMeasurementConsent(req(`sg_practice_measurement_v1=${response.cookie.mock.calls[0][1]}`))?.id);
  });
  it("denies cross-origin writes and guest full-practice events", async () => {
    await expect(setMeasurementConsent({ ...req(), headers: { ...req().headers, origin: "https://other.example" } }, res(), { enabled: false, qa: false })).rejects.toMatchObject({ code: "FORBIDDEN" });
    const cookie = await consentCookie(); mock.getDb.mockClear();
    await expect(recordMeasurementEvent(req(cookie), "practice_started", false)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(mock.getDb).not.toHaveBeenCalled();
  });
  it("inserts server-controlled identity/event with day dedup and a recent-start completion gate", async () => {
    const cookie = await consentCookie(true);
    const execute = readyDatabase([{ affectedRows: 1 }]);
    await expect(recordMeasurementEvent(req(cookie), "practice_completed", true)).resolves.toEqual({ accepted: true, recorded: true });
    const query = new MySqlDialect().sqlToQuery(execute.mock.calls[2][0]);
    expect(query.sql).toContain("INSERT INTO practice_activity_events (participant_id, event_type)");
    expect(query.sql).toContain("NOT EXISTS"); expect(query.sql).toContain("INTERVAL 6 HOUR");
    expect(query.params.filter(p => p === "practice_completed")).toHaveLength(2);
    expect(query.params).not.toContain(41); expect(query.sql).not.toMatch(/user_id|facts|checks|DELETE|UPDATE/);
    const duplicate = readyDatabase([{ affectedRows: 0 }]);
    await expect(recordMeasurementEvent(req(cookie), "visit", false)).resolves.toEqual({ accepted: true, recorded: false });
    expect(duplicate).toHaveBeenCalledTimes(3);
  });
  it("does not write when metadata is incompatible", async () => {
    const cookie = await consentCookie(); const execute = vi.fn().mockResolvedValueOnce([columns]).mockResolvedValueOnce([[]]); mock.getDb.mockResolvedValue({ execute });
    await expect(recordMeasurementEvent(req(cookie), "visit", false)).rejects.toMatchObject({ code: "SERVICE_UNAVAILABLE" });
    expect(execute).toHaveBeenCalledTimes(2);
  });
  it("enforces administrator reports, returns only aggregate counts and excludes QA", async () => {
    for (const user of [null, { id: 41, role: "user" }]) {
      await expect(appRouter.createCaller({ user, req: req(), res: res() } as any).practiceMeasurement.report({ start: "2026-10-01", end: "2026-10-07" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    }
    expect(mock.getDb).not.toHaveBeenCalled();
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-09T00:00:00Z"));
    const execute = readyDatabase([[{ visits: "4", starts: "3", completions: "2" }]], [[{ cohort: "3", returned: "1" }]], [[{ visits: "1", starts: "1", completions: "1" }]]);
    const result = await appRouter.createCaller({ user: { id: 41, role: "admin" }, req: req(), res: res() } as any).practiceMeasurement.report({ start: "2026-10-01", end: "2026-10-07" });
    expect(result).toMatchObject({ visits: 4, starts: 3, completions: 2, cohort: 3, returned: 1, retentionMature: false, qa: { visits: 1, starts: 1, completions: 1 }, timezone: "Asia/Seoul" });
    expect(result).not.toHaveProperty("participant_id"); expect(result).not.toHaveProperty("records");
    const sqls = execute.mock.calls.map(([q]) => new MySqlDialect().sqlToQuery(q).sql);
    expect(sqls[2]).toContain("COUNT(DISTINCT"); expect(sqls[2]).toContain("LIKE 'p-%'");
    expect(sqls[3]).toContain("MIN(occurred_at)"); expect(sqls[4]).toContain("LIKE 'qa-%'");
  });
  it("keeps collection optional in every entry and tracks only fresh live runs", () => {
    const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");
    for (const page of ["Welcome", "TrainingPreview", "ProcessTraining", "EtchTraining"]) expect(read(`client/src/pages/${page}.tsx`)).toContain("<PracticeMeasurementConsent />");
    const component = read("client/src/components/PracticeMeasurement.tsx");
    expect(component).toContain("useState(false)"); expect(component).toContain("retry: false"); expect(component).toContain('window.addEventListener("storage", sync)');
    expect(component).not.toMatch(/localStorage\.setItem\([^\n]*(?:userId|participant|answer|facts)/);
    for (const page of ["ProcessTraining", "EtchTraining"]) expect(read(`client/src/pages/${page}.tsx`)).toContain('stage === "review" && attempt.submitted');
    expect(read("client/src/pages/PracticeMetrics.tsx")).toContain('auth.data?.role === "admin"');
  });
});
