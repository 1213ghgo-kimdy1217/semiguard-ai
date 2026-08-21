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

  it("exposes the selected anomaly detail score as a localized progress value", () => {
    expect(dashboardSource).toContain('role="progressbar" aria-label={lang === "ko" ? "이상 이력 상세 위험 점수"');
    expect(dashboardSource).toContain('"異常履歴詳細の異常スコア"');
    expect(dashboardSource).toContain('"Anomaly detail score"');
    expect(dashboardSource).toContain('aria-valuenow={Math.min(log.anomalyScore, 100)}');
  });

  it("groups anomaly-detail sensor values as a localized list", () => {
    expect(dashboardSource).toContain('role="list" aria-label={lang === "ko" ? "이상 이력 상세 센서 값"');
    expect(dashboardSource).toContain('"異常履歴詳細のセンサー値"');
    expect(dashboardSource).toContain('"Anomaly detail sensor values"');
    expect(dashboardSource).toContain('key={s.label} role="listitem"');
  });

  it("exposes saved AI anomaly analysis as a named detail region", () => {
    expect(dashboardSource).toContain('role="region" aria-labelledby="selected-log-ai-analysis-title"');
    expect(dashboardSource).toContain('<h3 id="selected-log-ai-analysis-title"');
    expect(dashboardSource).toContain('<span aria-hidden="true">🤖</span>');
    expect(dashboardSource).toContain('"AI 이상 원인 분석"');
    expect(dashboardSource).toContain('"AI異常原因分析"');
    expect(dashboardSource).toContain('"AI Anomaly Analysis"');
  });
});
