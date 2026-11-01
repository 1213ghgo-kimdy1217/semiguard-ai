import { and, eq, lte, sql } from "drizzle-orm";
import { accountRecoveryEmails, accountRecoveryLimits, accountRecoveryTokens, accountRevocations, users } from "../drizzle/schema";
import { getDb } from "./db";
import { revokedSubjectHash } from "./accountRevocations";
import type { RecoveryLanguage } from "../shared/accountRecovery";

export type RecoveryUser = { id: number; openId: string; badgeNumber: string | null; passwordHash: string | null; authVersion: number };
export type RecoveryEmail = { userId: number; email: string; emailKey: string; verifiedAt: Date };
export type RecoveryToken = { tokenHash: string; userId: number; kind: "verify" | "password"; language: RecoveryLanguage; email: string; authVersion: number; expiresAt: Date };
export type RecoveryLimit = { key: string; maximum: number; expiresAt: Date };
export interface RecoveryTransaction {
  user(id: number, lock?: boolean): Promise<RecoveryUser | undefined>;
  usersByLoginId(id: string): Promise<RecoveryUser[]>;
  emailsByKey(key: string): Promise<RecoveryEmail[]>;
  userEmail(id: number): Promise<RecoveryEmail | undefined>;
  token(hash: string, lock?: boolean): Promise<RecoveryToken | undefined>;
  revoked(openId: string): Promise<boolean>;
  addToken(token: RecoveryToken): Promise<void>;
  deleteTokens(id: number, kind?: RecoveryToken["kind"]): Promise<void>;
  saveEmail(email: RecoveryEmail): Promise<void>;
  changePassword(id: number, hash: string, nextVersion: number): Promise<void>;
  hitLimit(limit: RecoveryLimit): Promise<boolean>;
  purgeExpired(now: Date): Promise<void>;
}
export interface RecoveryStore extends RecoveryTransaction {
  ready(): Promise<boolean>;
  transaction<T>(callback: (tx: RecoveryTransaction) => Promise<T>): Promise<T>;
}

/** Every query uses bound values. No runtime schema creation or imported-email fallback. */
function transactionAdapter(database: any): RecoveryTransaction {
  const selection = { id: users.id, openId: users.openId, badgeNumber: users.badgeNumber, passwordHash: users.passwordHash, authVersion: users.authVersion };
  return {
    async user(id, lock = false) {
      const query = database.select(selection).from(users).where(eq(users.id, id)).limit(1);
      const rows = await (lock ? query.for("update") : query);
      return rows[0];
    },
    async usersByLoginId(id) {
      // Legacy badge_number is not unique. Ambiguity must fail closed.
      return database.select(selection).from(users).where(eq(users.badgeNumber, id)).limit(2);
    },
    async emailsByKey(key) {
      return database.select().from(accountRecoveryEmails).where(eq(accountRecoveryEmails.emailKey, key)).limit(2);
    },
    async userEmail(id) {
      const rows = await database.select().from(accountRecoveryEmails).where(eq(accountRecoveryEmails.userId, id)).limit(1);
      return rows[0];
    },
    async token(hash, lock = false) {
      const query = database.select().from(accountRecoveryTokens).where(eq(accountRecoveryTokens.tokenHash, hash)).limit(1);
      const rows = await (lock ? query.for("update") : query);
      return rows[0];
    },
    async revoked(openId) {
      const rows = await database.select({ hash: accountRevocations.subjectHash }).from(accountRevocations)
        .where(eq(accountRevocations.subjectHash, revokedSubjectHash(openId))).limit(1);
      return rows.length > 0;
    },
    async addToken(token) { await database.insert(accountRecoveryTokens).values(token); },
    async deleteTokens(id, kind) {
      await database.delete(accountRecoveryTokens).where(kind
        ? and(eq(accountRecoveryTokens.userId, id), eq(accountRecoveryTokens.kind, kind))
        : eq(accountRecoveryTokens.userId, id));
    },
    async saveEmail(email) {
      const existing = await this.userEmail(email.userId);
      // Do not use MySQL ON DUPLICATE KEY UPDATE: a different owner's unique
      // email collision must never update that owner's row.
      if (existing) await database.update(accountRecoveryEmails).set(email).where(eq(accountRecoveryEmails.userId, email.userId));
      else await database.insert(accountRecoveryEmails).values(email);
    },
    async changePassword(id, hash, nextVersion) {
      await database.update(users).set({ passwordHash: hash, authVersion: nextVersion }).where(eq(users.id, id));
    },
    async hitLimit(limit) {
      await database.insert(accountRecoveryLimits).values({ key: limit.key, hits: 1, expiresAt: limit.expiresAt })
        .onDuplicateKeyUpdate({ set: { hits: sql`${accountRecoveryLimits.hits} + 1` } });
      const [row] = await database.select({ hits: accountRecoveryLimits.hits }).from(accountRecoveryLimits)
        .where(eq(accountRecoveryLimits.key, limit.key)).limit(1).for("update");
      return Boolean(row && row.hits <= limit.maximum);
    },
    async purgeExpired(now) {
      // Bound work per request; the global request ceiling bounds new rows per
      // window and repeated cleanup drains expired counters/tokens without cron.
      await database.delete(accountRecoveryLimits).where(lte(accountRecoveryLimits.expiresAt, now)).limit(100);
      await database.delete(accountRecoveryTokens).where(lte(accountRecoveryTokens.expiresAt, now)).limit(100);
    },
  };
}

export async function getRecoveryStore(): Promise<RecoveryStore> {
  const database = await getDb();
  if (!database) throw new Error("RECOVERY_STORAGE_UNAVAILABLE");
  return {
    ...transactionAdapter(database),
    async ready() {
      try {
        for (const probe of [
          sql`SELECT auth_version FROM users LIMIT 0`,
          sql`SELECT user_id, email, email_key, verified_at FROM account_recovery_emails LIMIT 0`,
          sql`SELECT token_hash, user_id, kind, language, email, auth_version, expires_at FROM account_recovery_tokens LIMIT 0`,
          sql`SELECT limit_key, hits, expires_at FROM account_recovery_limits LIMIT 0`,
          sql`SELECT subject_hash FROM account_revocations LIMIT 0`,
        ]) await database.execute(probe);
        return true;
      } catch { return false; }
    },
    transaction: callback => database.transaction(tx => callback(transactionAdapter(tx))),
  };
}
