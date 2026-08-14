import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("RAG manual filter reset contract", () => {
  it("restores search and sort state to their documented defaults", () => {
    expect(dashboardSource).toContain('const hasActiveManualFilters = normalizedManualSearch.length > 0 || manualDocumentSort !== "newest"');
    expect(dashboardSource).toContain("const resetManualFilters = () =>");
    expect(dashboardSource).toContain('setManualDocumentSort("newest")');
  });

  it("offers the localized reset control only when a manual filter is active", () => {
    expect(dashboardSource).toContain("{hasActiveManualFilters && (");
    expect(dashboardSource).toContain('lang === "ja" ? "リセット"');
    expect(dashboardSource).toContain("onClick={resetManualFilters}");
  });
});
