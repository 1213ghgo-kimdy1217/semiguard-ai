import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const schemaSource = readFileSync(resolve(process.cwd(), "drizzle/schema.ts"), "utf8");
const dbSource = readFileSync(resolve(process.cwd(), "server/semiguardDb.ts"), "utf8");
const routerSource = readFileSync(resolve(process.cwd(), "server/routers.ts"), "utf8");
const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("product usage metrics contract", () => {
  it("stores only the minimum event dimensions needed for product funnel aggregation", () => {
    expect(schemaSource).toContain('mysqlTable("product_activity_events"');
    expect(schemaSource).toContain('mysqlEnum("event_type", ["visit", "analysis_started", "analysis_viewed"])');
    expect(schemaSource).toContain('uniqueIndex("product_activity_user_event_date_unique")');
    expect(schemaSource).not.toContain('ipAddress');
    expect(schemaSource).not.toContain('deviceFingerprint');
  });

  it("deduplicates daily actions and calculates active, completion, and returning users", () => {
    expect(dbSource).toContain("export async function recordProductActivity");
    expect(dbSource).toContain("onDuplicateKeyUpdate({ set: { occurredAt: now } })");
    expect(dbSource).toContain("export async function getProductUsageMetrics");
    expect(dbSource).toContain("completionRate: analysisStartedUsers > 0");
    expect(dbSource).toContain("const returningUsers = Array.from(activeUserIds)");
  });

  it("keeps aggregate metrics behind an administrator-only protected procedure", () => {
    expect(routerSource).toContain("trackProductActivity: protectedProcedure");
    expect(routerSource).toContain("getProductUsageMetrics: protectedProcedure");
    expect(routerSource).toContain('ctx.user.role !== "admin"');
    expect(routerSource).toContain("recordProductActivity(ctx.user.id, input.eventType)");
  });

  it("tracks visit and real AI analysis flow while showing KPI cards only to administrators", () => {
    expect(dashboardSource).toContain("const authMeQuery = trpc.auth.me.useQuery");
    expect(dashboardSource).toContain('eventType: "visit"');
    expect(dashboardSource).toContain('eventType: "analysis_started"');
    expect(dashboardSource).toContain('eventType: "analysis_viewed"');
    expect(dashboardSource).toContain("isUsageMetricsAdmin && <section");
    expect(dashboardSource).toContain("대회용 제품 사용 지표");
  });

  it("localizes product-usage title and minimum-data description in Korean, English, and Japanese", () => {
    expect(dashboardSource).toContain('lang === "ko" ? "대회용 제품 사용 지표" : lang === "ja" ? "大会向けプロダクト利用指標" : "Competition product usage metrics"');
    expect(dashboardSource).toContain('사용자 ID·선택 이벤트·날짜만 집계, 자유 입력 없음');
    expect(dashboardSource).toContain('ユーザーID・選択イベント・日付のみを集計、自由記述なし');
    expect(dashboardSource).toContain('aggregates only user ID, selected events, and date; no free text');
  });
});
