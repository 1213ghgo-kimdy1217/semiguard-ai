import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("period report export contract", () => {
  it("opens the report window synchronously from the export action so popup blockers can associate it with the user gesture", () => {
    const exportHandler = dashboardSource.slice(dashboardSource.indexOf("const exportSelectedPeriodPdf = async () =>"));

    expect(exportHandler).toContain('const reportWindow = window.open("", "_blank", "width=1000,height=800");');
    expect(exportHandler.indexOf('const reportWindow = window.open("", "_blank", "width=1000,height=800");')).toBeLessThan(exportHandler.indexOf("setPdfExporting(true)"));
  });

  it("provides localized guidance when the report window is blocked", () => {
    expect(dashboardSource).toContain("팝업 차단을 확인해주세요.");
    expect(dashboardSource).toContain("ポップアップブロックを確認してください。");
    expect(dashboardSource).toContain("Check popup blocking.");
  });

  it("writes the structured report to the prepared window and opens the print dialog after content is ready", () => {
    expect(dashboardSource).toContain("openStructuredPeriodReport(selectedPeriodStats, lang, selectedPeriodLabel, aiSummary, reportWindow);");
    expect(dashboardSource).toContain("reportWindow.document.write(`<!doctype html><html lang=");
    expect(dashboardSource).toContain("reportWindow.document.close();");
    expect(dashboardSource).toContain("window.setTimeout(() => { reportWindow.focus(); reportWindow.print(); }, 250);");
  });

  it("announces the localized PDF report preparation state through the export control name", () => {
    expect(dashboardSource).toContain('aria-label={pdfExporting ? (lang === "ko" ? "PDF 보고서를 준비하는 중"');
    expect(dashboardSource).toContain('lang === "ja" ? "PDFレポートを準備中"');
    expect(dashboardSource).toContain('"Preparing PDF report")');
  });

  it("announces period data loading through the disabled PDF control before report preparation begins", () => {
    expect(dashboardSource).toContain('aria-busy={pdfExporting || periodOverviewQuery.isFetching || undefined}');
    expect(dashboardSource).toContain('periodOverviewQuery.isFetching ? (lang === "ko" ? "기간 분석 데이터를 불러오는 중"');
    expect(dashboardSource).toContain('lang === "ja" ? "期間分析データを読み込み中"');
    expect(dashboardSource).toContain('"Loading period analysis data")');
  });

  it("hides the decorative PDF and loading icons while keeping localized report text visible", () => {
    expect(dashboardSource).toContain('<span aria-hidden="true">📄</span>');
    expect(dashboardSource).toContain('pdfExporting ? <span aria-hidden="true"');
    expect(dashboardSource).toContain('lang === "ko" ? "보고서"');
    expect(dashboardSource).toContain('lang === "ja" ? "レポート"');
    expect(dashboardSource).toContain('"Report"');
  });

  it("provides a localized descriptive name and busy state for the period CSV export control", () => {
    expect(dashboardSource).toContain("aria-busy={periodOverviewQuery.isFetching || undefined}");
    expect(dashboardSource).toContain('aria-label={periodOverviewQuery.isFetching ? (lang === "ko" ? "기간 분석 데이터를 불러오는 중"');
    expect(dashboardSource).toContain('lang === "ja" ? "期間分析データを読み込み中"');
    expect(dashboardSource).toContain('"Loading period analysis data")');
    expect(dashboardSource).toContain('"기간 분석 CSV 내보내기"');
    expect(dashboardSource).toContain('lang === "ja" ? "期間分析CSVを出力"');
    expect(dashboardSource).toContain('"Export period analysis CSV"');
  });
});
