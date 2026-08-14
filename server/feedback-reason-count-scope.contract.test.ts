import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("feedback reason count scope contract", () => {
  it("limits reason counts to the current search and date scope while preserving negative-only semantics", () => {
    expect(dashboardSource).toContain("const feedbackReasonCountScope = allFeedbackHistory.filter(item => {");
    expect(dashboardSource).toContain('return item.feedbackType === "dislike" && matchesDate && (!normalizedFeedbackSearch || searchable.includes(normalizedFeedbackSearch));');
    expect(dashboardSource).toContain('count: feedbackReasonCountScope.length');
  });
});
