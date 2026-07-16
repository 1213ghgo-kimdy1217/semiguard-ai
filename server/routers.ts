import { COOKIE_NAME } from "@shared/const";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { analyzeData, generateAnomalyData, generateNormalData } from "./semiguard";
import { clearAnomalyLogs, getRecentAnomalyLogs, insertAnomalyLog } from "./semiguardDb";
import { incrementVisitor, getTotalVisitors, getAnomalyStats } from "./semiguardDb";
import type { RiskLevel } from "../shared/semiguard";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  semiguard: router({
    injectNormal: publicProcedure.mutation(async () => {
      const data = generateNormalData();
      const result = analyzeData(data);
      if (result.isAnomaly) {
        await insertAnomalyLog({
          current: data.current,
          temperature: data.temperature,
          vibration: data.vibration,
          noise: data.noise,
          anomalyScore: result.anomalyScore,
          riskLevel: result.riskLevel as RiskLevel,
          isAnomaly: 1,
        });
      }
      return result;
    }),

    injectAnomaly: publicProcedure.mutation(async () => {
      const data = generateAnomalyData();
      const result = analyzeData(data);
      await insertAnomalyLog({
        current: data.current,
        temperature: data.temperature,
        vibration: data.vibration,
        noise: data.noise,
        anomalyScore: result.anomalyScore,
        riskLevel: result.riskLevel as RiskLevel,
        isAnomaly: result.isAnomaly ? 1 : 0,
      });
      return result;
    }),

    getLogs: publicProcedure
      .input(z.object({ limit: z.number().optional().default(50) }))
      .query(async ({ input }) => {
        const logs = await getRecentAnomalyLogs(input.limit);
        return logs.map(l => ({
          id: l.id,
          timestamp: l.timestamp.toISOString(),
          current: l.current,
          temperature: l.temperature,
          vibration: l.vibration,
          noise: l.noise,
          anomalyScore: l.anomalyScore,
          riskLevel: l.riskLevel,
          isAnomaly: l.isAnomaly === 1,
        }));
      }),

    clearLogs: publicProcedure.mutation(async () => {
      await clearAnomalyLogs();
      return { success: true };
    }),

    // 방문자 카운터 증가 및 조회
    trackVisit: publicProcedure.mutation(async () => {
      const todayCount = await incrementVisitor();
      const totalCount = await getTotalVisitors();
      return { todayCount, totalCount };
    }),

    getStats: publicProcedure.query(async () => {
      const [stats, totalVisitors] = await Promise.all([
        getAnomalyStats(),
        getTotalVisitors(),
      ]);
      // 정상 가동률: 전체 중 이상 아닌 비율
      const uptimePct = stats.total > 0
        ? Math.round(((stats.total - stats.anomalyCount) / stats.total) * 100)
        : 100;
      // 절감 비용: 위험 단계 탐지 1회 = 평균 5천만원 절감 (반도체 공장 비계획 정지 기준)
      const savedCost = stats.dangerCount * 50_000_000;
      return {
        totalDetections: stats.total,
        dangerCount: stats.dangerCount,
        anomalyCount: stats.anomalyCount,
        uptimePct,
        savedCost,
        totalVisitors,
      };
    }),
  }),
});

export type AppRouter = typeof appRouter;
