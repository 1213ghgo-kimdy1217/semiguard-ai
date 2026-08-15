import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("anomaly log filter Japanese contract", () => {
  it("localizes every risk-level filter in Japanese", () => {
    expect(dashboardSource).toContain('lang === "ja" ? "すべて" : "All"');
    expect(dashboardSource).toContain('lang === "ja" ? "正常" : "Normal"');
    expect(dashboardSource).toContain('lang === "ja" ? "注意" : "Caution"');
    expect(dashboardSource).toContain('lang === "ja" ? "警告" : "Warning"');
    expect(dashboardSource).toContain('lang === "ja" ? "危険" : "Danger"');
  });

  it("localizes the initial anomaly-log loading state", () => {
    expect(dashboardSource).toContain('lang === "ja" ? "読み込み中..." : "Loading..."');
  });
});
