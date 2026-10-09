import { z } from "zod";

export const measurementConsentSchema = z.object({ enabled: z.boolean(), qa: z.boolean().default(false) }).strict();
export const measurementEventSchema = z.object({ event: z.enum(["visit", "practice_started", "practice_completed"]) }).strict();
export type MeasurementEvent = z.infer<typeof measurementEventSchema>["event"];
const day = 86400000;
export function kstDateStart(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return NaN;
  const time = Date.parse(`${value}T00:00:00+09:00`);
  return Number.isFinite(time) && new Date(time + 9 * 3600000).toISOString().slice(0, 10) === value ? time : NaN;
}
export function kstDay(now = Date.now()) { return new Date(now + 9 * 3600000).toISOString().slice(0, 10); }
export const measurementPeriodSchema = z.object({ start: z.string(), end: z.string() }).strict().refine(value => {
  const start = kstDateStart(value.start), end = kstDateStart(value.end);
  return Number.isFinite(start) && Number.isFinite(end) && end >= start && end - start < 31 * day;
}, "Select a valid period of 1–31 days (Asia/Seoul).");
export function measurementRange(period: z.infer<typeof measurementPeriodSchema>) {
  const clean = measurementPeriodSchema.parse(period);
  const start = kstDateStart(clean.start) / 1000;
  return { start, end: (kstDateStart(clean.end) + day) / 1000, week2Start: start + 7 * 86400, week2End: start + 14 * 86400 };
}

/** No old restored review is a new completion; completion needs a new start in this session. */
export function practiceMeasurementTransition(consented: boolean, running: boolean, reviewed: boolean, started: boolean) {
  if (!consented) return { started: false, event: null };
  if (running && !started) return { started: true, event: "practice_started" as const };
  if (reviewed && started) return { started: false, event: "practice_completed" as const };
  return { started, event: null };
}
