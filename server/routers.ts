import { COOKIE_NAME } from "@shared/const";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { analyzeData, generateAnomalyData, generateNormalData, generateCautionData, generateWarningData } from "./semiguard";
import { clearAnomalyLogs, getRecentAnomalyLogs, insertAnomalyLog, incrementSampleCount, getTotalSamples, resetSavedCost, getDangerResetOffset, incrementVisitor, getTotalVisitors, getAnomalyStats, getDailyMaxRisk, getThresholds, saveThresholds, getRecentScores, getSensorThresholds, saveSensorThresholds } from "./semiguardDb";
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
      await incrementSampleCount();
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
      await incrementSampleCount();
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

    injectCaution: publicProcedure.mutation(async () => {
      const data = generateCautionData();
      const result = analyzeData(data);
      await incrementSampleCount();
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

    injectWarning: publicProcedure.mutation(async () => {
      const data = generateWarningData();
      const result = analyzeData(data);
      await incrementSampleCount();
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
      const [totalSamples, dangerOffset] = await Promise.all([
        getTotalSamples(),
        getDangerResetOffset(),
      ]);
      const uptimePct = totalSamples > 0
        ? Math.round(((totalSamples - stats.anomalyCount) / totalSamples) * 100)
        : 100;
      // 절감 비용: 위험 단계 탐지 1회 = 약 5천만 원 절감
      // dangerOffset은 리셋 시점의 dangerCount이므로, 그 이후 새로 증가한 건수만 카운트
      const effectiveDanger = Math.max(0, stats.dangerCount - dangerOffset);
      const savedCost = effectiveDanger * 50_000_000;
      return {
        totalDetections: stats.total,
        dangerCount: stats.dangerCount,
        anomalyCount: stats.anomalyCount,
        uptimePct,
        savedCost,
        totalVisitors,
      };
    }),

    resetSavedCost: publicProcedure.mutation(async () => {
      const stats = await getAnomalyStats();
      await resetSavedCost(stats.dangerCount);
      return { success: true };
    }),

    getDailyMaxRisk: publicProcedure.query(async () => {
      return getDailyMaxRisk();
    }),

    getThresholds: publicProcedure.query(async () => {
      return getThresholds();
    }),

    saveThresholds: publicProcedure
      .input(z.object({
        normal: z.number().int().min(1).max(98),
        caution: z.number().int().min(2).max(98),
        warning: z.number().int().min(3).max(98),
      }))
      .mutation(async ({ input }) => {
        await saveThresholds(input.normal, input.caution, input.warning);
        return { success: true };
      }),

    getRecentScores: publicProcedure
      .input(z.object({ limit: z.number().optional().default(50) }))
      .query(async ({ input }) => {
        const rows = await getRecentScores(input.limit);
        return rows.map(r => ({
          timestamp: r.timestamp.toISOString(),
          score: r.score,
          riskLevel: r.riskLevel,
        }));
      }),
    getSensorThresholds: publicProcedure.query(async () => {
      return await getSensorThresholds();
    }),
    saveSensorThresholds: publicProcedure
      .input(z.object({
        currentCaution: z.number(), currentWarning: z.number(), currentDanger: z.number(),
        tempCaution: z.number(), tempWarning: z.number(), tempDanger: z.number(),
        vibCaution: z.number(), vibWarning: z.number(), vibDanger: z.number(),
        noiseCaution: z.number(), noiseWarning: z.number(), noiseDanger: z.number(),
      }))
      .mutation(async ({ input }) => {
        await saveSensorThresholds(input);
        return { success: true };
      }),
  }),
});

export type AppRouter = typeof appRouter;
