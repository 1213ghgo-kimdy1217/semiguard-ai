import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");
const routerSource = readFileSync(resolve(process.cwd(), "server/routers.ts"), "utf8");

describe("dashboard report sharing, forecast, and chart image export contract", () => {
  it("creates a login-protected period link and opens a user-controlled email draft", () => {
    expect(dashboardSource).toContain("const getReportShareUrl = () => {");
    expect(dashboardSource).toContain('params.set("start", appliedCustomRange.startDate)');
    expect(dashboardSource).toContain("const copyReportShareLink = async () => {");
    expect(dashboardSource).toContain("const composeReportEmail = () => {");
    expect(dashboardSource).toContain("window.location.href = `mailto:");
    expect(dashboardSource).toContain("로그인 보호 분석 기간 링크를 복사했습니다.");
  });

  it("exports only the current zoomed chart range as PNG or JPEG", () => {
    expect(dashboardSource).toContain("async function downloadSensorTrendChartImage");
    expect(dashboardSource).toContain("canvas.toBlob(resolve, mimeType, 0.94)");
    expect(dashboardSource).toContain("const exportCurrentSensorRangeImage = async");
    expect(dashboardSource).toContain("displayedSensorChartData.slice(startIndex, endIndex + 1)");
    expect(dashboardSource).toContain('exportCurrentSensorRangeImage("png")');
    expect(dashboardSource).toContain('exportCurrentSensorRangeImage("jpeg")');
  });

  it("confirms AI analysis, period CSV, and chart image exports in the active language", () => {
    expect(dashboardSource).toContain("AI 분석 결과를 텍스트 파일로 저장했습니다.");
    expect(dashboardSource).toContain("AI分析結果をテキストファイルで保存しました。");
    expect(dashboardSource).toContain("Saved AI analysis as a text file.");
    expect(dashboardSource).toContain("기간별 통계를 CSV로 저장했습니다.");
    expect(dashboardSource).toContain("期間別統計をCSVで保存しました。");
    expect(dashboardSource).toContain("Period statistics saved as CSV.");
    expect(dashboardSource).toContain("확대 구간 차트를 ${format.toUpperCase()}로 저장했습니다.");
    expect(dashboardSource).toContain("拡大範囲のチャートを${format.toUpperCase()}で保存しました。");
    expect(dashboardSource).toContain("Saved the zoomed chart as ${format.toUpperCase()}.");
  });

  it("returns forecast metadata and uses it for an explicit non-automated alert", () => {
    expect(routerSource).toContain("const forecastLevel:");
    expect(routerSource).toContain("const fallbackEvidence = lang === \"ko\"");
    expect(routerSource).toContain("forecastLevel: { type: \"string\", enum:");
    expect(routerSource).toContain("confidence: { type: \"string\", enum:");
    expect(routerSource).toContain("alert: { type: \"boolean\" }");
    expect(dashboardSource).toContain("다음 기간 위험 전망");
    expect(dashboardSource).toContain("if (aiSummary.alert)");
    expect(dashboardSource).toContain("Prioritize the report evidence and recommended action.");
  });
});
