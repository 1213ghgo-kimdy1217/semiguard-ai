import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("feedback history filter accessibility contract", () => {
  it("groups evaluation and reason filters with a localized accessible name", () => {
    expect(dashboardSource).toContain('role="group" aria-label={lang === "ko" ? "피드백 이력 필터"');
    expect(dashboardSource).toContain('"フィードバック履歴フィルター"');
    expect(dashboardSource).toContain('"Feedback history filters"');
    expect(dashboardSource).toContain('aria-pressed={feedbackHistoryFilter === filter.id}');
    expect(dashboardSource).toContain('aria-pressed={feedbackReasonFilter === filter.id}');
  });

  it("groups quick date presets with a localized name and pressed state", () => {
    expect(dashboardSource).toContain('role="group" aria-label={lang === "ko" ? "피드백 이력 빠른 기간"');
    expect(dashboardSource).toContain('"フィードバック履歴のクイック期間"');
    expect(dashboardSource).toContain('"Feedback history quick period"');
    expect(dashboardSource).toContain('aria-pressed={feedbackHistoryDatePreset === preset.id}');
  });

  it("labels the feedback sort select and icon-only date reset control", () => {
    expect(dashboardSource).toContain('"피드백 이력 정렬"');
    expect(dashboardSource).toContain('"フィードバック履歴の並び順"');
    expect(dashboardSource).toContain('"Feedback history sort order"');
    expect(dashboardSource).toContain('"피드백 이력 날짜 필터 초기화"');
    expect(dashboardSource).toContain('"フィードバック履歴の日付フィルターをリセット"');
    expect(dashboardSource).toContain('"Reset feedback history date filter"');
  });
});
