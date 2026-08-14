import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("safety monitoring connection status contract", () => {
  it("derives header connection status from all core safety data queries", () => {
    expect(dashboardSource).toContain("const safetyMonitoringHasError = getStats.isError || getLogs.isError || getDailyMaxRisk.isError || getRecentScoresQuery.isError");
    expect(dashboardSource).toContain("const safetyMonitoringInitializing = getStats.isLoading || getLogs.isLoading || getDailyMaxRisk.isLoading || getRecentScoresQuery.isLoading");
    expect(dashboardSource).toContain("복구 필요");
    expect(dashboardSource).toContain("데이터 연결");
  });

  it("retries every failed safety data source from one guarded recovery control", () => {
    expect(dashboardSource).toContain("const retrySafetyMonitoring = () =>");
    expect(dashboardSource).toContain("void getStats.refetch()");
    expect(dashboardSource).toContain("void getLogs.refetch()");
    expect(dashboardSource).toContain("void getDailyMaxRisk.refetch()");
    expect(dashboardSource).toContain("void getRecentScoresQuery.refetch()");
    expect(dashboardSource).toContain("onClick={retrySafetyMonitoring}");
  });
});
