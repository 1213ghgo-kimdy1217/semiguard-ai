import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("safety monitoring query recovery contract", () => {
  it("distinguishes failed score trend, heatmap, and anomaly log requests from empty data", () => {
    expect(dashboardSource).toContain("getRecentScoresQuery.isError");
    expect(dashboardSource).toContain("getDailyMaxRisk.isError");
    expect(dashboardSource).toContain("getLogs.isError");
    expect(dashboardSource).toContain("위험도 점수 추이를 불러오지 못했습니다.");
    expect(dashboardSource).toContain("월간 위험도 히트맵을 불러오지 못했습니다.");
    expect(dashboardSource).toContain("이상 이력을 불러오지 못했습니다.");
  });

  it("keeps every failed safety monitoring data source independently retryable", () => {
    expect(dashboardSource).toContain("void getRecentScoresQuery.refetch()");
    expect(dashboardSource).toContain("void getDailyMaxRisk.refetch()");
    expect(dashboardSource).toContain("void getLogs.refetch()");
    expect(dashboardSource).toContain("getRecentScoresQuery.isFetching");
    expect(dashboardSource).toContain("getDailyMaxRisk.isFetching");
    expect(dashboardSource).toContain("getLogs.isFetching");
  });
});
