import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { parse } from "cookie";
import { sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import type { Request, Response } from "express";
import { ENV } from "./_core/env";
import { getSessionCookieOptions } from "./_core/cookies";
import { getDb } from "./db";
import { kstDay, kstDateStart, measurementRange, type MeasurementEvent } from "../shared/practiceMeasurement";

const cookieName = "sg_practice_measurement_v1";
const lifetime = 30 * 86400000;
const unavailable = () => new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Practice measurement is unavailable; practice remains usable." });
const signature = (value: string) => createHmac("sha256", ENV.cookieSecret).update(`practice-measurement-v1:${value}`).digest("hex");
function cookieOptions(req: Request) { return { ...getSessionCookieOptions(req), sameSite: "lax" as const, maxAge: lifetime }; }
export function requireMeasurementOrigin(req: Request) {
  try {
    const origin = req.headers.origin;
    if (typeof origin === "string" && new URL(origin).host === req.headers.host
      && ["https:", "http:"].includes(new URL(origin).protocol)) return;
  } catch { /* Fail closed without revealing request details. */ }
  throw new TRPCError({ code: "FORBIDDEN", message: "Use the measurement controls on this site." });
}
export function readMeasurementConsent(req: Request, now = Date.now()) {
  if (!ENV.cookieSecret) return null;
  try {
    const token = parse(req.headers.cookie ?? "")[cookieName] ?? "";
    const [id, expiry, mac, extra] = token.split(".");
    if (extra || !/^(p|qa)-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id ?? "") || !/^\d{13}$/.test(expiry ?? "")
      || !/^[0-9a-f]{64}$/.test(mac ?? "") || Number(expiry) <= now || Number(expiry) > now + lifetime) return null;
    const expected = signature(`${id}.${expiry}`);
    return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(mac, "hex")) ? { id, qa: id.startsWith("qa-") } : null;
  } catch { return null; }
}

