import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("anomaly history filter accessibility contract", () => {
  it("groups the risk-level filters with a localized name and keeps their pressed state", () => {
    expect(dashboardSource).toContain('role="group" aria-label={lang === "ko" ? "위험 이력 단계 필터"');
    expect(dashboardSource).toContain('"異常履歴のリスクレベルフィルター"');
    expect(dashboardSource).toContain('"Anomaly history risk-level filter"');
    expect(dashboardSource).toContain('aria-pressed={isActive}');
    expect(dashboardSource).toContain('setLogFilter(f); setLogPage(1);');
  });

  it("exposes each risk-level share bar as a localized progress value", () => {
    expect(dashboardSource).toContain('role="progressbar" aria-label={lang === "ko" ? `${s.label} 위험 단계 비율`');
    expect(dashboardSource).toContain('`${s.label}リスクレベルの割合`');
    expect(dashboardSource).toContain('`${s.label} risk level share`');
    expect(dashboardSource).toContain('aria-valuenow={pct}');
  });
});
