import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("feedback history dialog accessibility contract", () => {
  it("exposes the feedback history overlay as a labeled dialog", () => {
    expect(dashboardSource).toContain('aria-labelledby="feedback-history-panel-title"');
    expect(dashboardSource).toContain('aria-describedby="feedback-history-panel-description"');
    expect(dashboardSource).toContain('id="feedback-history-panel-title"');
    expect(dashboardSource).toContain('id="feedback-history-panel-description"');
  });

  it("labels the feedback history search input in every supported language", () => {
    expect(dashboardSource).toContain('htmlFor="feedback-history-search"');
    expect(dashboardSource).toContain('id="feedback-history-search"');
    expect(dashboardSource).toContain('enterKeyHint="search"');
    expect(dashboardSource).toContain('lang === "ja" ? "フィードバック履歴を検索"');
  });

  it("announces the selected feedback type, reason, and quick date filters", () => {
    expect(dashboardSource).toContain('aria-pressed={feedbackHistoryFilter === filter.id}');
    expect(dashboardSource).toContain('aria-pressed={feedbackReasonFilter === filter.id}');
    expect(dashboardSource).toContain('aria-pressed={feedbackHistoryDatePreset === preset.id}');
  });

  it("announces the complete feedback-history page status after pagination changes", () => {
    expect(dashboardSource).toContain('role="status" aria-live="polite" aria-atomic="true" aria-label={lang === "ko" ? `피드백 이력 ${feedbackHistoryPage} / ${feedbackHistoryTotalPages} 페이지`');
  });

  it("announces localized retry progress and busy state when feedback-history loading fails", () => {
    expect(dashboardSource).toContain("aria-busy={feedbackHistoryQuery.isFetching || undefined}");
    expect(dashboardSource).toContain('aria-label={feedbackHistoryQuery.isFetching ? (lang === "ko" ? "피드백 이력 다시 불러오는 중"');
    expect(dashboardSource).toContain('lang === "ja" ? "フィードバック履歴を再読み込み中"');
    expect(dashboardSource).toContain('"Retrying feedback history")');
  });
});
