import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("monthly risk heatmap Japanese locale contract", () => {
  it("localizes the legend and empty-state labels when Japanese is selected", () => {
    expect(dashboardSource).toContain('lang === "ko" ? "범례:" : lang === "ja" ? "凡例:" : "Legend:"');
    expect(dashboardSource).toContain('lang === "ko" ? "데이터 없음" : lang === "ja" ? "データなし" : "No data"');
  });
});
