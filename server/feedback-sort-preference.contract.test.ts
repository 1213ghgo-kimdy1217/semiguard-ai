import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("feedback sort preference contract", () => {
  it("restores and safely persists the feedback sort preference", () => {
    expect(dashboardSource).toContain('readDashboardPreference("semiguard_feedback_sort")');
    expect(dashboardSource).toContain('persistDashboardPreference("semiguard_feedback_sort", feedbackHistorySort)');
  });
});
