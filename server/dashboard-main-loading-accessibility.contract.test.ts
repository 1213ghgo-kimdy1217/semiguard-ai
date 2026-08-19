import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("dashboard main loading accessibility contract", () => {
  it("exposes initial safety monitoring work through the main content busy state", () => {
    expect(source).toContain("const safetyMonitoringInitializing = getStats.isLoading || periodOverviewQuery.isLoading || getLogs.isLoading || getDailyMaxRisk.isLoading || getRecentScoresQuery.isLoading;");
    expect(source).toContain('<main id="dashboard-main" tabIndex={-1} aria-busy={safetyMonitoringInitializing}');
  });
});
