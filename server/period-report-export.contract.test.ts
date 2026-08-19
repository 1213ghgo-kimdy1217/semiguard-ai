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
});
