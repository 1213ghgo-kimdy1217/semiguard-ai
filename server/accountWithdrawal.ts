import { TRPCError } from "@trpc/server";
import { and, eq, inArray, isNotNull, or, sql } from "drizzle-orm";
import * as tables from "../drizzle/schema";
import { getDb } from "./db";
import { ensureAccountRevocationStorage, revokedSubjectHash } from "./accountRevocations";
import { verifyPassword } from "./password";
import type { AccountWithdrawalInput } from "../shared/accountWithdrawal";

const unavailable = () => new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "WITHDRAWAL_UNAVAILABLE" });
const denied = () => new TRPCError({ code: "UNAUTHORIZED", message: "WITHDRAWAL_REAUTH_REQUIRED" });

export async function getWithdrawalStatus(userId: number) {
  try {
    const database = await getDb();
    if (!database) throw unavailable();
    // Exercise a real transaction and column visibility without retrieving any records.
    // Do not offer destructive submission when a required store is missing/incompatible.
    await database.transaction(async tx => {
      for (const probe of [
        sql`SELECT subject_hash, revoked_at FROM account_revocations LIMIT 0`,
        sql`SELECT id, openId, password_hash, role FROM users LIMIT 0`,
        sql`SELECT user_id FROM training_attempts LIMIT 0`, sql`SELECT user_id FROM training_drafts LIMIT 0`,
        sql`SELECT user_id FROM anomaly_logs LIMIT 0`, sql`SELECT owner_id, shared_with_user_id FROM data_sharing LIMIT 0`,
        sql`SELECT user_id FROM product_activity_events LIMIT 0`, sql`SELECT user_id FROM user_onboarding_progress LIMIT 0`,
        sql`SELECT user_id FROM first_use_feedback LIMIT 0`, sql`SELECT user_id FROM user_stats LIMIT 0`,
        sql`SELECT user_id FROM social_account_links LIMIT 0`, sql`SELECT user_id FROM chat_feedback LIMIT 0`,
        sql`SELECT user_id FROM account_recovery_emails LIMIT 0`, sql`SELECT user_id FROM account_recovery_tokens LIMIT 0`,
        sql`SELECT id, user_id FROM chat_sessions LIMIT 0`, sql`SELECT session_id FROM chat_messages LIMIT 0`,
        sql`SELECT id, user_id, file_key, source_type FROM manual_documents LIMIT 0`, sql`SELECT document_id FROM manual_chunks LIMIT 0`,
      ]) await tx.execute(probe);
    });
    const [user] = await database.select().from(tables.users).where(eq(tables.users.id, userId)).limit(1);
    if (!user) throw denied();
    const files = await database.select({ id: tables.manualDocuments.id }).from(tables.manualDocuments)
      .where(and(eq(tables.manualDocuments.userId, userId), or(isNotNull(tables.manualDocuments.fileKey), eq(tables.manualDocuments.sourceType, "upload")))).limit(1);
    return { passwordRequired: Boolean(user.passwordHash), blocked: user.role === "admin" ? "admin" as const : files.length ? "files" as const : null };
  } catch (error) {
    if (error instanceof TRPCError) throw error;
    throw unavailable();
  }
}

/** All account rows and the revocation marker commit together, or none do. */
export async function withdrawAccount(userId: number, input: AccountWithdrawalInput, freshLogin: boolean) {
  try {
    const database = await getDb();
    if (!database) throw unavailable();
    await ensureAccountRevocationStorage(database);
    return await database.transaction(async tx => {
      const [user] = await tx.select().from(tables.users).where(eq(tables.users.id, userId)).limit(1).for("update");
      if (!user) throw denied();
      if (user.role === "admin") throw new TRPCError({ code: "PRECONDITION_FAILED", message: "WITHDRAWAL_ADMIN" });
      if (user.passwordHash ? !verifyPassword(input.password ?? "", user.passwordHash) : !freshLogin) throw denied();

      const documents = await tx.select({ id: tables.manualDocuments.id, fileKey: tables.manualDocuments.fileKey, sourceType: tables.manualDocuments.sourceType })
        .from(tables.manualDocuments).where(eq(tables.manualDocuments.userId, userId)).for("update");
      // There is no verified external-object deletion API. Never silently orphan files.
      if (documents.some(document => document.fileKey !== null || document.sourceType === "upload")) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "WITHDRAWAL_EXTERNAL_FILES" });
      }
      const sessions = await tx.select({ id: tables.chatSessions.id }).from(tables.chatSessions).where(eq(tables.chatSessions.userId, userId)).for("update");
      await tx.insert(tables.accountRevocations).values({ subjectHash: revokedSubjectHash(user.openId) });
      if (sessions.length) await tx.delete(tables.chatMessagesTable).where(inArray(tables.chatMessagesTable.sessionId, sessions.map(session => session.id)));
      if (documents.length) await tx.delete(tables.manualChunks).where(inArray(tables.manualChunks.documentId, documents.map(document => document.id)));
      await tx.delete(tables.chatFeedback).where(eq(tables.chatFeedback.userId, userId));
      await tx.delete(tables.chatSessions).where(eq(tables.chatSessions.userId, userId));
      await tx.delete(tables.manualDocuments).where(eq(tables.manualDocuments.userId, userId));
      await tx.delete(tables.trainingDrafts).where(eq(tables.trainingDrafts.userId, userId));
      await tx.delete(tables.trainingAttempts).where(eq(tables.trainingAttempts.userId, userId));
      await tx.delete(tables.anomalyLogs).where(eq(tables.anomalyLogs.userId, userId));
      await tx.delete(tables.dataSharing).where(or(eq(tables.dataSharing.ownerId, userId), eq(tables.dataSharing.sharedWithUserId, userId)));
      await tx.delete(tables.productActivityEvents).where(eq(tables.productActivityEvents.userId, userId));
      await tx.delete(tables.userOnboardingProgress).where(eq(tables.userOnboardingProgress.userId, userId));
      await tx.delete(tables.firstUseFeedback).where(eq(tables.firstUseFeedback.userId, userId));
      await tx.delete(tables.userStats).where(eq(tables.userStats.userId, userId));
      await tx.delete(tables.socialAccountLinks).where(eq(tables.socialAccountLinks.userId, userId));
      await tx.delete(tables.accountRecoveryTokens).where(eq(tables.accountRecoveryTokens.userId, userId));
      await tx.delete(tables.accountRecoveryEmails).where(eq(tables.accountRecoveryEmails.userId, userId));
      await tx.delete(tables.users).where(and(eq(tables.users.id, userId), eq(tables.users.openId, user.openId)));
      // Browser-scoped consent metrics and global aggregates have no account key.
      return { success: true } as const;
    });
  } catch (error) {
    if (error instanceof TRPCError) throw error;
    // No credentials, queries, document contents or account identifiers in errors.
    throw unavailable();
  }
}
