import { COOKIE_NAME, ONE_YEAR_MS } from "../shared/const";
import { z } from "zod";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { analyzeData, generateAnomalyData, generateNormalData, generateCautionData, generateWarningData, generateSlightCautionData, generateSlightWarningData } from "./semiguard";
import { clearAnomalyLogs, getRecentAnomalyLogs, insertAnomalyLog, incrementSampleCount, getTotalSamples, resetSavedCost, getDangerResetOffset, incrementVisitor, getTotalVisitors, getAnomalyStats, getDailyMaxRisk, getThresholds, saveThresholds, getRecentScores, getSensorThresholds, saveSensorThresholds, updateAnomalyLogLlm, getLastInsertedLogId, getLlmHistory } from "./semiguardDb";
import { getRiskLevel } from "../shared/semiguard";
import { users } from "../drizzle/schema";
import { invokeLLM } from "./_core/llm";
import type { RiskLevel } from "../shared/semiguard";
import * as db from "./db";
import { sdk } from "./_core/sdk";

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${derivedKey}`;
}

function verifyPassword(password: string, encodedHash: string): boolean {
  const [algorithm, salt, storedHex] = encodedHash.split("$");
  if (algorithm !== "scrypt" || !salt || !storedHex || !/^[0-9a-f]+$/i.test(storedHex)) {
    return false;
  }

  const storedKey = Buffer.from(storedHex, "hex");
  const derivedKey = scryptSync(password, salt, storedKey.length);
  return storedKey.length === derivedKey.length && timingSafeEqual(storedKey, derivedKey);
}

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
        badgeNumber: z.string().trim().min(1).max(64),
        name: z.string().trim().min(1).max(120),
        dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        password: z.string().min(6).max(128),
      }))
      .mutation(async ({ input }) => {
        const badgeNumber = input.badgeNumber.trim();
        const existingUser = await db.getUserByBadgeNumber(badgeNumber);
        if (existingUser) {
          throw new TRPCError({ code: "CONFLICT", message: "이미 가입된 회사 명찰 번호입니다." });
        }

        await db.createLocalUser({
          badgeNumber,
          name: input.name.trim(),
          dateOfBirth: input.dateOfBirth,
          passwordHash: hashPassword(input.password),
        });

        return {
          success: true,
          message: "회원가입이 완료되었습니다. 로그인 페이지에서 로그인해주세요.",
        } as const;
      }),

    login: publicProcedure
      .input(z.object({
        badgeNumber: z.string().trim().min(1).max(64),
        password: z.string().min(1).max(128),
      }))
      .mutation(async ({ input, ctx }) => {
        const user = await db.getUserByBadgeNumber(input.badgeNumber.trim());
        if (!user?.passwordHash || !verifyPassword(input.password, user.passwordHash)) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "회사 명찰 번호 또는 비밀번호가 올바르지 않습니다." });
        }

        const sessionToken = await sdk.createSessionToken(user.openId, {
          name: user.name ?? "",
          expiresInMs: ONE_YEAR_MS,
        });
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, sessionToken, {
          ...cookieOptions,
          maxAge: ONE_YEAR_MS,
        });

        return {
          success: true,
          message: "로그인이 완료되었습니다.",
        } as const;
      }),

    socialLinks: protectedProcedure.query(({ ctx }) => db.getSocialAccountLinksForUser(ctx.user.id)),

    unlinkSocial: protectedProcedure
      .input(z.object({ provider: z.enum(["google", "naver", "kakao"]) }))
      .mutation(async ({ ctx, input }) => {
        await db.deleteSocialAccountLink(ctx.user.id, input.provider);
        return { success: true } as const;
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

    chatWithAi: publicProcedure
      .input(
        z.object({
          sensorContext: z.object({
            current: z.number(),
            temperature: z.number(),
            vibration: z.number(),
            noise: z.number(),
            anomalyScore: z.number(),
            riskLevel: z.string(),
            logId: z.number().optional(),
          }),
          messages: z.array(
            z.object({
              role: z.enum(["user", "assistant"]),
              content: z.string(),
            })
          ),
          lang: z.enum(["ko", "en", "ja"]).default("ko"),
        })
      )
      .mutation(async ({ input }) => {
        const { sensorContext, messages, lang } = input;
        
        const systemPromptKo = `당신은 반도체 설비 예지보전 및 이상 진단 수석 엔지니어 AI입니다.
