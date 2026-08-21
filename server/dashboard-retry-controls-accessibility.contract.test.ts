import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("dashboard retry controls accessibility contract", () => {
  it("announces localized progress and busy state for core dashboard data retries", () => {
    expect(dashboardSource).toContain("aria-busy={periodOverviewQuery.isFetching || undefined}");
    expect(dashboardSource).toContain('"Retrying operational statistics"');
    expect(dashboardSource).toContain("aria-busy={getRecentScoresQuery.isFetching || undefined}");
    expect(dashboardSource).toContain('"Retrying risk score trends"');
    expect(dashboardSource).toContain("aria-busy={getDailyMaxRisk.isFetching || undefined}");
    expect(dashboardSource).toContain('"Retrying monthly risk heatmap"');
    expect(dashboardSource).toContain("aria-busy={getLogs.isFetching || undefined}");
    expect(dashboardSource).toContain('"Retrying anomaly history"');
  });
});
