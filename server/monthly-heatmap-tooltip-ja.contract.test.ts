import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("monthly heatmap tooltip Japanese contract", () => {
  it("localizes date-tooltip risk levels for Japanese instead of exposing raw codes", () => {
    expect(dashboardSource).toContain('lang === "ja" ? "正常" : "Normal"');
    expect(dashboardSource).toContain('lang === "ja" ? "注意" : "Caution"');
    expect(dashboardSource).toContain('lang === "ja" ? "警告" : "Warning"');
    expect(dashboardSource).toContain('lang === "ja" ? "危険" : "Danger"');
    expect(dashboardSource).toContain('title={cellLabel}');
  });
});
