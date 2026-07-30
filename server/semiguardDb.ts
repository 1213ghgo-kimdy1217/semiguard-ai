import { desc, eq, sql, count as drizzleCount } from "drizzle-orm";
import { anomalyLogs, visitorStats, sampleStats, thresholdSettings, type InsertAnomalyLog } from "../drizzle/schema";
import { getDb } from "./db";

export async function insertAnomalyLog(entry: InsertAnomalyLog) {
  const db = await getDb();
  if (!db) return null;
  await db.insert(anomalyLogs).values(entry);
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

// 이상 탐지 통계
