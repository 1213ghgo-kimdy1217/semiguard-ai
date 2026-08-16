import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("dashboard period export, loading, and theme contract", () => {
  it("exports the selected period to both UTF-8 CSV and a structured printable report", () => {
    expect(dashboardSource).toContain("function exportPeriodOverviewToCsv(overview: PeriodOverviewData");
    expect(dashboardSource).toContain('type: "text/csv;charset=utf-8;"');
    expect(dashboardSource).toContain("function openStructuredPeriodReport(overview: PeriodOverviewData");
    expect(dashboardSource).toContain('window.open("", "_blank", "width=1000,height=800")');
    expect(dashboardSource).toContain("reportWindow.print()");
    expect(dashboardSource).toContain("onClick={exportSelectedPeriodCsv}");
    expect(dashboardSource).toContain("onClick={exportSelectedPeriodPdf}");
  });

  it("shows an accessible skeleton while the selected period changes", () => {
    expect(dashboardSource).toContain("const [isPeriodChanging, setIsPeriodChanging] = useState(false)");
    expect(dashboardSource).toContain("const showPeriodSkeleton = isPeriodChanging");
    expect(dashboardSource).toContain('role="status" aria-live="polite"');
    expect(dashboardSource).toContain("animate-pulse");
    expect(dashboardSource).toContain("handleDashboardPeriodChange");
  });

  it("keeps a visible, persistent, keyboard-labelled header theme switch", () => {
    expect(dashboardSource).toContain("const toggleDashboardTheme = () => setIsDark");
    expect(dashboardSource).toContain('localStorage.setItem("semiguard_theme", next ? "dark" : "light")');
    expect(dashboardSource).toContain("onClick={toggleDashboardTheme}");
    expect(dashboardSource).toContain("aria-pressed={isDark}");
    expect(dashboardSource).toContain("다크 모드로 전환");
  });
});
