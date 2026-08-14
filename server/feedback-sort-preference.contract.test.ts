import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("feedback sort preference contract", () => {
  it("restores and persists the feedback sort preference", () => {
    expect(dashboardSource).toContain('window.localStorage.getItem("semiguard_feedback_sort")');
    expect(dashboardSource).toContain('window.localStorage.setItem("semiguard_feedback_sort", feedbackHistorySort)');
  });
});
