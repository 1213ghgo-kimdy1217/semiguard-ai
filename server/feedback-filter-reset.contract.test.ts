import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("feedback filter reset contract", () => {
  it("identifies every active feedback filter and resets them to the documented defaults", () => {
    expect(dashboardSource).toContain("const hasActiveFeedbackFilters = feedbackHistoryFilter !== \"all\"");
    expect(dashboardSource).toContain("const resetFeedbackHistoryFilters = () =>");
    expect(dashboardSource).toContain('setFeedbackReasonFilter("all")');
    expect(dashboardSource).toContain('setFeedbackHistorySort("newest")');
    expect(dashboardSource).toContain("setFeedbackHistoryPage(1)");
  });

  it("shows a localized reset control only when at least one filter is active", () => {
    expect(dashboardSource).toContain("{hasActiveFeedbackFilters && (");
    expect(dashboardSource).toContain('lang === "ja" ? "フィルターをリセット"');
    expect(dashboardSource).toContain("onClick={resetFeedbackHistoryFilters}");
  });
});
