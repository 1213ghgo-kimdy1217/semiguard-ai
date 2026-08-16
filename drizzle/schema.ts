import { date, float, index, int, mysqlEnum, mysqlTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  badgeNumber: varchar("badge_number", { length: 64 }), // 회사 명찰 번호
  dateOfBirth: date("date_of_birth"), // 생년월일
  passwordHash: text("password_hash"), // 비밀번호 해시
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// 기존 로컬 사용자와 연결된 소셜 계정 식별자
export const socialAccountLinks = mysqlTable("social_account_links", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  provider: mysqlEnum("provider", ["google", "naver", "kakao"]).notNull(),
  providerUserId: varchar("provider_user_id", { length: 128 }).notNull(),
  email: varchar("email", { length: 320 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  providerIdentityUnique: uniqueIndex("social_account_provider_identity").on(table.provider, table.providerUserId),
  userProviderUnique: uniqueIndex("social_account_user_provider").on(table.userId, table.provider),
}));

export type SocialAccountLink = typeof socialAccountLinks.$inferSelect;
export type InsertSocialAccountLink = typeof socialAccountLinks.$inferInsert;

// 이상 이력 로그 테이블
export const anomalyLogs = mysqlTable("anomaly_logs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(), // 사용자별 데이터 격리
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  current: float("current").notNull(),
  temperature: float("temperature").notNull(),
  vibration: float("vibration").notNull(),
  noise: float("noise").notNull(),
  anomalyScore: float("anomaly_score").notNull(),
  riskLevel: mysqlEnum("risk_level", ["normal", "caution", "warning", "danger"]).notNull(),
  isAnomaly: int("is_anomaly").notNull().default(0),
  llmAnalysisKo: text("llm_analysis_ko"),
  llmAnalysisEn: text("llm_analysis_en"),
  llmAnalysisJa: text("llm_analysis_ja"),
});

export type AnomalyLog = typeof anomalyLogs.$inferSelect;
export type InsertAnomalyLog = typeof anomalyLogs.$inferInsert;