type Column = { name: string; definition: string; nullable: string; extra: string; defaultValue: string | null };
type Index = { name: string; position: number; col: string; nonUnique: number; prefix: number | null };
export function validMeasurementMetadata(columns: Column[], indexes: Index[]) {
  const definitions: Record<string, RegExp> = { id: /^int(?:\(\d+\))?$/i, participant_id: /^varchar\(64\)$/i,
    event_type: /^enum\('visit','practice_started','practice_completed'\)$/i, occurred_at: /^timestamp(?:\(0\))?$/i };
  if (columns.length !== 4 || new Set(columns.map(c => c.name)).size !== 4
    || columns.some(c => !definitions[c.name]?.test(c.definition) || c.nullable !== "NO")
    || !columns.find(c => c.name === "id")?.extra.includes("auto_increment")
    || !/^current_timestamp(?:\(\))?$/i.test(columns.find(c => c.name === "occurred_at")?.defaultValue ?? "")) return false;
  const expected = new Map([ ["PRIMARY", ["id"]], ["practice_activity_participant_time_idx", ["participant_id", "occurred_at", "event_type"]],
    ["practice_activity_time_type_idx", ["occurred_at", "event_type"]] ]);
  const groups = new Map<string, Index[]>();
  for (const row of indexes) groups.set(row.name, [...(groups.get(row.name) ?? []), row]);
  return groups.size === expected.size && Array.from(expected).every(([name, cols]) => {
    const rows = groups.get(name)?.slice().sort((a, b) => Number(a.position) - Number(b.position));
    return rows?.length === cols.length && rows.every((row, i) => Number(row.position) === i + 1 && row.col === cols[i]
      && row.prefix === null && Number(row.nonUnique) === (name === "PRIMARY" ? 0 : 1));
  });
}
/** This deployment's connection, metadata only: never returns identifiers, rows or secrets. */
export async function inspectMeasurementStorage() {
  try {
    const database = await getDb();
    if (!database) return { ready: false };
    const [columns] = await database.execute(sql`SELECT COLUMN_NAME AS name, COLUMN_TYPE AS definition,
      IS_NULLABLE AS nullable, EXTRA AS extra, COLUMN_DEFAULT AS defaultValue FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'practice_activity_events'`);
    const [indexes] = await database.execute(sql`SELECT INDEX_NAME AS name, SEQ_IN_INDEX AS position,
      COLUMN_NAME AS col, NON_UNIQUE AS nonUnique, SUB_PART AS prefix FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'practice_activity_events'`);
    return { ready: validMeasurementMetadata(columns as unknown as Column[], indexes as unknown as Index[]) };
  } catch { return { ready: false }; }
}
export async function setMeasurementConsent(req: Request, res: Response, input: { enabled: boolean; qa: boolean }) {
  requireMeasurementOrigin(req);
  if (!input.enabled) {
    const { maxAge: _maxAge, ...options } = cookieOptions(req);
    res.clearCookie(cookieName, options);
    return { consented: false, qa: false };
  }
  if (!ENV.cookieSecret || !(await inspectMeasurementStorage()).ready) throw unavailable();
  const previous = readMeasurementConsent(req);
  const id = previous && previous.qa === input.qa ? previous.id : `${input.qa ? "qa" : "p"}-${randomUUID()}`;
  const body = `${id}.${Date.now() + lifetime}`;
  res.cookie(cookieName, `${body}.${signature(body)}`, cookieOptions(req));
  return { consented: true, qa: input.qa };
}
export async function recordMeasurementEvent(req: Request, event: MeasurementEvent, authenticated: boolean) {
  requireMeasurementOrigin(req);
  const consent = readMeasurementConsent(req);
  if (!consent) return { accepted: false, recorded: false };
  if (event !== "visit" && !authenticated) throw new TRPCError({ code: "UNAUTHORIZED", message: "Sign in to start full practice." });
  if (!(await inspectMeasurementStorage()).ready) throw unavailable();
  try {
    const database = await getDb();
    if (!database) throw unavailable();
    const dayStart = kstDateStart(kstDay()) / 1000;
    // Best-effort day/event dedup; report DISTINCT identifiers, never request/row counts.
    // Completion also requires a recent start; no retrospective reconstruction from saved answers.
    const completionGate = event === "practice_completed" ? sql`AND EXISTS (SELECT 1 FROM practice_activity_events
      WHERE participant_id = ${consent.id} AND event_type = 'practice_started'
      AND occurred_at >= CURRENT_TIMESTAMP - INTERVAL 6 HOUR)` : sql``;
    const [result] = await database.execute(sql`INSERT INTO practice_activity_events (participant_id, event_type)
      SELECT ${consent.id}, ${event} WHERE NOT EXISTS (SELECT 1 FROM practice_activity_events
      WHERE participant_id = ${consent.id} AND event_type = ${event}
      AND occurred_at >= FROM_UNIXTIME(${dayStart}) AND occurred_at < FROM_UNIXTIME(${dayStart + 86400})) ${completionGate}`);
    return { accepted: true, recorded: Number((result as unknown as { affectedRows: number }).affectedRows) > 0 };
  } catch { throw unavailable(); }
}
export async function getMeasurementReport(period: { start: string; end: string }) {
  if (!(await inspectMeasurementStorage()).ready) throw unavailable();
  const range = measurementRange(period);
  const database = await getDb();
  if (!database) throw unavailable();
  try {
    const [funnel] = await database.execute(sql`SELECT
      COUNT(DISTINCT CASE WHEN event_type = 'visit' THEN participant_id END) AS visits,
      COUNT(DISTINCT CASE WHEN event_type = 'practice_started' THEN participant_id END) AS starts,
      COUNT(DISTINCT CASE WHEN event_type = 'practice_completed' AND EXISTS
        (SELECT 1 FROM practice_activity_events s WHERE s.participant_id = e.participant_id
          AND s.event_type = 'practice_started' AND s.occurred_at >= FROM_UNIXTIME(${range.start}) AND s.occurred_at <= e.occurred_at)
        THEN participant_id END) AS completions
      FROM practice_activity_events e WHERE participant_id LIKE 'p-%'
      AND occurred_at >= FROM_UNIXTIME(${range.start}) AND occurred_at < FROM_UNIXTIME(${range.end})`);
    const [retention] = await database.execute(sql`SELECT COUNT(*) AS cohort,
      COALESCE(SUM(EXISTS (SELECT 1 FROM practice_activity_events r WHERE r.participant_id = firsts.participant_id
        AND r.event_type = 'practice_started' AND r.occurred_at >= FROM_UNIXTIME(${range.week2Start})
        AND r.occurred_at < FROM_UNIXTIME(${range.week2End}))), 0) AS returned
      FROM (SELECT participant_id, MIN(occurred_at) AS first_start FROM practice_activity_events
        WHERE event_type = 'practice_started' AND participant_id LIKE 'p-%' GROUP BY participant_id) firsts
      WHERE first_start >= FROM_UNIXTIME(${range.start}) AND first_start < FROM_UNIXTIME(${range.week2Start})`);
    const [qa] = await database.execute(sql`SELECT
      COUNT(DISTINCT CASE WHEN event_type = 'visit' THEN participant_id END) AS visits,
      COUNT(DISTINCT CASE WHEN event_type = 'practice_started' THEN participant_id END) AS starts,
      COUNT(DISTINCT CASE WHEN event_type = 'practice_completed' THEN participant_id END) AS completions
      FROM practice_activity_events WHERE participant_id LIKE 'qa-%'
      AND occurred_at >= FROM_UNIXTIME(${range.start}) AND occurred_at < FROM_UNIXTIME(${range.end})`);
    const f = (funnel as unknown as { visits: number; starts: number; completions: number }[])[0];
    const r = (retention as unknown as { cohort: number; returned: number }[])[0];
    const q = (qa as unknown as { visits: number; starts: number; completions: number }[])[0];
    return { visits: Number(f.visits), starts: Number(f.starts), completions: Number(f.completions),
      qa: { visits: Number(q.visits), starts: Number(q.starts), completions: Number(q.completions) },
      cohort: Number(r.cohort), returned: Number(r.returned), retentionMature: Date.now() / 1000 >= range.week2End,
      timezone: "Asia/Seoul" as const, observedAt: new Date(), week2Start: new Date(range.week2Start * 1000), week2End: new Date(range.week2End * 1000) };
  } catch { throw unavailable(); }
}
