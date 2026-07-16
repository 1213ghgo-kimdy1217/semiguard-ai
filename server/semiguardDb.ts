import { desc, eq, sql, count as drizzleCount } from "drizzle-orm";
import { anomalyLogs, visitorStats, type InsertAnomalyLog } from "../drizzle/schema";
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
