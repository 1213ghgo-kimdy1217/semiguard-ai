import { desc, eq, gte, sql, count as drizzleCount } from "drizzle-orm";
import { anomalyLogs, visitorStats, sampleStats, thresholdSettings, sensorThresholds, type InsertAnomalyLog } from "../drizzle/schema";
import { getDb } from "./db";

export async function insertAnomalyLog(entry: InsertAnomalyLog) {
  const db = await getDb();
  if (!db) return null;
  await db.insert(anomalyLogs).values(entry);
}

// 특정 로그에 LLM 분석 결과 업데이트 (3개 언어)
export async function updateAnomalyLogLlm(id: number, ko: string, en: string, ja: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(anomalyLogs).set({ llmAnalysisKo: ko, llmAnalysisEn: en, llmAnalysisJa: ja }).where(eq(anomalyLogs.id, id));
}

// 가장 최근 삽입된 로그 ID 조회
export async function getLastInsertedLogId(): Promise<number | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select({ id: anomalyLogs.id }).from(anomalyLogs).orderBy(desc(anomalyLogs.id)).limit(1);
  return rows[0]?.id ?? null;
}

// LLM 분석 결과가 있는 최근 로그 N건 조회 (히스토리 패널용) - 3개 언어
export async function getLlmHistory(limit = 5): Promise<{ id: number; timestamp: Date; riskLevel: string; anomalyScore: number; llmAnalysisKo: string | null; llmAnalysisEn: string | null; llmAnalysisJa: string | null }[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select({
    id: anomalyLogs.id,
    timestamp: anomalyLogs.timestamp,
    riskLevel: anomalyLogs.riskLevel,
    anomalyScore: anomalyLogs.anomalyScore,
    llmAnalysisKo: anomalyLogs.llmAnalysisKo,
    llmAnalysisEn: anomalyLogs.llmAnalysisEn,
    llmAnalysisJa: anomalyLogs.llmAnalysisJa,
  }).from(anomalyLogs)
    .where(sql`llm_analysis_ko IS NOT NULL OR llm_analysis_en IS NOT NULL`)
    .orderBy(desc(anomalyLogs.timestamp))
    .limit(limit);
  return rows;
}

export async function getRecentAnomalyLogs(limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(anomalyLogs).orderBy(desc(anomalyLogs.timestamp)).limit(limit);
}

export async function clearAnomalyLogs() {
  const db = await getDb();
  if (!db) return;
  await db.delete(anomalyLogs);
}

// 전체 샘플 카운터 증가
export async function incrementSampleCount(): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.insert(sampleStats).values({ key: "total_samples", value: 1 })
    .onDuplicateKeyUpdate({ set: { value: sql`${sampleStats.value} + 1` } });
}

// 전체 샘플 수 조회
export async function getTotalSamples(): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const rows = await db.select().from(sampleStats).where(eq(sampleStats.key, "total_samples")).limit(1);
  return Number(rows[0]?.value ?? 0);
}

// 절감 비용 리셋 오프셋 저장 (리셋 시점의 dangerCount를 저장)
export async function resetSavedCost(currentDangerCount: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.insert(sampleStats).values({ key: "danger_reset_offset", value: currentDangerCount })
    .onDuplicateKeyUpdate({ set: { value: currentDangerCount } });
}

// 절감 비용 리셋 오프셋 조회
export async function getDangerResetOffset(): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const rows = await db.select().from(sampleStats).where(eq(sampleStats.key, "danger_reset_offset")).limit(1);
  return Number(rows[0]?.value ?? 0);
}

// 오늘 방문자 수 증가 (upsert)
export async function incrementVisitor(): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  await db.insert(visitorStats).values({ date: today, count: 1 })
    .onDuplicateKeyUpdate({ set: { count: sql`${visitorStats.count} + 1` } });
  const rows = await db.select().from(visitorStats).where(eq(visitorStats.date, today)).limit(1);
  return rows[0]?.count ?? 1;
}

// 누적 방문자 수 합계
export async function getTotalVisitors(): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const rows = await db.select({ total: sql<number>`SUM(${visitorStats.count})` }).from(visitorStats);
  return Number(rows[0]?.total ?? 0);
}

