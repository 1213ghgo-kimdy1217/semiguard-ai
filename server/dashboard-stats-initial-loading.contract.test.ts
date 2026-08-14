import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("dashboard statistics initial-loading contract", () => {
  it("distinguishes the first statistics load from an actual zero value", () => {
    expect(dashboardSource).toContain("const statsInitialLoading = getStats.isLoading && !getStats.data;");
    expect(dashboardSource).toContain("const statsLoadingLabel = lang === \"ko\"");
    expect(dashboardSource).toContain("isLoading={statsInitialLoading}");
  });

  it("keeps KPI and savings cards accessible while statistics are pending", () => {
    expect(dashboardSource).toContain('aria-busy={isLoading || undefined}');
    expect(dashboardSource).toContain('{isLoading ? "—"');
    expect(dashboardSource).toContain("getStats.isError || statsInitialLoading ? \"—\"");
  });
});