[현재 진단 대상 센서 데이터 및 로그 ID: #${sensorContext.logId ?? '실시간 수치'}]
- 전류: ${sensorContext.current}A (정상 5.0A 편차 ±0.5)
- 온도: ${sensorContext.temperature}°C (정상 45°C 편차 ±3)
- 진동: ${sensorContext.vibration}mm/s (정상 2.0mm/s 편차 ±0.3)
- 소음: ${sensorContext.noise}dB (정상 55dB 편차 ±4)
- 이상 점수: ${sensorContext.anomalyScore}/100, 위험 단계: ${sensorContext.riskLevel}

규칙:
1. 고정 템플릿 답변을 금지하고, 실제 센서 수치와 기준값의 구체적인 편차(예: 온도 12°C 초과 등)를 계산하여 원인을 정밀 추론하세요.
2. [확신도(Confidence)]와 [장비 즉시 중지 조건(Shutdown Criteria)]을 답변에 명시하세요.
3. 확인해야 할 부품(베어링, 인버터, 쿨링팬, 가스 밸브 등)과 단계별 복구 절차를 상세히 안내하세요.
4. 전문적이고 신뢰감 있는 수석 엔지니어 톤을 유지하세요.`;

        const systemPromptEn = `You are an expert AI senior engineer for semiconductor equipment predictive maintenance.
[Target Sensor Data & Log ID: #${sensorContext.logId ?? 'Live'}]
- Current: ${sensorContext.current}A (Normal 5.0A ±0.5)
- Temperature: ${sensorContext.temperature}°C (Normal 45°C ±3)
- Vibration: ${sensorContext.vibration}mm/s (Normal 2.0mm/s ±0.3)
- Noise: ${sensorContext.noise}dB (Normal 55dB ±4)
- Anomaly Score: ${sensorContext.anomalyScore}/100, Risk Level: ${sensorContext.riskLevel}

Rules:
1. Avoid fixed templates; calculate exact deviations from normal baselines and provide dynamic custom root-cause analysis.
2. Explicitly include [Confidence Level] and [Immediate Shutdown Criteria] in the response.
3. Detail components to inspect (bearings, inverter, cooling fan, gas valves) and step-by-step recovery procedures.
4. Maintain a professional senior engineer persona.`;

        const systemPromptJa = `あなたは半導体設備の予知保全および異常診断のシニアエンジニアAIです。
[対象センサーデータ・ログID: #${sensorContext.logId ?? 'リアルタイム'}]
- 電流: ${sensorContext.current}A (正常5.0A ±0.5)
- 温度: ${sensorContext.temperature}°C (正常45°C ±3)
- 振動: ${sensorContext.vibration}mm/s (正常2.0mm/s ±0.3)
- 騒音: ${sensorContext.noise}dB (正常55dB ±4)
- 異常スコア: ${sensorContext.anomalyScore}/100, 危険度: ${sensorContext.riskLevel}

ルール:
1. 固定テンプレートを避け、正常基準値からの具体的なセンサー偏차を算出して精密な原因推論を行ってください。
2. 回答に[信頼度 (Confidence)] および [設備即時停止条件 (Shutdown Criteria)] を必ず含めてください。
3. 点検すべき部品（ベアリング、インバーター、冷却ファン、ガスバルブ等）と段階的な復旧手順を詳しく案内してください。
4. 専門的で信頼性の高いシニアエンジニアのトーンを維持してください。`;

        const systemPrompt = lang === "ko" ? systemPromptKo : lang === "ja" ? systemPromptJa : systemPromptEn;

        const formattedMessages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
          { role: "system", content: systemPrompt },
          ...messages.map(m => ({ role: m.role, content: m.content })),
        ];

        try {
          const res = await invokeLLM({ messages: formattedMessages });
          const reply = res.choices[0]?.message?.content;
          if (typeof reply !== "string") {
            throw new Error("No reply content from LLM");
          }
          return { reply };
        } catch (err) {
          const fallback = lang === "ko"
            ? "AI 상담 연결 중 일시적인 지연이 발생했습니다. 센서 편차와 권장 조치를 다시 확인해 주세요."
            : lang === "ja"
            ? "AI相談の接続中に一時的な遅延が発生しました。センサーの偏りと推奨措置を再確認してください。"
            : "Temporary delay connecting to AI consultation. Please recheck sensor deviations and recommendations.";
          return { reply: fallback };
        }
      }),
  }),
});
export type AppRouter = typeof appRouter;