// 날짜별 최고 위험도 집계 (히트맵용)
export async function getDailyMaxRisk(): Promise<{ date: string; riskLevel: string }[]> {
  const db = await getDb();
  if (!db) return [];
  // 완전한 raw SQL — CASE 구문을 Drizzle 컬럼 참조 없이 순수 문자열로 처리
  const rows = await db.execute<{ date: string; maxRiskOrder: number }>(
    sql`SELECT DATE(timestamp) AS date,
        MAX(CASE risk_level
          WHEN 'danger'  THEN 4
          WHEN 'warning' THEN 3
          WHEN 'caution' THEN 2
          ELSE 1
        END) AS maxRiskOrder
        FROM anomaly_logs
        GROUP BY DATE(timestamp)
        ORDER BY DATE(timestamp) ASC`
  );
  const riskMap: Record<number, string> = { 4: "danger", 3: "warning", 2: "caution", 1: "normal" };
  return rows.map((r: any) => ({
    date: String(r.date).slice(0, 10),
    riskLevel: riskMap[Number(r.maxRiskOrder)] ?? "normal",
  }));
}

// 이상 탐지 통계
export async function getAnomalyStats(): Promise<{ total: number; dangerCount: number; anomalyCount: number }> {
  const db = await getDb();
  if (!db) return { total: 0, dangerCount: 0, anomalyCount: 0 };
  const totalRows = await db.select({ cnt: sql<number>`COUNT(*)` }).from(anomalyLogs);
  const dangerRows = await db.select({ cnt: sql<number>`COUNT(*)` }).from(anomalyLogs)
    .where(eq(anomalyLogs.riskLevel, "danger"));
  const anomalyRows = await db.select({ cnt: sql<number>`COUNT(*)` }).from(anomalyLogs)
    .where(eq(anomalyLogs.isAnomaly, 1));
  return {
    total: Number(totalRows[0]?.cnt ?? 0),
    dangerCount: Number(dangerRows[0]?.cnt ?? 0),
    anomalyCount: Number(anomalyRows[0]?.cnt ?? 0),
  };
}
// 위험도 임계값 불러오기 (없으면 기본값 반환)
export async function getThresholds(): Promise<{ normal: number; caution: number; warning: number }> {
  const db = await getDb();
  if (!db) return { normal: 29, caution: 49, warning: 69 };
  const rows = await db.select().from(thresholdSettings).where(eq(thresholdSettings.key, "default")).limit(1);
  if (!rows[0]) return { normal: 29, caution: 49, warning: 69 };
  return { normal: rows[0].normalMax, caution: rows[0].cautionMax, warning: rows[0].warningMax };
}

// 위험도 임계값 저장 (upsert)
export async function saveThresholds(normal: number, caution: number, warning: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.insert(thresholdSettings)
    .values({ key: "default", normalMax: normal, cautionMax: caution, warningMax: warning })
    .onDuplicateKeyUpdate({ set: { normalMax: normal, cautionMax: caution, warningMax: warning } });
}

// 위험도 추이 (최근 N개 점수, 시간 오름차순)
export async function getRecentScores(limit = 50): Promise<{ timestamp: Date; score: number; riskLevel: string }[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select({
    timestamp: anomalyLogs.timestamp,
    score: anomalyLogs.anomalyScore,
    riskLevel: anomalyLogs.riskLevel,
  }).from(anomalyLogs).orderBy(desc(anomalyLogs.timestamp)).limit(limit);
  return rows.reverse(); // 시간 오름차순으로 반환
}

export type DashboardPeriod = "day" | "week" | "month";

const DASHBOARD_PERIOD_MS: Record<DashboardPeriod, number> = {
  day: 24 * 60 * 60 * 1000,
  week: 7 * 24 * 60 * 60 * 1000,
  month: 30 * 24 * 60 * 60 * 1000,
};

