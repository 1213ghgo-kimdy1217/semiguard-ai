import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("chat history filter preference contract", () => {
  it("restores and safely persists the pinned-session filter", () => {
    expect(dashboardSource).toContain('readDashboardPreference("semiguard_history_filter") === "pinned"');
    expect(dashboardSource).toContain('persistDashboardPreference("semiguard_history_filter", historySessionFilter)');
  });
});
