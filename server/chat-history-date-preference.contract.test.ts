import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("chat history date preference contract", () => {
  it("restores a relative period and persists the selected period", () => {
    expect(dashboardSource).toContain('window.localStorage.getItem("semiguard_history_date_preset")');
    expect(dashboardSource).toContain('window.localStorage.setItem("semiguard_history_date_preset", historySessionDatePreset)');
    expect(dashboardSource).toContain('applyHistoryDatePreset(historySessionDatePreset)');
  });
});
