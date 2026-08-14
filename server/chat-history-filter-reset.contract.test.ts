import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("consultation history filter reset contract", () => {
  it("detects each active consultation history filter and restores documented defaults", () => {
    expect(dashboardSource).toContain('const hasActiveHistoryFilters = normalizedHistorySearch.length > 0');
    expect(dashboardSource).toContain("const resetHistoryFilters = () =>");
    expect(dashboardSource).toContain('setHistorySessionFilter("all")');
    expect(dashboardSource).toContain('setHistorySessionSort("newest")');
    expect(dashboardSource).toContain('setHistorySessionDatePreset("all")');
  });

  it("offers the localized reset control only when history filters are active", () => {
    expect(dashboardSource).toContain("{hasActiveHistoryFilters && (");
    expect(dashboardSource).toContain('lang === "ja" ? "フィルターをリセット"');
    expect(dashboardSource).toContain("onClick={resetHistoryFilters}");
  });
});
