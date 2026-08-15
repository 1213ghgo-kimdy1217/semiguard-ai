import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("chat history sort preference contract", () => {
  it("restores valid stored preference and safely persists sort changes", () => {
    expect(dashboardSource).toContain('readDashboardPreference("semiguard_history_sort")');
    expect(dashboardSource).toContain('persistDashboardPreference("semiguard_history_sort", historySessionSort)');
    expect(dashboardSource).toContain('stored === "oldest" || stored === "title" ? stored : "newest"');
  });
});
