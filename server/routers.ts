import { COOKIE_NAME, ONE_YEAR_MS } from "../shared/const";
import { z } from "zod";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { analyzeData, generateAnomalyData, generateNormalData, generateCautionData, generateWarningData, generateSlightCautionData, generateSlightWarningData } from "./semiguard";
import { clearAnomalyLogs, getRecentAnomalyLogs, insertAnomalyLog, incrementSampleCount, getTotalSamples, resetSavedCost, getDangerResetOffset, incrementVisitor, getTotalVisitors, getAnomalyStats, getDailyMaxRisk, getThresholds, saveThresholds, getRecentScores, getPeriodDashboardOverview, getSensorThresholds, saveSensorThresholds, updateAnomalyLogLlm, getLastInsertedLogId, getLlmHistory } from "./semiguardDb";
import { getRiskLevel } from "../shared/semiguard";
import { users } from "../drizzle/schema";
import { invokeLLM } from "./_core/llm";
import type { RiskLevel } from "../shared/semiguard";
import { MANUAL_CHUNK_LIMIT, splitManualTextIntoChunks } from "../shared/ragManual";
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

type ChatLanguage = "ko" | "en" | "ja";

function getFeedbackStrategy(reasons: string[], lang: ChatLanguage) {
  const combined = reasons.join(" ").toLowerCase();
  const inaccurate = /inaccurate|정확|正確|incorrect|오류/.test(combined);
  const insufficient = /insufficient|설명|근거|詳細|説明/.test(combined);
  const irrelevant = /irrelevant|관련 없|関係ない|질문/.test(combined);
  if (lang === "ko") {
    if (inaccurate) return "수치와 정상 기준의 편차를 다시 계산하고, 확인되지 않은 사실은 단정하지 마세요.";
    if (insufficient) return "센서별 근거, 원인 후보별 판단 이유, 점검 순서를 더 구체적으로 보완하세요.";
    if (irrelevant) return "사용자의 가장 최근 질문 의도를 먼저 한 문장으로 재확인한 뒤, 그 질문에만 직접 답하세요.";
    return "사용자가 남긴 구체적 의견을 우선 반영하고, 이전 답변의 부족한 점을 반복하지 마세요.";
  }
  if (lang === "ja") {
    if (inaccurate) return "数値と正常基準からの偏差を再計算し、確認できない事実を断定しないでください。";
    if (insufficient) return "センサー根拠、原因候補ごとの判断理由、点検手順をより具体的に補ってください。";
    if (irrelevant) return "ユーザーの最新の質問意図を一文で確認してから、その質問に直接回答してください。";
    return "ユーザーの具体的な意見を優先して反映し、以前の不足を繰り返さないでください。";
  }
  if (inaccurate) return "Recalculate deviations from the stated normal baselines and never present an unverified claim as fact.";
  if (insufficient) return "Add sensor-by-sensor evidence, rationale for each cause candidate, and a concrete inspection sequence.";
  if (irrelevant) return "Restate the user's latest intent in one sentence and answer that question directly.";
  return "Prioritize the user's detailed feedback and avoid repeating the previous shortcoming.";
}

function buildEvidenceGate(sensorContext: {
  current: number; temperature: number; vibration: number; noise: number; anomalyScore: number; riskLevel: string;
}, lang: ChatLanguage) {
  const sensors = [
    { ko: "전류", en: "Current", ja: "電流", value: sensorContext.current, normal: 5, tolerance: 0.5, unit: "A" },
    { ko: "온도", en: "Temperature", ja: "温度", value: sensorContext.temperature, normal: 45, tolerance: 3, unit: "°C" },
    { ko: "진동", en: "Vibration", ja: "振動", value: sensorContext.vibration, normal: 2, tolerance: 0.3, unit: "mm/s" },
    { ko: "소음", en: "Noise", ja: "騒音", value: sensorContext.noise, normal: 55, tolerance: 4, unit: "dB" },
  ].map(sensor => ({ ...sensor, delta: sensor.value - sensor.normal, zScore: Math.abs(sensor.value - sensor.normal) / sensor.tolerance }))
    .sort((a, b) => b.zScore - a.zScore);
  const keySensors = sensors.slice(0, 2);
  const evidence = keySensors.map(sensor => {
    const name = lang === "ko" ? sensor.ko : lang === "ja" ? sensor.ja : sensor.en;
    const signedDelta = `${sensor.delta >= 0 ? "+" : ""}${sensor.delta.toFixed(sensor.unit === "°C" || sensor.unit === "dB" ? 1 : 2)}`;
    return `${name} ${sensor.value}${sensor.unit} (${signedDelta}${sensor.unit}, ${sensor.zScore.toFixed(1)}σ)`;
  });
  const confidence = sensorContext.anomalyScore >= 70 || keySensors[0].zScore >= 2.5
    ? (lang === "ko" ? "높음" : lang === "ja" ? "高" : "High")
    : sensorContext.anomalyScore >= 30 || keySensors[0].zScore >= 1.5
      ? (lang === "ko" ? "보통" : lang === "ja" ? "中" : "Medium")
      : (lang === "ko" ? "낮음" : lang === "ja" ? "低" : "Low");
  const followUp = sensorContext.anomalyScore >= 70
    ? (lang === "ko" ? "현장 점검 전까지 장비 상태를 지속 감시하고, 규정된 안전 절차에 따라 담당자에게 즉시 보고하세요." : lang === "ja" ? "現場点検まで設備状態を継続監視し、定められた安全手順に従って担当者へ直ちに報告してください。" : "Continue monitoring until inspection and report to the responsible operator under the approved safety procedure.")
    : (lang === "ko" ? "최근 추이와 부품 점검 이력을 추가로 확인하세요." : lang === "ja" ? "直近の推移と部品点検履歴を追加で確認してください。" : "Verify the recent trend and the component inspection history.");
  return { evidence, confidence, followUp };
}

