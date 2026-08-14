import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("dashboard control Japanese localization contract", () => {
  it("localizes risk and sensor threshold configuration controls in Japanese", () => {
    expect(dashboardSource).toContain("リスクしきい値設定");
    expect(dashboardSource).toContain("正常の最大スコア");
    expect(dashboardSource).toContain("センサー別しきい値設定");
    expect(dashboardSource).toContain("電流 (A)");
    expect(dashboardSource).toContain("既定値にリセット");
  });

  it("uses the shared translated processing label for simulator actions", () => {
    expect(dashboardSource).not.toContain("<span>처리 중...</span>");
    expect(dashboardSource).toContain('<ButtonSpinner color="#22c55e" /><span>{t.processing}</span>');
    expect(dashboardSource).toContain('lang === "ja" ? "危険" : "Danger"');
  });
});
