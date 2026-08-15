import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("dashboard preference storage recovery contract", () => {
  it("wraps dashboard preference reads and writes for restricted storage environments", () => {
    expect(dashboardSource).toContain("function readDashboardPreference(key: string)");
    expect(dashboardSource).toContain("function persistDashboardPreference(key: string, value: string)");
    expect(dashboardSource).toContain("저장소가 제한된 경우에도 현재 세션의 대시보드 상태는 계속 유지합니다.");
  });

  it("uses safe storage helpers for history, feedback, and manual preferences", () => {
    expect(dashboardSource).toContain('readDashboardPreference("semiguard_history_search")');
    expect(dashboardSource).toContain('persistDashboardPreference("semiguard_history_search", searchKeyword)');
    expect(dashboardSource).toContain('readDashboardPreference("semiguard_feedback_sort")');
    expect(dashboardSource).toContain('persistDashboardPreference("semiguard_feedback_sort", feedbackHistorySort)');
    expect(dashboardSource).toContain('readDashboardPreference("semiguard_manual_sort")');
    expect(dashboardSource).toContain('persistDashboardPreference("semiguard_manual_sort", manualDocumentSort)');
  });
});
