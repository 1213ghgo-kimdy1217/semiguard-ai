import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(
  resolve(process.cwd(), "client/src/pages/Dashboard.tsx"),
  "utf8"
);

describe("dashboard analysis and risk error accessibility contract", () => {
  it("announces each localized analysis, risk, and anomaly-history failure as an atomic alert", () => {
    expect(dashboardSource).toMatch(
      /llmHistoryQuery\.isError \? \(\s*<div[^>]*role="alert"[^>]*aria-atomic="true"/
    );
    expect(dashboardSource).toMatch(
      /getRecentScoresQuery\.isError \? \(\s*<div[^>]*role="alert"[^>]*aria-atomic="true"/
    );
    expect(dashboardSource).toMatch(
      /getDailyMaxRisk\.isError \? \(\s*<div[^>]*>[\s\S]*?<div[^>]*role="alert"[^>]*aria-atomic="true"/
    );
    expect(dashboardSource).toMatch(
      /getLogs\.isError \? \([\s\S]*?<div[^>]*role="alert"[^>]*aria-atomic="true"/
    );
  });

  it("keeps the monthly risk heatmap failure message while hiding its decorative warning symbol", () => {
    expect(dashboardSource).toContain('<p><span aria-hidden="true">⚠️</span>{" "}{lang === "ko" ? "월간 위험도 히트맵을 불러오지 못했습니다."');
  });

  it("hides decorative warning symbols while retaining other localized dashboard error messages", () => {
    expect(dashboardSource).toContain('<p><span aria-hidden="true">⚠️</span>{" "}{lang === "ko" ? "매뉴얼 검색 결과를 불러오지 못했습니다."');
    expect(dashboardSource).toContain('<p><span aria-hidden="true">⚠️</span>{" "}{lang === "ko" ? `“${historySessionLoadError.title}” 기록을 열지 못했습니다.`');
    expect(dashboardSource).toContain('<p><span aria-hidden="true">⚠️</span>{" "}{lang === "ko" ? "상담 기록을 불러오지 못했습니다."');
    expect(dashboardSource).toContain('<p><span aria-hidden="true">⚠️</span>{" "}{lang === "ko" ? "상담 기록 검색 결과를 불러오지 못했습니다."');
    expect(dashboardSource).toContain('<p><span aria-hidden="true">⚠️</span>{" "}{lang === "ko" ? "운영 통계를 불러오지 못했습니다. KPI와 예상 절감 비용은 최신 값이 아닐 수 있습니다."');
    expect(dashboardSource).toContain('<p><span aria-hidden="true">⚠️</span>{" "}{lang === "ko" ? "위험도 점수 추이를 불러오지 못했습니다."');
    expect(dashboardSource).toContain('<p><span aria-hidden="true">⚠️</span>{" "}{lang === "ko" ? "이상 이력을 불러오지 못했습니다."');
  });
});
