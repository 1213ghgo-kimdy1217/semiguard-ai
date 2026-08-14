import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("anomaly log CSV Japanese localization contract", () => {
  it("exports Japanese headers and anomaly status values for Japanese users", () => {
    expect(dashboardSource).toContain('"発生時刻", "電流(A)", "温度(°C)"');
    expect(dashboardSource).toContain('lang === "ja" ? "異常" : "Anomaly"');
    expect(dashboardSource).toContain('lang === "ja" ? "正常" : "Normal"');
  });

  it("uses a Japanese filename prefix without changing the UTF-8 BOM export flow", () => {
    expect(dashboardSource).toContain('lang === "ja" ? "セミガード_異常履歴" : "semiguard_logs"');
    expect(dashboardSource).toContain('const bom = "\\uFEFF"');
    expect(dashboardSource).toContain('a.download = `${filenamePrefix}_${new Date().toISOString().slice(0, 10)}.csv`;');
  });
});