// 데이터 공유 권한 테이블
export const dataSharing = mysqlTable("data_sharing", {
  id: int("id").autoincrement().primaryKey(),
  ownerId: int("owner_id").notNull(), // 데이터 소유자
  sharedWithUserId: int("shared_with_user_id").notNull(), // 공유 대상 사용자
  permission: mysqlEnum("permission", ["view", "edit"]).default("view").notNull(), // 권한 수준
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type DataSharing = typeof dataSharing.$inferSelect;
export type InsertDataSharing = typeof dataSharing.$inferInsert;

// 방문자 카운터 테이블
export const visitorStats = mysqlTable("visitor_stats", {
  id: int("id").autoincrement().primaryKey(),
  date: varchar("date", { length: 10 }).notNull().unique(), // YYYY-MM-DD
  count: int("count").notNull().default(0),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type VisitorStat = typeof visitorStats.$inferSelect;

// 대회용 제품 사용 지표: 사용자 ID, 이벤트 유형, UTC 일자와 시각만 저장한다.
// IP·기기 정보·입력 내용은 수집하지 않으며, 화면에는 집계값만 표시한다.
export const productActivityEvents = mysqlTable("product_activity_events", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  eventType: mysqlEnum("event_type", ["visit", "analysis_started", "analysis_viewed"]).notNull(),
  eventDate: date("event_date").notNull(),
  occurredAt: timestamp("occurred_at").defaultNow().notNull(),
}, (table) => ({
  userEventDateUnique: uniqueIndex("product_activity_user_event_date_unique").on(table.userId, table.eventType, table.eventDate),
  eventDateIndex: index("product_activity_event_date_idx").on(table.eventDate, table.eventType),
}));

export type ProductActivityEvent = typeof productActivityEvents.$inferSelect;
export type ProductActivityEventType = "visit" | "analysis_started" | "analysis_viewed";

// 첫 분석 완료 온보딩: 진행 단계와 완료 시각만 사용자별로 저장한다.
// 안내 문구·입력 내용·설비 데이터는 저장하지 않는다.
export const userOnboardingProgress = mysqlTable("user_onboarding_progress", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull().unique(),
  currentStep: int("current_step").notNull().default(1),
  completedAt: timestamp("completed_at"),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type UserOnboardingProgress = typeof userOnboardingProgress.$inferSelect;

// 선택형 첫 사용 피드백: 개인정보·자유 입력·센서값은 저장하지 않는다.
// 사용자별 최신 응답 1건의 편의 평점, 어려웠던 단계, 제출 시각만 보관한다.
export const firstUseFeedback = mysqlTable("first_use_feedback", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull().unique(),
  easeRating: int("ease_rating").notNull(),
  difficultStep: mysqlEnum("difficult_step", ["none", "orientation", "risk_review", "analysis_review"]).notNull().default("none"),
  submittedAt: timestamp("submitted_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  submittedAtIndex: index("first_use_feedback_submitted_at_idx").on(table.submittedAt),
}));

export type FirstUseFeedback = typeof firstUseFeedback.$inferSelect;
export type FirstUseFeedbackDifficultStep = "none" | "orientation" | "risk_review" | "analysis_review";

// 전체 샘플 카운터 (정상 포함 모든 측정값 집계용)
export const sampleStats = mysqlTable("sample_stats", {
  id: int("id").autoincrement().primaryKey(),
  key: varchar("key", { length: 32 }).notNull().unique(), // 'total_samples', 'reset_offset'
  value: int("value").notNull().default(0),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SampleStat = typeof sampleStats.$inferSelect;

// 위험도 임계값 설정 테이블 (싱글톤 row: key='default')
export const thresholdSettings = mysqlTable("threshold_settings", {
  id: int("id").autoincrement().primaryKey(),
  key: varchar("key", { length: 32 }).notNull().unique(), // 'default'
  normalMax: int("normal_max").notNull().default(29),
  cautionMax: int("caution_max").notNull().default(49),
  warningMax: int("warning_max").notNull().default(69),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ThresholdSetting = typeof thresholdSettings.$inferSelect;

// 센서별 임계값 설정 테이블 (싱글톤 row: key='default')
export const sensorThresholds = mysqlTable("sensor_thresholds", {
  id: int("id").autoincrement().primaryKey(),
  key: varchar("key", { length: 32 }).notNull().unique(), // 'default'
  // 전류 (A) 임계값
  currentCaution: float("current_caution").notNull().default(7.0),
  currentWarning: float("current_warning").notNull().default(9.0),
  currentDanger: float("current_danger").notNull().default(11.0),
  // 온도 (°C) 임계값
  tempCaution: float("temp_caution").notNull().default(55.0),
  tempWarning: float("temp_warning").notNull().default(70.0),
  tempDanger: float("temp_danger").notNull().default(85.0),
  // 진동 (g) 임계값
  vibCaution: float("vib_caution").notNull().default(0.6),
  vibWarning: float("vib_warning").notNull().default(0.8),
  vibDanger: float("vib_danger").notNull().default(1.0),
  // 소음 (dB) 임계값
  noiseCaution: float("noise_caution").notNull().default(65.0),
  noiseWarning: float("noise_warning").notNull().default(75.0),
  noiseDanger: float("noise_danger").notNull().default(85.0),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SensorThreshold = typeof sensorThresholds.$inferSelect;

// 사용자별 통계 테이블 (각 사용자의 절감 비용, 이상 탐지 횟수 등)
export const userStats = mysqlTable("user_stats", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull().unique(),
  totalAnomalies: int("total_anomalies").notNull().default(0),
  totalSavedCost: int("total_saved_cost").notNull().default(0),
  dangerResetOffset: int("danger_reset_offset").notNull().default(0),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type UserStat = typeof userStats.$inferSelect;
export type InsertUserStat = typeof userStats.$inferInsert;

// 챗봇 상담 세션 테이블
export const chatSessions = mysqlTable("chat_sessions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  title: varchar("title", { length: 255 }).notNull().default("새로운 상담"),
  isPinned: int("is_pinned").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type ChatSession = typeof chatSessions.$inferSelect;
export type InsertChatSession = typeof chatSessions.$inferInsert;

// 챗봇 대화 메시지 테이블
export const chatMessagesTable = mysqlTable("chat_messages", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: int("session_id").notNull(),
  role: mysqlEnum("role", ["user", "assistant"]).notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type ChatMessageRecord = typeof chatMessagesTable.$inferSelect;
export type InsertChatMessageRecord = typeof chatMessagesTable.$inferInsert;

// 챗봇 메시지별 사용자 평가 이력. 원문 스냅샷을 보관해 답변 수정 후에도 피드백 근거를 유지한다.
export const chatFeedback = mysqlTable("chat_feedback", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  sessionId: int("session_id").notNull(),
  messageId: int("message_id"),
  messageContent: text("message_content").notNull(),
  feedbackType: mysqlEnum("feedback_type", ["like", "dislike"]).notNull(),
  reasonCode: varchar("reason_code", { length: 32 }),
  reasonText: text("reason_text"),
  regeneratedContent: text("regenerated_content"),
  regeneratedAt: timestamp("regenerated_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  feedbackUserIndex: index("chat_feedback_user_idx").on(table.userId, table.createdAt),
  feedbackSessionIndex: index("chat_feedback_session_idx").on(table.sessionId, table.createdAt),
  feedbackMessageIndex: index("chat_feedback_message_idx").on(table.messageId),
}));

export type ChatFeedback = typeof chatFeedback.$inferSelect;
export type InsertChatFeedback = typeof chatFeedback.$inferInsert;

// 설비 매뉴얼 RAG: 문서의 저장 위치와 관리 정보를 보관한다. 실제 바이트는 S3에 저장한다.
export const manualDocuments = mysqlTable("manual_documents", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  fileKey: varchar("file_key", { length: 512 }),
  sourceType: mysqlEnum("source_type", ["text", "upload"]).notNull().default("text"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  manualUserIndex: index("manual_documents_user_idx").on(table.userId, table.createdAt),
}));

export type ManualDocument = typeof manualDocuments.$inferSelect;

// 매뉴얼 본문을 작은 검색 단위로 나눈 청크. 초기 버전은 키워드 검색으로 관련 근거를 찾아 LLM에 전달한다.
export const manualChunks = mysqlTable("manual_chunks", {
  id: int("id").autoincrement().primaryKey(),
  documentId: int("document_id").notNull(),
  chunkIndex: int("chunk_index").notNull(),
  content: text("content").notNull(),
  keywords: varchar("keywords", { length: 512 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  manualChunkDocumentIndex: index("manual_chunks_document_idx").on(table.documentId, table.chunkIndex),
}));

export type ManualChunk = typeof manualChunks.$inferSelect;
