import { float, int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// 이상 이력 로그 테이블
export const anomalyLogs = mysqlTable("anomaly_logs", {
  id: int("id").autoincrement().primaryKey(),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  current: float("current").notNull(),
  temperature: float("temperature").notNull(),
  vibration: float("vibration").notNull(),
  noise: float("noise").notNull(),
  anomalyScore: float("anomaly_score").notNull(),
  riskLevel: mysqlEnum("risk_level", ["normal", "caution", "warning", "danger"]).notNull(),
  isAnomaly: int("is_anomaly").notNull().default(0),
});

export type AnomalyLog = typeof anomalyLogs.$inferSelect;
export type InsertAnomalyLog = typeof anomalyLogs.$inferInsert;

// 방문자 카운터 테이블
export const visitorStats = mysqlTable("visitor_stats", {
  id: int("id").autoincrement().primaryKey(),
  date: varchar("date", { length: 10 }).notNull().unique(), // YYYY-MM-DD
  count: int("count").notNull().default(0),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type VisitorStat = typeof visitorStats.$inferSelect;

// 전체 샘플 카운터 (정상 포함 모든 측정값 집계용)
export const sampleStats = mysqlTable("sample_stats", {
  id: int("id").autoincrement().primaryKey(),
  key: varchar("key", { length: 32 }).notNull().unique(), // 'total_samples', 'reset_offset'
  value: int("value").notNull().default(0),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SampleStat = typeof sampleStats.$inferSelect;
