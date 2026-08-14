import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("consultation history date range filter contract", () => {
  it("filters sessions by their updated timestamp before sorting and paginating", () => {
    expect(dashboardSource).toContain("historySessionStartDate");
    expect(dashboardSource).toContain("historySessionEndDate");
    expect(dashboardSource).toContain("historySessionStartTime");
    expect(dashboardSource).toContain("historySessionEndTime");
    expect(dashboardSource).toContain("updatedTime >= historySessionStartTime");
    expect(dashboardSource).toContain("updatedTime <= historySessionEndTime");
  });

  it("renders accessible localized date fields and a reset action", () => {
    expect(dashboardSource).toContain('id="consultation-history-start-date"');
    expect(dashboardSource).toContain('id="consultation-history-end-date"');
    expect(dashboardSource).toContain('lang === "ko" ? "기간"');
    expect(dashboardSource).toContain('lang === "ja" ? "リセット"');
  });
});
