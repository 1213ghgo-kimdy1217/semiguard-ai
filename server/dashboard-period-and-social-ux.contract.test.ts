import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");
const loginSource = readFileSync(resolve(process.cwd(), "client/src/pages/Login.tsx"), "utf8");
const routerSource = readFileSync(resolve(process.cwd(), "server/routers.ts"), "utf8");
const dbSource = readFileSync(resolve(process.cwd(), "server/semiguardDb.ts"), "utf8");

describe("dashboard period analysis and social UX contract", () => {
  it("offers day, week, and month analysis periods and connects charts to period data", () => {
    expect(dashboardSource).toContain('const [dashboardPeriod, setDashboardPeriod] = useState<"day" | "week" | "month" | "custom">("day")');
    expect(dashboardSource).toContain('option value="day"');
    expect(dashboardSource).toContain('option value="week"');
    expect(dashboardSource).toContain('option value="month"');
    expect(dashboardSource).toContain('data={displayedSensorChartData}');
    expect(dashboardSource).toContain('data={selectedPeriodStats?.scoreHistory ?? getRecentScoresQuery.data ?? []}');
  });

  it("provides a typed server contract for period-scoped sensor and KPI data", () => {
    expect(routerSource).toContain('getPeriodOverview: protectedProcedure');
    expect(routerSource).toContain('z.enum(["day", "week", "month"])');
    expect(dbSource).toContain('export async function getPeriodDashboardOverview(userId: number, period: DashboardPeriod, customRange?');
    expect(dbSource).toContain('DASHBOARD_PERIOD_MS');
    expect(dbSource).toContain('sensors: { average, peak }');
  });

  it("keeps gauge and KPI detail tooltips plus a recoverable social login error dialog", () => {
    expect(dashboardSource).toContain('<AppTooltip delayDuration={160}>');
    expect(dashboardSource).toContain('hover:-translate-y-0.5');
    expect(loginSource).toContain('role="alertdialog"');
    expect(loginSource).toContain('const dismissOauthError = () => {');
    expect(loginSource).toContain('const retryOauthLogin = () => {');
    expect(loginSource).toContain('rounded-xl border border-slate-200 bg-white');
  });

  it("labels the custom-period preset input and offers a mobile completion keyboard hint", () => {
    expect(dashboardSource).toMatch(
      /aria-label=\{lang === "ko" \? "사용자 지정 기간 프리셋 이름"[\s\S]*?enterKeyHint="done"/,
    );
    expect(dashboardSource).toContain("カスタム期間プリセット名");
    expect(dashboardSource).toContain("Custom period preset name");
  });

  it("announces custom-period application loading and gives both apply and save controls localized names", () => {
    expect(dashboardSource).toContain("aria-busy={periodOverviewQuery.isFetching || undefined}");
    expect(dashboardSource).toContain('aria-label={periodOverviewQuery.isFetching ? (lang === "ko" ? "사용자 지정 기간 데이터를 불러오는 중"');
    expect(dashboardSource).toContain('lang === "ja" ? "カスタム期間データを読み込み中"');
    expect(dashboardSource).toContain('"Loading custom period data")');
    expect(dashboardSource).toContain('"사용자 지정 기간 프리셋 저장"');
    expect(dashboardSource).toContain('"カスタム期間プリセットを保存"');
    expect(dashboardSource).toContain('"Save custom period preset"');
  });

  it("announces the saved preset date range when applying a custom period", () => {
    expect(dashboardSource).toContain('`${preset.name} 기간 프리셋 적용, ${preset.startDate}부터 ${preset.endDate}`');
    expect(dashboardSource).toContain('`${preset.name} 期間プリセットを適用、${preset.startDate}から${preset.endDate}`');
    expect(dashboardSource).toContain('`Apply ${preset.name} period preset, ${preset.startDate} to ${preset.endDate}`');
    expect(dashboardSource).toContain('onClick={() => applyCustomPeriodPreset(preset)} aria-label={lang === "ko"');
  });
});
