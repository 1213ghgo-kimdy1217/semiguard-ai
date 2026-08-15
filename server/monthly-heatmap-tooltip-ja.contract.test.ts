import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("monthly heatmap tooltip Japanese contract", () => {
  it("localizes date-tooltip risk levels for Japanese instead of exposing raw codes", () => {
    expect(dashboardSource).toContain('lang === "ja" ? { normal: "正常", caution: "注意", warning: "警告", danger: "危険" }[lvl] : lvl');
  });
});
