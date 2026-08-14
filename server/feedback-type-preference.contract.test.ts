import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("feedback type preference contract", () => {
  it("restores valid feedback type filters and persists changes", () => {
    expect(dashboardSource).toContain('window.localStorage.getItem("semiguard_feedback_type")');
    expect(dashboardSource).toContain('window.localStorage.setItem("semiguard_feedback_type", feedbackHistoryFilter)');
  });
});
