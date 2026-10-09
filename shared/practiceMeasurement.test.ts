import { describe, expect, it } from "vitest";
import { kstDateStart, kstDay, measurementConsentSchema, measurementEventSchema, measurementPeriodSchema, measurementRange, practiceMeasurementTransition } from "./practiceMeasurement";

describe("optional practice measurement boundaries", () => {
  it("accepts only consent choices and three events, not identities, answers or timestamps", () => {
    expect(measurementConsentSchema.parse({ enabled: true })).toEqual({ enabled: true, qa: false });
    for (const extra of [{ userId: 1 }, { participant_id: "p-user" }, { facts: "private answer" }, { occurred_at: "yesterday" }]) {
      expect(measurementEventSchema.safeParse({ event: "visit", ...extra }).success).toBe(false);
      expect(measurementConsentSchema.safeParse({ enabled: true, ...extra }).success).toBe(false);
    }
    expect(measurementEventSchema.safeParse({ event: "ai_success" }).success).toBe(false);
  });
  it("validates real KST dates and 1–31 inclusive days", () => {
    expect(kstDay(Date.parse("2026-10-08T15:00:00Z"))).toBe("2026-10-09");
    expect(kstDateStart("2026-10-09")).toBe(Date.parse("2026-10-08T15:00:00Z"));
    for (const period of [{ start: "2026-02-30", end: "2026-03-01" }, { start: "2026-10-09", end: "2026-10-08" },
      { start: "2026-10-01", end: "2026-11-01" }, { start: "2026-1-1", end: "2026-01-01" }]) {
      expect(measurementPeriodSchema.safeParse(period).success).toBe(false);
    }
    expect(measurementPeriodSchema.safeParse({ start: "2026-10-01", end: "2026-10-31" }).success).toBe(true);
  });
  it("uses a fixed first-week/next-week cohort with exclusive end times", () => {
    const range = measurementRange({ start: "2026-10-01", end: "2026-10-01" });
    expect(range.end - range.start).toBe(86400);
    expect(range.week2Start - range.start).toBe(7 * 86400);
    expect(range.week2End - range.week2Start).toBe(7 * 86400);
  });
  it("never reconstructs old completions and never records without consent", () => {
    expect(practiceMeasurementTransition(false, true, true, true)).toEqual({ started: false, event: null });
    expect(practiceMeasurementTransition(true, false, true, false).event).toBeNull();
    expect(practiceMeasurementTransition(true, true, false, false)).toEqual({ started: true, event: "practice_started" });
    expect(practiceMeasurementTransition(true, false, false, true)).toEqual({ started: true, event: null });
    expect(practiceMeasurementTransition(true, true, false, true).event).toBeNull();
    expect(practiceMeasurementTransition(true, false, true, true)).toEqual({ started: false, event: "practice_completed" });
  });
});
