import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("feedback date preference contract", () => {
  it("safely stores and restores preset date filters", () => {
    expect(dashboardSource).toContain('readDashboardPreference("semiguard_feedback_date_preset")');
    expect(dashboardSource).toContain('persistDashboardPreference("semiguard_feedback_date_preset", feedbackHistoryDatePreset)');
    expect(dashboardSource).toContain('feedbackHistoryDatePreset === "today" || feedbackHistoryDatePreset === "week" || feedbackHistoryDatePreset === "month"');
  });
});
