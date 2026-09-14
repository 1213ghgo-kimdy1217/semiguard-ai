import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const routerSource = readFileSync(resolve(process.cwd(), "server/routers.ts"), "utf8");
const dbSource = readFileSync(resolve(process.cwd(), "server/semiguardDb.ts"), "utf8");

describe("authenticated user data isolation contract", () => {
  it("stores generated anomaly logs under the authenticated user instead of a fixed user", () => {
    expect(routerSource).not.toMatch(/userId:\s*1/);
    expect(routerSource.match(/userId:\s*ctx\.user\.id/g)?.length ?? 0).toBeGreaterThanOrEqual(5);
  });

  it("scopes anomaly log reads, detail lookup, clearing, history, and analysis updates by user", () => {
    expect(routerSource).toContain("getRecentAnomalyLogs(ctx.user.id, input.limit)");
    expect(routerSource).toContain("getAnomalyLogById(input.id, ctx.user.id)");
    expect(routerSource).toContain("clearAnomalyLogs(ctx.user.id)");
    expect(routerSource).toContain("getLlmHistory(ctx.user.id, 5)");
    expect(routerSource).toContain("updateAnomalyLogLlm(logId, ctx.user.id,");
    expect(dbSource).toContain("eq(anomalyLogs.userId, userId)");
  });

  it("scopes dashboard history and statistics to the authenticated user", () => {
    expect(routerSource).toContain("getAnomalyStats(ctx.user.id)");
    expect(routerSource).toContain("getDailyMaxRisk(ctx.user.id)");
    expect(routerSource).toContain("getRecentScores(ctx.user.id, input.limit)");
    expect(routerSource).toMatch(/getPeriodDashboardOverview\(\s*ctx\.user\.id,/);
    expect(routerSource).toContain("getUserDangerResetOffset(ctx.user.id)");
    expect(routerSource).toContain("resetUserSavedCost(ctx.user.id");
    expect(dbSource).toMatch(/export async function getPeriodDashboardOverview\(\s*userId: number/);
  });
});
