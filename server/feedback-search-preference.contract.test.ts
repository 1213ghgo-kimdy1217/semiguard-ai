import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("feedback search preference contract", () => {
  it("restores and safely persists the feedback search query", () => {
    expect(dashboardSource).toContain('readDashboardPreference("semiguard_feedback_search")');
    expect(dashboardSource).toContain('persistDashboardPreference("semiguard_feedback_search", feedbackHistorySearch)');
  });
});
