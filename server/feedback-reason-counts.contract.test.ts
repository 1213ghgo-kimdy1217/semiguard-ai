import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("feedback reason count contract", () => {
  it("aggregates only persisted negative feedback reason codes", () => {
    expect(dashboardSource).toContain('const feedbackReasonCounts = allFeedbackHistory.reduce<Record<"inaccurate" | "insufficient" | "irrelevant" | "other", number>>');
    expect(dashboardSource).toContain('item.feedbackType === "dislike" && item.reasonCode && item.reasonCode in counts');
  });

  it("shows negative total and each localized reason count in the filter controls", () => {
    expect(dashboardSource).toContain('count: negativeFeedbackCount');
    expect(dashboardSource).toContain('count: feedbackReasonCounts.inaccurate');
    expect(dashboardSource).toContain('count: feedbackReasonCounts.insufficient');
    expect(dashboardSource).toContain('count: feedbackReasonCounts.irrelevant');
    expect(dashboardSource).toContain('count: feedbackReasonCounts.other');
    expect(dashboardSource).toContain('<span className="opacity-70">{filter.count}</span>');
  });
});
