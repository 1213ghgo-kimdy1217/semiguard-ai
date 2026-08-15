import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("feedback reason preference contract", () => {
  it("restores valid reason filters and safely persists changes", () => {
    expect(dashboardSource).toContain('readDashboardPreference("semiguard_feedback_reason")');
    expect(dashboardSource).toContain('persistDashboardPreference("semiguard_feedback_reason", feedbackReasonFilter)');
  });
});
