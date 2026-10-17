import { createHmac } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import { accountRevocations } from "../drizzle/schema";
import { ENV } from "./_core/env";

const preparations = new WeakMap<object, Promise<void>>();

/** Approved additive migration only. Never alter existing tables or delete data here. */
export function ensureAccountRevocationStorage(database: MySql2Database<Record<string, unknown>>) {
  let pending = preparations.get(database);
  if (!pending) {
    pending = database.execute(sql`CREATE TABLE IF NOT EXISTS account_revocations (
      subject_hash varchar(64) NOT NULL PRIMARY KEY,
      revoked_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`).then(() => undefined).catch(error => {
      preparations.delete(database);
      throw error;
    });
    preparations.set(database, pending);
  }
  return pending;
}

/** Do not retain names, badge numbers, emails or the original external subject. */
export function revokedSubjectHash(openId: string) {
  if (!ENV.cookieSecret) throw new Error("Session signing is not configured");
  return createHmac("sha256", ENV.cookieSecret).update("semiguard-account-revocation-v1\0").update(openId).digest("hex");
}

export async function isRevoked(database: MySql2Database<Record<string, unknown>>, openId: string) {
  const rows = await database.select({ hash: accountRevocations.subjectHash }).from(accountRevocations)
    .where(eq(accountRevocations.subjectHash, revokedSubjectHash(openId))).limit(1);
  return rows.length > 0;
}