export async function getPeriodDashboardOverview(period: DashboardPeriod) {
  const db = await getDb();
  const startAt = new Date(Date.now() - DASHBOARD_PERIOD_MS[period]);
  const startDate = startAt.toISOString().slice(0, 10);
  const emptySensors = {
    average: { current: 0, temperature: 0, vibration: 0, noise: 0 },
    peak: { current: 0, temperature: 0, vibration: 0, noise: 0 },
  };
  if (!db) {
    return {
      period,
      startAt,
      totalDetections: 0,
      dangerCount: 0,
      anomalyCount: 0,
      uptimePct: 100,
      savedCost: 0,
      totalVisitors: 0,
      sensors: emptySensors,
      scoreHistory: [] as { timestamp: Date; score: number; riskLevel: string; current: number; temperature: number; vibration: number; noise: number }[],
    };
  }

  const [periodLogs, visitorRows] = await Promise.all([
    db.select({
      timestamp: anomalyLogs.timestamp,
      current: anomalyLogs.current,
      temperature: anomalyLogs.temperature,
      vibration: anomalyLogs.vibration,
      noise: anomalyLogs.noise,
      score: anomalyLogs.anomalyScore,
      riskLevel: anomalyLogs.riskLevel,
      isAnomaly: anomalyLogs.isAnomaly,
    }).from(anomalyLogs).where(gte(anomalyLogs.timestamp, startAt)).orderBy(desc(anomalyLogs.timestamp)).limit(300),
    db.select({ total: sql<number>`COALESCE(SUM(${visitorStats.count}), 0)` }).from(visitorStats).where(gte(visitorStats.date, startDate)),
  ]);

  const logs = periodLogs.reverse();
  const totalDetections = logs.length;
  const dangerCount = logs.filter(log => log.riskLevel === "danger").length;
  const anomalyCount = logs.filter(log => log.isAnomaly === 1).length;
  const sum = logs.reduce((acc, log) => ({
    current: acc.current + Number(log.current),
    temperature: acc.temperature + Number(log.temperature),
    vibration: acc.vibration + Number(log.vibration),
    noise: acc.noise + Number(log.noise),
  }), { current: 0, temperature: 0, vibration: 0, noise: 0 });
  const peak = logs.reduce((acc, log) => ({
    current: Math.max(acc.current, Number(log.current)),
    temperature: Math.max(acc.temperature, Number(log.temperature)),
    vibration: Math.max(acc.vibration, Number(log.vibration)),
    noise: Math.max(acc.noise, Number(log.noise)),
  }), { current: 0, temperature: 0, vibration: 0, noise: 0 });
  const average = totalDetections > 0
    ? {
        current: sum.current / totalDetections,
        temperature: sum.temperature / totalDetections,
        vibration: sum.vibration / totalDetections,
        noise: sum.noise / totalDetections,
      }
    : emptySensors.average;

  return {
    period,
    startAt,
    totalDetections,
    dangerCount,
    anomalyCount,
    uptimePct: totalDetections > 0 ? Math.round(((totalDetections - anomalyCount) / totalDetections) * 100) : 100,
    savedCost: dangerCount * 50_000_000,
    totalVisitors: Number(visitorRows[0]?.total ?? 0),
    sensors: { average, peak },
    scoreHistory: logs.slice(-180).map(log => ({
      timestamp: log.timestamp,
      score: Number(log.score),
      riskLevel: log.riskLevel,
      current: Number(log.current),
      temperature: Number(log.temperature),
      vibration: Number(log.vibration),
      noise: Number(log.noise),
    })),
  };
}

// 이상 탐지 통계
// 센서별 임계값 기본값
const SENSOR_THRESHOLD_DEFAULTS = {
  currentCaution: 7.0, currentWarning: 9.0, currentDanger: 11.0,
  tempCaution: 55.0, tempWarning: 70.0, tempDanger: 85.0,
  vibCaution: 2.3, vibWarning: 2.6, vibDanger: 3.0,
  noiseCaution: 65.0, noiseWarning: 75.0, noiseDanger: 85.0,
};

export type SensorThresholdValues = typeof SENSOR_THRESHOLD_DEFAULTS;

// 센서별 임계값 불러오기
export async function getSensorThresholds(): Promise<SensorThresholdValues> {
  const db = await getDb();
  if (!db) return SENSOR_THRESHOLD_DEFAULTS;
  const rows = await db.select().from(sensorThresholds).where(eq(sensorThresholds.key, "default")).limit(1);
  if (!rows[0]) return SENSOR_THRESHOLD_DEFAULTS;
  const r = rows[0];
  return {
    currentCaution: r.currentCaution, currentWarning: r.currentWarning, currentDanger: r.currentDanger,
    tempCaution: r.tempCaution, tempWarning: r.tempWarning, tempDanger: r.tempDanger,
    vibCaution: r.vibCaution, vibWarning: r.vibWarning, vibDanger: r.vibDanger,
    noiseCaution: r.noiseCaution, noiseWarning: r.noiseWarning, noiseDanger: r.noiseDanger,
  };
}

// 센서별 임계값 저장 (upsert)
export async function saveSensorThresholds(values: SensorThresholdValues): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.insert(sensorThresholds)
    .values({ key: "default", ...values })
    .onDuplicateKeyUpdate({ set: values });
}
