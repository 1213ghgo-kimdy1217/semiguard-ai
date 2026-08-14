import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("operational statistics reliability contract", () => {
  it("does not present failed KPI data as current zero-valued statistics", () => {
    expect(dashboardSource).toContain('value={getStats.isError ? "—"');
    expect(dashboardSource).toContain('{getStats.isError || statsInitialLoading ? "—" : `₩${displayedSavedCost.toLocaleString()}`}');
    expect(dashboardSource).toContain("KPI와 예상 절감 비용은 최신 값이 아닐 수 있습니다.");
  });

  it("provides a guarded retry action when operational statistics fail", () => {
    expect(dashboardSource).toContain("void getStats.refetch()");
    expect(dashboardSource).toContain("getStats.isFetching");
    expect(dashboardSource).toContain("운영 통계를 불러오지 못했습니다.");
  });
});