function formatEvidenceGate(gate: ReturnType<typeof buildEvidenceGate>, lang: ChatLanguage) {
  if (lang === "ko") return `\n\n---\n**[서버 검증 게이트]**\n- **근거 센서:** ${gate.evidence.join(" · ")}\n- **신뢰도:** ${gate.confidence} — 현재 실시간 수치와 규칙 기반 위험 점수에 근거함\n- **추가 확인 필요:** ${gate.followUp}`;
  if (lang === "ja") return `\n\n---\n**[サーバー検証ゲート]**\n- **根拠センサー:** ${gate.evidence.join(" · ")}\n- **信頼度:** ${gate.confidence} — 現在の実測値とルールベースのリスクスコアに基づく\n- **追加確認事項:** ${gate.followUp}`;
  return `\n\n---\n**[Server Validation Gate]**\n- **Evidence sensors:** ${gate.evidence.join(" · ")}\n- **Confidence:** ${gate.confidence} — based on live measurements and the rule-based risk score\n- **Further verification:** ${gate.followUp}`;
}

function buildSafeFallbackDiagnostic(sensorContext: {
  current: number; temperature: number; vibration: number; noise: number; anomalyScore: number; riskLevel: string;
}, lang: ChatLanguage) {
  const gate = buildEvidenceGate(sensorContext, lang);
  const requiresUrgentReview = sensorContext.anomalyScore >= 70;

  if (lang === "ko") {
    return `**[기본 안전 진단]**\nAI 상담 서비스를 일시적으로 사용할 수 없어, 현재 실시간 센서와 규칙 기반 위험 판정으로 안전 진단을 제공합니다.\n\n**[현재 상태]**\n- 규칙 기반 위험 단계: **${sensorContext.riskLevel}** (${sensorContext.anomalyScore}/100)\n- 주요 편차: ${gate.evidence.join(" · ")}\n\n**[권장 조치]**\n1. ${requiresUrgentReview ? "현장 담당자에게 즉시 보고하고, 규정된 안전 절차에 따라 점검 준비를 진행하세요." : "최근 추이와 설비 점검 이력을 확인한 뒤, 다음 정기 점검에서 주요 편차 센서를 우선 확인하세요."}\n2. 현재 수치만으로 고장 원인을 단정하지 말고, 관련 매뉴얼과 현장 점검 결과를 함께 확인하세요.${formatEvidenceGate(gate, lang)}`;
  }
  if (lang === "ja") {
    return `**[基本安全診断]**\nAI相談サービスを一時的に利用できないため、現在の実測センサー値とルールベースの危険判定に基づく安全診断を提供します。\n\n**[現在の状態]**\n- ルールベースの危険度: **${sensorContext.riskLevel}** (${sensorContext.anomalyScore}/100)\n- 主な偏差: ${gate.evidence.join(" · ")}\n\n**[推奨対応]**\n1. ${requiresUrgentReview ? "現場担当者へ直ちに報告し、定められた安全手順に従って点検の準備を進めてください。" : "最近の推移と設備点検履歴を確認し、次回点検では主要な偏差センサーを優先して確認してください。"}\n2. 現在の数値だけで故障原因を断定せず、関連マニュアルと現地点検の結果を併せて確認してください。${formatEvidenceGate(gate, lang)}`;
  }
  return `**[Baseline Safety Diagnosis]**\nThe AI consultation service is temporarily unavailable, so this safety diagnosis uses the current live sensor values and the rule-based risk assessment.\n\n**[Current Status]**\n- Rule-based risk level: **${sensorContext.riskLevel}** (${sensorContext.anomalyScore}/100)\n- Primary deviations: ${gate.evidence.join(" · ")}\n\n**[Recommended Actions]**\n1. ${requiresUrgentReview ? "Report to the responsible operator immediately and prepare inspection under the approved safety procedure." : "Review recent trends and inspection history, then prioritize the sensors with the largest deviations at the next inspection."}\n2. Do not conclude a failure cause from current values alone; verify the relevant manual and on-site inspection findings.${formatEvidenceGate(gate, lang)}`;
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(({ ctx }) => {
      if (!ctx.user) return null;
      const { id, openId, name, email, loginMethod, role } = ctx.user;
      return { id, openId, name, email, loginMethod, role };
    }),
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
    getPeriodOverview: publicProcedure
      .input(z.discriminatedUnion("period", [
        z.object({ period: z.enum(["day", "week", "month"]) }),
        z.object({
          period: z.literal("custom"),
          startAt: z.string().datetime({ offset: true }),
          endAt: z.string().datetime({ offset: true }),
        }).refine(({ startAt, endAt }) => new Date(startAt).getTime() <= new Date(endAt).getTime(), {
          message: "Custom period start must not be after its end.",
          path: ["endAt"],
        }).refine(({ startAt, endAt }) => new Date(endAt).getTime() - new Date(startAt).getTime() <= 366 * 24 * 60 * 60 * 1000, {
          message: "Custom period must be 366 days or shorter.",
          path: ["endAt"],
        }),
      ]))
      .query(async ({ input }) => {
        const overview = await getPeriodDashboardOverview(
          input.period,
          input.period === "custom" ? { startAt: new Date(input.startAt), endAt: new Date(input.endAt) } : undefined,
        );
        return {
          ...overview,
          startAt: overview.startAt.toISOString(),
          endAt: overview.endAt.toISOString(),
          scoreHistory: overview.scoreHistory.map(point => ({
            ...point,
            timestamp: point.timestamp.toISOString(),
          })),
        };
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
        const buildFallbackAnalysis = (fallbackLang: ChatLanguage) => {
          const gate = buildEvidenceGate({ current, temperature, vibration, noise, anomalyScore, riskLevel }, fallbackLang);
          const urgent = anomalyScore >= 70;
          if (fallbackLang === "ko") {
            return {
              primaryCause: "규칙 기반 센서 이상 감지 (AI 분석 대체)",
              details: `AI 분석 서비스를 일시적으로 사용할 수 없어 실시간 수치로 판단했습니다. 위험도는 ${riskLabelKo}(${anomalyScore.toFixed(0)}/100)이며, 주요 편차는 ${gate.evidence.join(" · ")}입니다. 현재 수치만으로 특정 고장 원인을 단정할 수는 없습니다.`,
              recommendation: `${gate.followUp} ${urgent ? "현장 담당자 보고와 규정된 안전 절차를 우선하세요." : "관련 설비 매뉴얼과 최근 점검 이력을 함께 확인하세요."}`,
            };
          }
          if (fallbackLang === "ja") {
            return {
              primaryCause: "ルールベースのセンサー異常検知（AI分析の代替）",
              details: `AI分析サービスを一時的に利用できないため、現在の実測値で判断しました。危険度は${riskLabelJa}(${anomalyScore.toFixed(0)}/100)で、主な偏差は${gate.evidence.join(" · ")}です。現在の数値だけで特定の故障原因を断定することはできません。`,
              recommendation: `${gate.followUp} ${urgent ? "現場担当者への報告と定められた安全手順を優先してください。" : "関連設備マニュアルと最近の点検履歴を併せて確認してください。"}`,
            };
          }
          return {
            primaryCause: "Rule-based sensor anomaly detected (AI analysis fallback)",
            details: `The AI analysis service is temporarily unavailable, so this result uses live measurements. Risk is ${riskLabelEn} (${anomalyScore.toFixed(0)}/100), with primary deviations in ${gate.evidence.join(" · ")}. Do not conclude a specific failure cause from current values alone.`,
            recommendation: `${gate.followUp} ${urgent ? "Prioritize reporting to the responsible operator and the approved safety procedure." : "Review the relevant equipment manual and recent inspection history together."}`,
          };
        };

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
          const res = await invokeLLM({ model: "gpt-5-mini", messages: makeMessages(sys, usr), response_format: jsonSchema });
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

        const koData = koResult.status === "fulfilled" ? koResult.value : buildFallbackAnalysis("ko");
        const enData = enResult.status === "fulfilled" ? enResult.value : buildFallbackAnalysis("en");
        const jaData = jaResult.status === "fulfilled" ? jaResult.value : buildFallbackAnalysis("ja");

        // DB에 3개 언어 저장
        const targetId = logId ?? await getLastInsertedLogId();
        if (targetId) {
          await updateAnomalyLogLlm(targetId, JSON.stringify(koData), JSON.stringify(enData), JSON.stringify(jaData));
        }

        // 현재 요청 언어에 맞는 결과 반환
        return lang === "ko" ? koData : lang === "ja" ? jaData : enData;
      }),
    summarizePeriodForReport: publicProcedure
      .input(z.object({
        lang: z.enum(["ko", "en", "ja"]).default("ko"),
        periodLabel: z.string().min(1).max(120),
        totalDetections: z.number().int().min(0).max(300),
        anomalyCount: z.number().int().min(0).max(300),
        dangerCount: z.number().int().min(0).max(300),
        uptimePct: z.number().min(0).max(100),
        sensors: z.object({
          average: z.object({ current: z.number(), temperature: z.number(), vibration: z.number(), noise: z.number() }),
          peak: z.object({ current: z.number(), temperature: z.number(), vibration: z.number(), noise: z.number() }),
        }),
        scoreHistory: z.array(z.object({ score: z.number().min(0).max(100), riskLevel: z.enum(["normal", "caution", "warning", "danger"]) })).max(180),
      }))
      .mutation(async ({ input }) => {
        const { lang, periodLabel, totalDetections, anomalyCount, dangerCount, uptimePct, sensors, scoreHistory } = input;
        const copy = lang === "ko"
          ? { headline: "기간 데이터 안전 요약", fallback: "AI 분석을 사용할 수 없어 수집된 기간 통계에 기반한 요약입니다.", recommendation: "관련 설비 매뉴얼과 최근 점검 이력을 함께 검토하세요.", normal: "정상", caution: "주의", warning: "경고", danger: "위험" }
          : lang === "ja"
            ? { headline: "期間データの安全サマリー", fallback: "AI分析を利用できないため、収集した期間統計に基づく要約です。", recommendation: "関連設備マニュアルと直近の点検履歴を併せて確認してください。", normal: "正常", caution: "注意", warning: "警告", danger: "危険" }
            : { headline: "Period data safety summary", fallback: "AI analysis is unavailable, so this is based on collected period statistics.", recommendation: "Review the relevant equipment manual and recent inspection history together.", normal: "Normal", caution: "Caution", warning: "Warning", danger: "Danger" };
        const riskLabel = (level: "normal" | "caution" | "warning" | "danger") => copy[level];
        const peakRisk = scoreHistory.reduce<"normal" | "caution" | "warning" | "danger">((current, point) => {
          const order = { normal: 0, caution: 1, warning: 2, danger: 3 } as const;
          return order[point.riskLevel] > order[current] ? point.riskLevel : current;
        }, "normal");
        const fallbackSummary = lang === "ko"
          ? `${copy.fallback} ${periodLabel} 동안 기록 ${totalDetections}건, 이상 ${anomalyCount}건, 위험 ${dangerCount}건, 정상 가동률 ${uptimePct.toFixed(0)}%가 확인되었습니다. 관측된 최고 위험 단계는 ${riskLabel(peakRisk)}입니다.`
          : lang === "ja"
            ? `${copy.fallback} ${periodLabel}の記録${totalDetections}件、異常${anomalyCount}件、危険${dangerCount}件、稼働率${uptimePct.toFixed(0)}%が確認されました。観測された最高リスクは${riskLabel(peakRisk)}です。`
            : `${copy.fallback} During ${periodLabel}, ${totalDetections} records, ${anomalyCount} anomalies, ${dangerCount} danger detections, and ${uptimePct.toFixed(0)}% uptime were recorded. Highest observed risk level was ${riskLabel(peakRisk)}.`;
        const recentScores = scoreHistory.slice(-8).map(point => point.score);
        const scoreTrend = recentScores.length >= 2 ? recentScores[recentScores.length - 1] - recentScores[0] : 0;
        const forecastLevel: "normal" | "caution" | "warning" | "danger" = peakRisk === "danger" || dangerCount > 0 ? "danger" : peakRisk === "warning" || scoreTrend >= 18 ? "warning" : peakRisk === "caution" || scoreTrend >= 8 ? "caution" : "normal";
        const fallbackEvidence = lang === "ko"
          ? `최근 점수 변화 ${scoreTrend >= 0 ? "+" : ""}${scoreTrend.toFixed(0)}점, 관측 최고 단계 ${riskLabel(peakRisk)}, 위험 탐지 ${dangerCount}건을 기준으로 했습니다.`
          : lang === "ja"
            ? `直近のスコア変化${scoreTrend >= 0 ? "+" : ""}${scoreTrend.toFixed(0)}点、観測最高レベル${riskLabel(peakRisk)}、危険検知${dangerCount}件を基準にしました。`
            : `Based on a recent score change of ${scoreTrend >= 0 ? "+" : ""}${scoreTrend.toFixed(0)}, observed peak level ${riskLabel(peakRisk)}, and ${dangerCount} danger detections.`;
        const fallback = {
          headline: copy.headline,
          summary: fallbackSummary,
          recommendation: copy.recommendation,
          forecastLevel,
          confidence: recentScores.length >= 4 ? ("medium" as const) : ("low" as const),
          evidence: fallbackEvidence,
          alert: forecastLevel === "warning" || forecastLevel === "danger",
          source: "fallback" as const,
        };
        const schema = {
          type: "json_schema" as const,
          json_schema: {
            name: "period_sensor_summary",
            strict: true,
            schema: {
              type: "object",
              properties: {
                headline: { type: "string" },
                summary: { type: "string" },
                recommendation: { type: "string" },
                forecastLevel: { type: "string", enum: ["normal", "caution", "warning", "danger"] },
                confidence: { type: "string", enum: ["low", "medium", "high"] },
                evidence: { type: "string" },
                alert: { type: "boolean" },
              },
              required: ["headline", "summary", "recommendation", "forecastLevel", "confidence", "evidence", "alert"],
              additionalProperties: false,
            },
          },
        };
        const average = sensors.average;
        const peak = sensors.peak;
        const prompt = lang === "ko"
          ? `분석 기간: ${periodLabel}. 기록 ${totalDetections}건, 이상 ${anomalyCount}건, 위험 ${dangerCount}건, 가동률 ${uptimePct.toFixed(0)}%. 센서 평균: 전류 ${average.current.toFixed(2)}A, 온도 ${average.temperature.toFixed(1)}°C, 진동 ${average.vibration.toFixed(2)}mm/s, 소음 ${average.noise.toFixed(1)}dB. 센서 최고값: 전류 ${peak.current.toFixed(2)}A, 온도 ${peak.temperature.toFixed(1)}°C, 진동 ${peak.vibration.toFixed(2)}mm/s, 소음 ${peak.noise.toFixed(1)}dB. 최고 위험도: ${riskLabel(peakRisk)}, 최근 점수 변화 ${scoreTrend.toFixed(0)}점. 데이터에 근거한 2~3문장 요약, 권장 조치, 다음 기간 위험 전망(forecastLevel), 신뢰도(confidence), 근거(evidence), 경고 필요 여부(alert)를 JSON으로 반환하세요. 특정 고장 원인을 단정하거나 안전을 보장하지 마세요.`
          : lang === "ja"
            ? `分析期間: ${periodLabel}。記録${totalDetections}件、異常${anomalyCount}件、危険${dangerCount}件、稼働率${uptimePct.toFixed(0)}%。センサー平均: 電流${average.current.toFixed(2)}A、温度${average.temperature.toFixed(1)}°C、振動${average.vibration.toFixed(2)}mm/s、騒音${average.noise.toFixed(1)}dB。最大値: 電流${peak.current.toFixed(2)}A、温度${peak.temperature.toFixed(1)}°C、振動${peak.vibration.toFixed(2)}mm/s、騒音${peak.noise.toFixed(1)}dB。最高リスク: ${riskLabel(peakRisk)}、直近のスコア変化${scoreTrend.toFixed(0)}点。データに基づく2〜3文の要約、推奨措置、次期間のリスク見通し(forecastLevel)、信頼度(confidence)、根拠(evidence)、警告の必要性(alert)をJSONで返してください。特定の故障原因を断定したり、安全を保証したりしないでください。`
            : `Analysis period: ${periodLabel}. ${totalDetections} records, ${anomalyCount} anomalies, ${dangerCount} danger detections, and ${uptimePct.toFixed(0)}% uptime. Sensor averages: current ${average.current.toFixed(2)}A, temperature ${average.temperature.toFixed(1)}°C, vibration ${average.vibration.toFixed(2)}mm/s, noise ${average.noise.toFixed(1)}dB. Peaks: current ${peak.current.toFixed(2)}A, temperature ${peak.temperature.toFixed(1)}°C, vibration ${peak.vibration.toFixed(2)}mm/s, noise ${peak.noise.toFixed(1)}dB. Highest risk: ${riskLabel(peakRisk)} and recent score change ${scoreTrend.toFixed(0)}. Return a data-grounded 2–3 sentence summary, recommendation, next-period risk outlook (forecastLevel), confidence, evidence, and whether an alert is warranted (alert) as JSON. Do not diagnose a specific failure or guarantee safety.`;
        try {
          const response = await invokeLLM({
            model: "gpt-5-mini",
            messages: [
              { role: "system", content: lang === "ko" ? "당신은 반도체 설비 안전 보고서 분석 AI입니다. 제공된 숫자만 근거로 하고, 특정 고장 원인을 단정하지 마세요. JSON만 반환하세요." : lang === "ja" ? "あなたは半導体設備安全レポートの分析AIです。与えられた数値だけを根拠にし、特定の故障原因を断定しないでください。JSONのみを返してください。" : "You analyze semiconductor equipment safety reports. Use only supplied numbers and do not diagnose a specific hardware failure. Return JSON only." },
              { role: "user", content: prompt },
            ],
            response_format: schema,
          });
          const content = response.choices[0]?.message?.content;
          if (typeof content !== "string") throw new Error("No report summary content");
          const parsed = JSON.parse(content) as { headline: string; summary: string; recommendation: string; forecastLevel: "normal" | "caution" | "warning" | "danger"; confidence: "low" | "medium" | "high"; evidence: string; alert: boolean };
          return { ...parsed, source: "ai" as const };
        } catch (error) {
          console.error("Period report AI summary failed:", error);
          return fallback;
        }
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
          feedbackHistory: z.array(z.object({
            type: z.enum(["like", "dislike"]),
            reason: z.string().optional(),
          })).optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const { sensorContext, messages, lang, feedbackHistory } = input;

        // 마지막 사용자 질문을 기준으로 등록된 설비 매뉴얼에서 관련 구간을 검색합니다.
        const lastUserMessage = [...messages].reverse().find(message => message.role === "user")?.content ?? "";
        let manualSources: Array<{ documentId: number; documentTitle: string; chunkIndex: number; content: string; relevanceScore: number; matchedTerms: string[] }> = [];
        if (ctx.user && lastUserMessage.trim().length > 0) {
          try {
            manualSources = await db.searchManualChunksForUser(ctx.user.id, lastUserMessage, 3);
          } catch (error) {
            console.error("Manual RAG search failed:", error);
          }
        }

        const manualContext = manualSources.length > 0
          ? (lang === "ko"
            ? `\n[등록된 설비 매뉴얼 발췌 - 아래 근거만 인용하고, 인용 시 반드시 "매뉴얼 출처 N" 형식으로 번호를 표기하세요]\n${manualSources.map((source, index) => `매뉴얼 출처 ${index + 1} (문서: ${source.documentTitle}, 구간 ${source.chunkIndex + 1}): ${source.content.slice(0, 1200)}`).join("\n")}`
            : lang === "ja"
              ? `\n[登録された設備マニュアル抜粋 - 以下の根拠のみ引用し、引用時は必ず「マニュアル出典 N」の形式で番号を明記してください]\n${manualSources.map((source, index) => `マニュアル出典 ${index + 1} (文書: ${source.documentTitle}, 区間 ${source.chunkIndex + 1}): ${source.content.slice(0, 1200)}`).join("\n")}`
              : `\n[Registered equipment manual excerpts - cite only these and always label citations as "Manual Source N"]\n${manualSources.map((source, index) => `Manual Source ${index + 1} (Document: ${source.documentTitle}, Chunk ${source.chunkIndex + 1}): ${source.content.slice(0, 1200)}`).join("\n")}`)
          : "";

        // 대화가 무한히 쌓이는 것을 방지하기 위해 최근 12개 메시지만 유지하고,
        // 그 이전 대화가 있다면 핵심 요약 컨텍스트로 압축하여 시스템 프롬프트에 주입합니다.
        const MAX_RECENT_MESSAGES = 12;
        let compressedSummary = "";
        let activeMessages = messages;

        if (messages.length > MAX_RECENT_MESSAGES) {
          const olderMessages = messages.slice(0, messages.length - MAX_RECENT_MESSAGES);
          activeMessages = messages.slice(messages.length - MAX_RECENT_MESSAGES);
          
          const summaryKo = `[이전 상담 요약: 총 ${olderMessages.length}개의 이전 대화가 진행되었으며, 장비 이상 원인과 점검 부품에 대한 논의가 있었습니다.]`;
          const summaryEn = `[Previous Session Summary: ${olderMessages.length} earlier turns occurred regarding equipment anomalies and inspection targets.]`;
          const summaryJa = `[以前の相談の要約: 合計 ${olderMessages.length} 件のやり取りが行われ、異常原因や点検対象について議論されました。]`;
          
          compressedSummary = lang === "ko" ? summaryKo : lang === "ja" ? summaryJa : summaryEn;
        }
        
        const systemPromptKo = `당신은 반도체 설비 예지보전 및 이상 진단 수석 엔지니어 AI(SemiGuard Expert)입니다.
[현재 진단 대상 센서 데이터 및 로그 ID: #${sensorContext.logId ?? '실시간 수치'}]
- 전류: ${sensorContext.current}A (정상 5.0A 편차 ±0.5)
- 온도: ${sensorContext.temperature}°C (정상 45°C 편차 ±3)
- 진동: ${sensorContext.vibration}mm/s (정상 2.0mm/s 편차 ±0.3)
- 소음: ${sensorContext.noise}dB (정상 55dB 편차 ±4)
- 이상 점수: ${sensorContext.anomalyScore}/100, 위험 단계: ${sensorContext.riskLevel}

응답 지침 및 구조:
1. 고정 템플릿 답변을 절대 금지하고, 실제 센서 수치와 기준값의 구체적인 편차(예: 온도 +12°C 초과, 진동 +1.8mm/s 상승 등)를 반드시 계산하여 근거를 제시하세요.
2. 답변은 다음 구조로 명확하게 작성해 주세요:
   - [현재 상태 요약 및 주요 이상 센서]: 편차가 가장 큰 센서 지목
   - [원인 추론 및 영향 분석]: 해당 편차가 반도체 공정(식각/증착/이송 등)에 미치는 영향
   - [추천 점검 부품 및 단계별 조치 순서]: 베어링, 인버터, 쿨링팬, 가스 밸브 등 구체적 부품 점검법
   - [진단 신뢰도 (Confidence)] 및 [장비 즉시 중지 조건 (Shutdown Criteria)]
3. 전문적이고 신뢰감 있는 반도체 수석 엔지니어 톤을 유지하며, 임의로 시스템 임계값을 변경하거나 장비를 강제 제어할 수 없음을 인지하고 안전 조치에 집중하세요.`;

        const systemPromptEn = `You are an expert AI senior engineer for semiconductor equipment predictive maintenance (SemiGuard Expert).
[Target Sensor Data & Log ID: #${sensorContext.logId ?? 'Live'}]
- Current: ${sensorContext.current}A (Normal 5.0A ±0.5)
- Temperature: ${sensorContext.temperature}°C (Normal 45°C ±3)
- Vibration: ${sensorContext.vibration}mm/s (Normal 2.0mm/s ±0.3)
- Noise: ${sensorContext.noise}dB (Normal 55dB ±4)
- Anomaly Score: ${sensorContext.anomalyScore}/100, Risk Level: ${sensorContext.riskLevel}

Guidelines:
1. Avoid fixed templates; calculate exact deviations from normal baselines (e.g., +12°C over normal) and state evidence clearly.
2. Structure your response with:
   - [Status Summary & Key Anomalous Sensor]
   - [Root Cause & Process Impact Analysis]
   - [Recommended Inspection Parts & Step-by-Step Recovery]
   - [Confidence Level] & [Immediate Shutdown Criteria]
3. Maintain a professional senior engineer tone focusing on safety and root-cause troubleshooting.`;

        const systemPromptJa = `あなたは半導体設備の予知保全および異常診断のシニアエンジニアAI（SemiGuard Expert）です。
[対象センサーデータ・ログID: #${sensorContext.logId ?? 'リアルタイム'}]
- 電流: ${sensorContext.current}A (正常5.0A ±0.5)
- 温度: ${sensorContext.temperature}°C (正常45°C ±3)
- 振動: ${sensorContext.vibration}mm/s (正常2.0mm/s ±0.3)
- 騒音: ${sensorContext.noise}dB (正常55dB ±4)
- 異常スコア: ${sensorContext.anomalyScore}/100, 危険度: ${sensorContext.riskLevel}

ガイドライン:
1. 固定テンプレートを避け、正常基準値からの具体的なセンサー偏差（例：温度+12°C超過）を計算して根拠を示してください。
2. 以下の構成で分かりやすく回答してください:
   - [状態要約および主要異常センサー]
   - [原因推論および影響分析]
   - [推奨点検部品と段階的復旧手順]
   - [信頼度 (Confidence)] および [設備即時停止条件 (Shutdown Criteria)]
3. 専門的で信頼性の高いシニアエンジニアのトーンを維持してください。`;

        const systemPrompt = lang === "ko" ? systemPromptKo : lang === "ja" ? systemPromptJa : systemPromptEn;
        
        let feedbackContext = "";
        if (feedbackHistory && feedbackHistory.length > 0) {
          const dislikes = feedbackHistory.filter((f: { type: string; reason?: string }) => f.type === "dislike");
          if (dislikes.length > 0) {
            const reasons = dislikes.map((d: { type: string; reason?: string }) => d.reason).filter(Boolean).join(", ");
            if (lang === "ko") {
              feedbackContext = `\n[사용자 피드백 학습 지침]: 최근 사용자가 이전 답변에 대해 '아쉬움'을 표시했습니다 (사유: ${reasons || '설명 보완 필요'}). 다음 답변에서는 더 구체적인 원인과 근거를 제시하고 해당 지적 사항이 반복되지 않도록 유의하세요.`;
            } else if (lang === "ja") {
              feedbackContext = `\n[ユーザーフィードバック学習指示]: ユーザーが以前の回答に「イマイチ」と評価しました（理由: ${reasons || '説明の補足が必要'}）。次の回答では、より具体的な原因と根拠を示し、同様の指摘が繰り返されないように注意してください。`;
            } else {
              feedbackContext = `\n[User Feedback Learning Directive]: The user expressed dissatisfaction with recent answers (Reason: ${reasons || 'needs more clarity'}). Ensure subsequent answers provide deeper root-cause evidence and avoid previous shortcomings.`;
            }
          }
        }

        const finalSystemPrompt = systemPrompt + feedbackContext + manualContext;

        const combinedMessages = [
          ...(compressedSummary ? [{ role: "system" as const, content: compressedSummary }] : []),
          ...activeMessages.map((m) => ({ role: m.role, content: m.content })),
        ];

        const formattedMessages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
          { role: "system", content: finalSystemPrompt },
          ...combinedMessages,
        ];

        try {
          const res = await invokeLLM({ model: "gpt-5-mini", messages: formattedMessages });
          const reply = res.choices[0]?.message?.content;
          if (typeof reply !== "string") {
            throw new Error("No reply content from LLM");
          }
          return {
            reply,
            usedFallback: false,
            manualSources: manualSources.map((source, index) => ({
              label: index + 1,
              documentId: source.documentId,
              documentTitle: source.documentTitle,
              chunkIndex: source.chunkIndex,
              content: source.content,
              relevanceScore: source.relevanceScore,
              matchedTerms: source.matchedTerms,
            })),
          };
        } catch (err) {
          console.warn("AI consultation fallback used:", err instanceof Error ? err.message : "unknown error");
          return {
            reply: buildSafeFallbackDiagnostic(sensorContext, lang),
            usedFallback: true,
            manualSources: manualSources.map((source, index) => ({
              label: index + 1,
              documentId: source.documentId,
              documentTitle: source.documentTitle,
              chunkIndex: source.chunkIndex,
              content: source.content,
              relevanceScore: source.relevanceScore,
              matchedTerms: source.matchedTerms,
            })),
          };
        }
      }),

    // 상담 세션 목록 조회
    getChatSessions: protectedProcedure.query(async ({ ctx }) => {
      return db.getChatSessions(ctx.user.id);
    }),

    searchChatSessions: protectedProcedure
      .input(z.object({ query: z.string().trim().min(1).max(120) }))
      .query(async ({ ctx, input }) => db.searchChatSessionsForUser(ctx.user.id, input.query)),

    // 새 상담 세션 생성
    createChatSession: protectedProcedure
      .input(z.object({ title: z.string().optional() }).optional())
      .mutation(async ({ ctx, input }) => {
        const title = input?.title ?? "새로운 상담";
        const sessionId = await db.createChatSession(ctx.user.id, title);
        return { sessionId };
      }),

    // 특정 세션 메시지 조회
    getChatMessages: protectedProcedure
      .input(z.object({ sessionId: z.number() }))
      .query(async ({ ctx, input }) => {
        return db.getChatMessagesForUser(input.sessionId, ctx.user.id);
      }),

    // 메시지 저장 및 세션 갱신
    saveChatMessage: protectedProcedure
      .input(z.object({ sessionId: z.number(), role: z.enum(["user", "assistant"]), content: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const messageId = await db.addChatMessage(input.sessionId, ctx.user.id, input.role, input.content);
        return { success: true, messageId };
      }),

    saveChatFeedback: protectedProcedure
      .input(z.object({
        sessionId: z.number(),
        messageId: z.number().optional(),
        messageContent: z.string().min(1).max(12000),
        feedbackType: z.enum(["like", "dislike"]),
        reasonCode: z.enum(["inaccurate", "insufficient", "irrelevant", "other"]).optional(),
        reasonText: z.string().max(500).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const feedbackId = await db.createChatFeedback({ ...input, userId: ctx.user.id });
        return { feedbackId };
      }),

    getChatFeedbacks: protectedProcedure
      .input(z.object({ sessionId: z.number() }))
      .query(async ({ ctx, input }) => db.getChatFeedbackForSession(ctx.user.id, input.sessionId)),

    // 사용자별 최근 피드백·재생성 이력 (히스토리 사이드바)
    getFeedbackHistory: protectedProcedure
      .input(z.object({ limit: z.number().int().min(1).max(30).default(20) }).optional())
      .query(async ({ ctx, input }) => db.getRecentChatFeedbackForUser(ctx.user.id, input?.limit ?? 20)),

    // 피드백을 반영해 재생성한 답변을 해당 피드백 이력에 연결 저장
    attachRegeneratedAnswer: protectedProcedure
      .input(z.object({
        sessionId: z.number(),
        feedbackId: z.number().optional(),
        regeneratedContent: z.string().min(1).max(12000),
      }))
      .mutation(async ({ ctx, input }) => {
        const updated = await db.attachRegeneratedAnswerToFeedback({ ...input, userId: ctx.user.id });
        return { updated };
      }),

    deleteChatFeedback: protectedProcedure
      .input(z.object({ feedbackId: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        const deleted = await db.deleteChatFeedbackForUser(ctx.user.id, input.feedbackId);
        return { deleted };
      }),

    deleteAllChatFeedbacks: protectedProcedure
      .mutation(async ({ ctx }) => {
        const deletedCount = await db.deleteAllChatFeedbackForUser(ctx.user.id);
        return { deletedCount };
      }),

    analyzeFeedbackKeywords: protectedProcedure
      .input(z.object({
        lang: z.enum(["ko", "en", "ja"]).default("ko"),
        entries: z.array(z.object({
          feedbackType: z.enum(["like", "dislike"]),
          reasonCode: z.string().max(32).nullable().optional(),
          reasonText: z.string().max(500).nullable().optional(),
          messageContent: z.string().max(1200),
          regeneratedContent: z.string().max(1200).nullable().optional(),
        })).min(1).max(30),
      }))
      .mutation(async ({ input }) => {
        const corpus = input.entries.map((entry, index) => [
          `#${index + 1}`,
          `feedback=${entry.feedbackType}`,
          entry.reasonCode ? `reasonCode=${entry.reasonCode}` : "",
          entry.reasonText ? `reason=${entry.reasonText}` : "",
          `answer=${entry.messageContent}`,
          entry.regeneratedContent ? `regenerated=${entry.regeneratedContent}` : "",
        ].filter(Boolean).join(" | ")).join("\n");
        const systemPrompt = input.lang === "ko"
          ? "당신은 반도체 예지안전 AI 상담 품질 분석가입니다. 제공된 피드백 기록에서 반복되는 핵심 키워드와 개선 방향만 추출하세요. 비밀정보를 추론하지 말고, 기록에 없는 내용을 만들지 마세요."
          : input.lang === "ja"
            ? "あなたは半導体予知安全AI相談の品質分析者です。提供されたフィードバック記録から繰り返し現れる主要キーワードと改善方向のみを抽出してください。記録にない内容や秘密情報を推測してはいけません。"
            : "You are a quality analyst for a semiconductor predictive-safety AI consultation. Extract only recurring key terms and improvement directions from the provided feedback. Do not infer secrets or invent details absent from the records.";
        const userPrompt = input.lang === "ko"
          ? `다음 ${input.entries.length}건의 현재 필터 결과를 분석하세요. keywords에는 3~6개의 짧은 핵심어만 넣고, summary와 improvement는 각 1~2문장으로 간결하게 작성하세요.\n\n${corpus}`
          : input.lang === "ja"
            ? `以下の現在フィルター結果${input.entries.length}件を分析してください。keywordsには3〜6個の短い重要語だけを入れ、summaryとimprovementはそれぞれ1〜2文で簡潔にしてください。\n\n${corpus}`
            : `Analyze these ${input.entries.length} currently filtered feedback records. Provide 3–6 concise key terms in keywords, and keep summary and improvement to 1–2 sentences each.\n\n${corpus}`;
        try {
          const response = await invokeLLM({
            model: "gpt-5-mini",
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
            response_format: {
              type: "json_schema",
              json_schema: {
                name: "feedback_keyword_summary",
                strict: true,
                schema: {
                  type: "object",
                  properties: {
                    keywords: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 6 },
                    summary: { type: "string" },
                    improvement: { type: "string" },
                  },
                  required: ["keywords", "summary", "improvement"],
                  additionalProperties: false,
                },
              },
            },
          });
          const content = response.choices[0]?.message?.content;
          if (typeof content !== "string") throw new Error("No structured keyword summary");
          const parsed = JSON.parse(content) as { keywords: string[]; summary: string; improvement: string };
          return {
            mode: "ai" as const,
            keywords: parsed.keywords.slice(0, 6).map(keyword => String(keyword).slice(0, 40)),
            summary: String(parsed.summary).slice(0, 600),
            improvement: String(parsed.improvement).slice(0, 600),
          };
        } catch (error) {
          console.error("Feedback keyword analysis failed:", error);
          const stopWords = new Set([
            "그리고", "하지만", "대한", "현재", "답변", "피드백", "내용", "설명", "이것", "그것", "저것", "에서", "으로", "에게", "합니다", "해주세요",
            "the", "and", "with", "that", "this", "from", "have", "were", "your", "about", "response", "feedback", "answer",
            "です", "ます", "する", "から", "まで", "について", "回答", "フィードバック",
          ]);
          const frequency = new Map<string, number>();
          corpus.toLocaleLowerCase().match(/[가-힣]{2,}|[a-z]{3,}|[ぁ-んァ-ン一-龯]{2,}/g)?.forEach(word => {
            if (!stopWords.has(word)) frequency.set(word, (frequency.get(word) ?? 0) + 1);
          });
          const keywords = Array.from(frequency.entries())
            .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
            .slice(0, 6)
            .map(([keyword]) => keyword);
          const negativeCount = input.entries.filter(entry => entry.feedbackType === "dislike").length;
          const summary = input.lang === "ko"
            ? `현재 ${input.entries.length}건의 피드백에서 반복 표현을 기준으로 핵심어를 정리했습니다. 부정 평가는 ${negativeCount}건입니다.`
            : input.lang === "ja"
              ? `現在の${input.entries.length}件のフィードバックから、繰り返し表現を基準に主要語を整理しました。否定評価は${negativeCount}件です。`
              : `Key terms were organized from repeated phrases in the current ${input.entries.length} feedback records. There are ${negativeCount} negative ratings.`;
          const improvement = input.lang === "ko"
            ? "AI 요약 서비스를 사용할 수 없는 경우의 기본 분석 결과입니다. 반복 키워드와 부정 평가 사유를 우선 검토하세요."
            : input.lang === "ja"
              ? "AI要約サービスを利用できない場合の基本分析結果です。繰り返しキーワードと否定評価の理由を優先して確認してください。"
              : "This is a basic fallback analysis used when the AI summary service is unavailable. Prioritize recurring terms and negative-rating reasons.";
          return { mode: "fallback" as const, keywords, summary, improvement };
        }
      }),

    addManualText: protectedProcedure
      .input(z.object({ title: z.string().trim().min(1).max(255), content: z.string().trim().min(50).max(60000) }))
      .mutation(async ({ ctx, input }) => {
        const paragraphs = splitManualTextIntoChunks(input.content);
        if (paragraphs.length > MANUAL_CHUNK_LIMIT) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Manual content exceeds the ${MANUAL_CHUNK_LIMIT}-chunk registration limit. Please split it into smaller manuals.`,
          });
        }
        const documentId = await db.createManualDocumentWithChunks({
          userId: ctx.user.id,
          title: input.title,
          sourceType: "text",
          chunks: paragraphs.map(content => ({ content, keywords: input.title })),
        });
        return { documentId, chunkCount: paragraphs.length };
      }),

    getManualDocuments: protectedProcedure.query(async ({ ctx }) => db.getManualDocumentsForUser(ctx.user.id)),

    searchManualDocuments: protectedProcedure
      .input(z.object({ search: z.string().trim().min(1).max(120) }))
      .query(async ({ ctx, input }) => db.searchManualDocumentsForUser(ctx.user.id, input.search)),

    getManualDocumentPreview: protectedProcedure
      .input(z.object({ documentId: z.number().int().positive() }))
      .query(async ({ ctx, input }) => {
        const preview = await db.getManualDocumentPreviewForUser({ userId: ctx.user.id, documentId: input.documentId });
        if (!preview) throw new TRPCError({ code: "NOT_FOUND", message: "Manual document was not found" });
        return preview;
      }),

    deleteManualDocument: protectedProcedure
      .input(z.object({ documentId: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => ({
        deleted: await db.deleteManualDocumentForUser({ userId: ctx.user.id, documentId: input.documentId }),
      })),

    // 세션 제목 변경
    updateChatSessionTitle: protectedProcedure
      .input(z.object({ sessionId: z.number().int().positive(), title: z.string().trim().min(1).max(120) }))
      .mutation(async ({ ctx, input }) => {
        const updated = await db.updateSessionTitle(input.sessionId, ctx.user.id, input.title);
        return { success: updated };
      }),

    setChatSessionPinned: protectedProcedure
      .input(z.object({ sessionId: z.number().int().positive(), isPinned: z.boolean() }))
      .mutation(async ({ ctx, input }) => {
        const updated = await db.setChatSessionPinned(input.sessionId, ctx.user.id, input.isPinned);
        return { success: updated };
      }),

    // 세션 삭제
    deleteChatSession: protectedProcedure
      .input(z.object({ sessionId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await db.deleteChatSession(input.sessionId, ctx.user.id);
        return { success: true };
      }),

    // 모든 상담 세션 및 메시지 일괄 삭제 (전체 초기화)
    deleteAllChatSessions: protectedProcedure.mutation(async ({ ctx }) => {
      await db.deleteAllChatSessions(ctx.user.id);
      return { success: true };
    }),
  }),
});
export type AppRouter = typeof appRouter;
