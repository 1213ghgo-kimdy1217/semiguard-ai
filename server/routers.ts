import { COOKIE_NAME } from "../shared/const";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { analyzeData, generateAnomalyData, generateNormalData, generateCautionData, generateWarningData, generateSlightCautionData, generateSlightWarningData } from "./semiguard";
import { clearAnomalyLogs, getRecentAnomalyLogs, insertAnomalyLog, incrementSampleCount, getTotalSamples, resetSavedCost, getDangerResetOffset, incrementVisitor, getTotalVisitors, getAnomalyStats, getDailyMaxRisk, getThresholds, saveThresholds, getRecentScores, getSensorThresholds, saveSensorThresholds, updateAnomalyLogLlm, getLastInsertedLogId, getLlmHistory } from "./semiguardDb";
import { getRiskLevel } from "../shared/semiguard";
import { users } from "../drizzle/schema";
import { invokeLLM } from "./_core/llm";
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
    signup: publicProcedure
      .input(z.object({
        badgeNumber: z.string().min(1),
        name: z.string().min(1),
        dateOfBirth: z.string(),
        password: z.string().min(6),
      }))
      .mutation(async ({ input }) => {
        // TODO: 실제 DB에 사용자 저장 구현
        return {
          success: true,
          message: "회원가입이 완료되었습니다. 로그인 페이지에서 로그인해주세요.",
        };
      }),
    
    login: publicProcedure
      .input(z.object({
        badgeNumber: z.string().min(1),
        password: z.string().min(1),
      }))
      .mutation(async ({ input, ctx }) => {
        // TODO: 실제 DB에서 사용자 조회 및 비밀번호 검증 구현
        return {
          success: true,
          message: "로그인이 완료되었습니다.",
        };
      }),
  }),

  semiguard: router({
    injectNormal: publicProcedure.mutation(async () => {
    const dbThresholds = await getThresholds();
    const data = generateNormalData();
    const result = analyzeData(data);
    const riskLevel = getRiskLevel(result.anomalyScore, dbThresholds) as RiskLevel;
    await incrementSampleCount();
    await insertAnomalyLog({
      userId: 1, // 기본 사용자 ID (나중에 ctx.user.id로 변경)
      current: data.current,
      temperature: data.temperature,
      vibration: data.vibration,
      noise: data.noise,
      anomalyScore: result.anomalyScore,
      riskLevel,
      isAnomaly: riskLevel === "danger" ? 1 : 0,
    });
    return { ...result, riskLevel, isAnomaly: riskLevel === "danger" };
  }),

    injectAnomaly: publicProcedure.mutation(async () => {
      const dbThresholds = await getThresholds();
      const data = generateAnomalyData();
      const result = analyzeData(data);
      const riskLevel = getRiskLevel(result.anomalyScore, dbThresholds) as RiskLevel;
      await incrementSampleCount();
      await insertAnomalyLog({
        userId: 1, // 기본 사용자 ID (나중에 ctx.user.id로 변경)
        current: data.current,
        temperature: data.temperature,
        vibration: data.vibration,
        noise: data.noise,
        anomalyScore: result.anomalyScore,
        riskLevel,
        isAnomaly: riskLevel === "danger" ? 1 : 0,
      });
      return { ...result, riskLevel, isAnomaly: riskLevel === "danger" };
    }),

    injectCaution: publicProcedure.mutation(async () => {
      const dbThresholds = await getThresholds();
      const data = generateCautionData();
      const result = analyzeData(data);
      const riskLevel = getRiskLevel(result.anomalyScore, dbThresholds) as RiskLevel;
      await incrementSampleCount();
      await insertAnomalyLog({
        userId: 1, // 기본 사용자 ID (나중에 ctx.user.id로 변경)
        current: data.current,
        temperature: data.temperature,
        vibration: data.vibration,
        noise: data.noise,
        anomalyScore: result.anomalyScore,
        riskLevel,
        isAnomaly: riskLevel === "danger" ? 1 : 0,
      });
      return { ...result, riskLevel, isAnomaly: riskLevel === "danger" };
    }),

    injectWarning: publicProcedure.mutation(async () => {
      const dbThresholds = await getThresholds();
      const data = generateWarningData();
      const result = analyzeData(data);
      const riskLevel = getRiskLevel(result.anomalyScore, dbThresholds) as RiskLevel;
      await incrementSampleCount();
      await insertAnomalyLog({
        userId: 1, // 기본 사용자 ID (나중에 ctx.user.id로 변경)
        current: data.current,
        temperature: data.temperature,
        vibration: data.vibration,
        noise: data.noise,
        anomalyScore: result.anomalyScore,
        riskLevel,
        isAnomaly: riskLevel === "danger" ? 1 : 0,
      });
      return { ...result, riskLevel, isAnomaly: riskLevel === "danger" };
    }),

    autoFetch: publicProcedure.mutation(async () => {
      // 자동 폴링: 80% 정상, 10% 약한 주의, 10% 약한 경고
      const roll = Math.random();
      const data = roll < 0.80
        ? generateNormalData()
        : roll < 0.90
          ? generateSlightCautionData()
          : generateSlightWarningData();
      const dbThresholds = await getThresholds();
      const result = analyzeData(data);
      const riskLevel = getRiskLevel(result.anomalyScore, dbThresholds) as RiskLevel;
      await incrementSampleCount();
      await insertAnomalyLog({
        userId: 1, // 기본 사용자 ID (나중에 ctx.user.id로 변경)
        current: data.current,
        temperature: data.temperature,
        vibration: data.vibration,
        noise: data.noise,
        anomalyScore: result.anomalyScore,
        riskLevel,
        isAnomaly: riskLevel === "danger" ? 1 : 0,
      });
      return { ...result, riskLevel, isAnomaly: riskLevel === "danger" };
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
          llmAnalysisKo: l.llmAnalysisKo ?? null,
          llmAnalysisEn: l.llmAnalysisEn ?? null,
          llmAnalysisJa: l.llmAnalysisJa ?? null,
        }));
      }),

    clearLogs: publicProcedure.mutation(async () => {
    await clearAnomalyLogs();
    // 로그 초기화 시 danger_reset_offset도 0으로 리셋
    await resetSavedCost(0);
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
    analyzeAnomaly: publicProcedure
      .input(
        z.object({
          current: z.number(),
          temperature: z.number(),
          vibration: z.number(),
          noise: z.number(),
          anomalyScore: z.number(),
          riskLevel: z.string(),
          lang: z.enum(["ko", "en", "ja"]).default("ko"),
          logId: z.number().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const { current, temperature, vibration, noise, anomalyScore, riskLevel, lang, logId } = input;

        const riskLabelKo = riskLevel === "danger" ? "위험" : riskLevel === "warning" ? "경고" : riskLevel === "caution" ? "주의" : "정상";
        const riskLabelJa = riskLevel === "danger" ? "危険" : riskLevel === "warning" ? "警告" : riskLevel === "caution" ? "注意" : "正常";
        const riskLabelEn = riskLevel;

        const makeMessages = (systemPrompt: string, userPrompt: string) => [
          { role: "system" as const, content: systemPrompt },
          { role: "user" as const, content: userPrompt },
        ];

        const jsonSchema = {
          type: "json_schema" as const,
          json_schema: {
            name: "anomaly_analysis",
            strict: true,
            schema: {
              type: "object",
              properties: {
                primaryCause: { type: "string" },
                details: { type: "string" },
                recommendation: { type: "string" },
              },
              required: ["primaryCause", "details", "recommendation"],
              additionalProperties: false,
            },
          },
        };

        const callLlm = async (sys: string, usr: string) => {
          const res = await invokeLLM({ messages: makeMessages(sys, usr), response_format: jsonSchema });
          const c = res.choices[0]?.message?.content;
          if (typeof c !== "string") throw new Error("no content");
          return JSON.parse(c) as { primaryCause: string; details: string; recommendation: string };
        };

        // 3개 언어 동시 LLM 호출
        const [koResult, enResult, jaResult] = await Promise.allSettled([
          callLlm(
            `당신은 반도체 공정 설비 이상 탐지 전문 AI입니다. 센서 데이터를 분석하여 이상 원인을 간결하고 전문적으로 설명합니다. 정상 기준값: 전류 5.0A(+-0.5), 온도 45도C(+-3), 진동 2.0mm/s(+-0.3), 소음 55dB(+-4). 반드시 JSON만 반환하세요.`,
            `센서 데이터: 전류 ${current.toFixed(2)}A, 온도 ${temperature.toFixed(1)}도C, 진동 ${vibration.toFixed(2)}mm/s, 소음 ${noise.toFixed(1)}dB, 이상점수 ${anomalyScore.toFixed(1)}/100, 위험도 ${riskLabelKo}. 이상 원인과 권장 조치를 JSON으로 반환하세요.`
          ),
          callLlm(
            `You are an AI specialist in semiconductor process equipment anomaly detection. Normal baseline: Current 5.0A(+-0.5), Temperature 45C(+-3), Vibration 2.0mm/s(+-0.3), Noise 55dB(+-4). Respond ONLY with JSON.`,
            `Sensor data: Current ${current.toFixed(2)}A, Temperature ${temperature.toFixed(1)}C, Vibration ${vibration.toFixed(2)}mm/s, Noise ${noise.toFixed(1)}dB, Anomaly score ${anomalyScore.toFixed(1)}/100, Risk ${riskLabelEn}. Return anomaly cause and recommendation as JSON.`
          ),
          callLlm(
            `あなたは半導体プロセス設備の異常検知専門AIです。センサーデータを分析し、異常原因を簡潔かつ専門的に説明します。正常基準値: 電流5.0A(±0.5)、温度45°C(±3)、振動2.0mm/s(±0.3)、騒音55dB(±4)。必ずJSONのみを返してください。`,
            `センサーデータ: 電流${current.toFixed(2)}A、温度${temperature.toFixed(1)}°C、振動${vibration.toFixed(2)}mm/s、騒音${noise.toFixed(1)}dB、異常スコア${anomalyScore.toFixed(1)}/100、危険度${riskLabelJa}。異常原因と推奨措置をJSONで返してください。`
          ),
        ]);

        const koData = koResult.status === "fulfilled" ? koResult.value : { primaryCause: "복합 센서 이상 감지", details: `이상 점수 ${anomalyScore.toFixed(0)}점으로 ${riskLabelKo} 단계가 감지되었습니다.`, recommendation: "즉시 설비 점검 및 운전 중단을 고려하십시오." };
        const enData = enResult.status === "fulfilled" ? enResult.value : { primaryCause: "Multiple sensor anomaly detected", details: `Anomaly score ${anomalyScore.toFixed(0)} triggered ${riskLabelEn} alert.`, recommendation: "Consider immediate equipment inspection and shutdown." };
        const jaData = jaResult.status === "fulfilled" ? jaResult.value : { primaryCause: "複合センサー異常検知", details: `異常スコア${anomalyScore.toFixed(0)}点で${riskLabelJa}レベルが検知されました。`, recommendation: "直ちに設備点検および運転停止を検討してください。" };

        // DB에 3개 언어 저장
        const targetId = logId ?? await getLastInsertedLogId();
        if (targetId) {
          await updateAnomalyLogLlm(targetId, JSON.stringify(koData), JSON.stringify(enData), JSON.stringify(jaData));
        }

        // 현재 요청 언어에 맞는 결과 반환
        return lang === "ko" ? koData : lang === "ja" ? jaData : enData;
      }),
        getLlmHistory: publicProcedure.query(async () => {
      return getLlmHistory(5);
    }),
  }),
});
export type AppRouter = typeof appRouter;
