import { describe, expect, it } from "vitest";
import { buildDashboardHistoryEvidence, matchesDashboardSnapshot } from "./dashboardHistory";

const snapshot = { current: 5, temperature: 45, vibration: 2.8, noise: 55, anomalyScore: 21, riskLevel: "normal", logId: 3 };
const row = (id: number, seconds: number, vibration = 2) => ({ ...snapshot, id, timestamp: new Date(`2026-10-07T00:00:${String(seconds).padStart(2, "0")}Z`), vibration });

describe("bounded saved synthetic observation evidence", () => {
  it("matches only the exact observation, allowing database float storage precision", () => {
    expect(matchesDashboardSnapshot(snapshot, { ...row(3, 10, 2.80000002) })).toBe(true);
    expect(matchesDashboardSnapshot(snapshot, row(3, 10, 3.5))).toBe(false);
    expect(matchesDashboardSnapshot(snapshot, { ...row(3, 10, 2.8), riskLevel: "warning" })).toBe(false);
    expect(matchesDashboardSnapshot(snapshot, { ...row(3, 10, 2.8), anomalyScore: 40 })).toBe(false);
  });

  it("compares recorded values and brackets first observed crossing without asserting true onset", () => {
    const result = buildDashboardHistoryEvidence(row(3, 10, 2.8), [row(3, 10, 2.8), row(1, 0), row(2, 6, 2.5)]);
    expect(result.status).toBe("available");
    if (result.status !== "available") throw new Error("Missing evidence");
    expect(result.window).toMatchObject({ sampleCount: 3, coverageSeconds: 10, maxGapSeconds: 6, limitedByRowCount: false, timeZone: "UTC" });
    expect(result.sensors.find(s => s.sensor === "vibration")).toMatchObject({
      firstValue: 2, lastValue: 2.8, delta: 0.8, minimum: 2, maximum: 2.8,
      firstRecordedOutsideAt: "2026-10-07T00:00:06.000Z", precedingRecordedInsideAt: "2026-10-07T00:00:00.000Z", outsideAtWindowStart: false,
    });
    expect(result).not.toHaveProperty("onset");
    expect(result).not.toHaveProperty("correlation");
  });

  it("marks an already-outside first record as left censored", () => {
    const result = buildDashboardHistoryEvidence(row(3, 10, 2.8), [row(1, 0, 2.5), row(3, 10, 2.8)]);
    if (result.status !== "available") throw new Error("Missing evidence");
    expect(result.sensors.find(s => s.sensor === "vibration")).toMatchObject({ outsideAtWindowStart: true, precedingRecordedInsideAt: null });
  });

  it("excludes later, too-old, invalid and duplicate records", () => {
    const result = buildDashboardHistoryEvidence(row(3, 10, 2.8), [
      row(3, 10, 2.8), row(1, 0), row(1, 0), row(4, 10, 9), row(2, 20, 9),
      { ...row(2, 0), timestamp: new Date("2026-10-06T23:54:00Z") },
      { ...row(2, 3), current: NaN }, { ...row(2, 3), timestamp: new Date("invalid") },
    ]);
    if (result.status !== "available") throw new Error("Missing evidence");
    expect(result.window.sampleCount).toBe(2);
    expect(result.sensors.find(s => s.sensor === "vibration")?.maximum).toBe(2.8);
  });

  it("does not call a single observation a history or silently anchor to another record", () => {
    expect(buildDashboardHistoryEvidence(row(3, 10, 2.8), [row(3, 10, 2.8)]).status).toBe("insufficient-records");
    expect(buildDashboardHistoryEvidence(row(3, 10, 2.8), [row(1, 0), row(2, 6)]).status).toBe("insufficient-records");
  });

  it("rounds database float noise before checking teaching range boundaries", () => {
    const result = buildDashboardHistoryEvidence(row(3, 10, 2.8), [row(1, 0, 2.30000004), row(3, 10, 2.8)]);
    if (result.status !== "available") throw new Error("Missing evidence");
    expect(result.sensors.find(s => s.sensor === "vibration")?.firstRecordedOutsideAt).toBe("2026-10-07T00:00:10.000Z");
    expect(result.sensors.find(s => s.sensor === "vibration")).toMatchObject({
      firstRecordedOutsideValue: 2.8,
      outsideCondition: { ko: "1.7 mm/s 미만 또는 2.3 mm/s 초과", en: "less than 1.7 mm/s or greater than 2.3 mm/s", ja: "1.7 mm/s未満または2.3 mm/sを超過" },
    });
  });

  it("provides exact duration wording without delegating clock arithmetic to AI", () => {
    const anchor = { ...row(3, 10, 2.8), timestamp: new Date("2026-10-07T00:04:10Z") };
    const result = buildDashboardHistoryEvidence(anchor, [{ ...row(1, 0), timestamp: new Date("2026-10-07T00:00:15Z") }, anchor]);
    if (result.status !== "available") throw new Error("Missing evidence");
    expect(result.window.coverageSeconds).toBe(235);
    expect(result.window.coverageLabel).toEqual({ ko: "235초", en: "235 seconds", ja: "235秒" });
  });

  it("caps observations and omits user identity, private analysis and raw rows", () => {
    const end = new Date("2026-10-07T00:05:00Z");
    const rows = Array.from({ length: 100 }, (_, i) => ({ ...row(i + 1, 0, 2.8), timestamp: new Date(end.getTime() - (99 - i) * 1000), userId: 42, llmAnalysisKo: "PRIVATE" }));
    const result = buildDashboardHistoryEvidence(rows[99], rows);
    if (result.status !== "available") throw new Error("Missing evidence");
    expect(result.window.sampleCount).toBe(60);
    expect(result.window.limitedByRowCount).toBe(true);
    expect(JSON.stringify(result)).not.toContain("PRIVATE");
    expect(result).not.toHaveProperty("userId");
    expect(result).not.toHaveProperty("rows");
  });
});
