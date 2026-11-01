import { createHash, createHmac, randomBytes } from "node:crypto";
import { TRPCError } from "@trpc/server";
import type { Request } from "express";
import { hashPassword, verifyPassword } from "./password";
import { ENV } from "./_core/env";
import { getSessionCookieOptions } from "./_core/cookies";
import { recoveryMailAvailable, sendRecoveryMail } from "./recoveryMail";
import { getRecoveryStore, type RecoveryStore, type RecoveryTransaction, type RecoveryUser, type RecoveryToken } from "./accountRecoveryStore";
import type { RecoveryEnrollment, RecoveryRequest, RecoveryReset } from "../shared/accountRecovery";

const TOKEN_LIFETIME_MS = 15 * 60 * 1000;
// The delivery adapter has an 8-second hard timeout. The public receipt floor
// covers that work whether or not an eligible account exists. Database outages
// cannot provide an absolute timing guarantee and return a global unavailable error.
const RECEIPT_MINIMUM_MS = 10_000;
const accepted = () => ({ accepted: true } as const);
const success = () => ({ success: true } as const);
const unavailable = () => new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "RECOVERY_UNAVAILABLE" });
const invalidLink = () => new TRPCError({ code: "BAD_REQUEST", message: "RECOVERY_LINK_INVALID" });
const denied = () => new TRPCError({ code: "UNAUTHORIZED", message: "RECOVERY_REAUTH_REQUIRED" });
export const normalizeRecoveryEmail = (value: string) => value.trim().toLowerCase();
export const recoveryTokenHash = (token: string) => createHash("sha256").update(token).digest("hex");

type Mail = Parameters<typeof sendRecoveryMail>[0];
type Dependencies = {
  available: () => boolean;
  store: () => Promise<RecoveryStore>;
  send: (mail: Mail) => Promise<void>;
  secret: () => string;
  now?: () => number;
  randomToken?: () => string;
  receiptMinimumMs?: number;
};

/** An explicit origin check also excludes comma-separated tRPC batches. */
export function assertRecoveryRequestOrigin(req: Request) {
  if (req.method !== "POST" || req.path?.includes(",")) {
    throw new TRPCError({ code: "FORBIDDEN", message: "RECOVERY_ORIGIN" });
  }
  try {
    const origin = req.headers.origin;
    const parsed = typeof origin === "string" ? new URL(origin) : null;
    const expectedProtocol = getSessionCookieOptions(req).secure ? "https:" : "http:";
    if (!parsed || parsed.protocol !== expectedProtocol || parsed.host !== req.headers.host?.toLowerCase()
      || parsed.pathname !== "/" || parsed.search || parsed.hash || parsed.username || parsed.password) throw new Error();
  } catch { throw new TRPCError({ code: "FORBIDDEN", message: "RECOVERY_ORIGIN" }); }
}

/** The address is used only for a server-side keyed rate-limit digest. */
export function recoveryClientKey(req: Request) {
  return req.ip || req.socket?.remoteAddress || "unknown-client";
}

export function createAccountRecoveryService(dependencies: Dependencies) {
  const now = dependencies.now ?? Date.now;
  const randomToken = dependencies.randomToken ?? (() => randomBytes(32).toString("base64url"));
  const digest = (kind: string, value: string) => createHmac("sha256", dependencies.secret())
    .update(`semiguard-account-recovery-v1\0${kind}\0${value}`).digest("hex");
  const emailKey = (email: string) => digest("email", normalizeRecoveryEmail(email));
  const availability = async () => {
    if (!dependencies.available()) return { available: false };
    try { return { available: await (await dependencies.store()).ready() }; }
    catch { return { available: false }; }
  };
  const requireAvailable = async () => { if (!(await availability()).available) throw unavailable(); };
  const secure = async <T>(operation: () => Promise<T>): Promise<T> => {
    try { return await operation(); } catch (error) {
      if (error instanceof TRPCError) throw error;
      // Driver/provider exceptions may include account data or connection values.
      throw unavailable();
    }
  };
  async function receipt<T>(operation: () => Promise<T>) {
    const started = Date.now();
    try { return await operation(); } finally {
      const delay = (dependencies.receiptMinimumMs ?? RECEIPT_MINIMUM_MS) - (Date.now() - started);
      if (delay > 0) await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  async function limit(store: RecoveryStore, scope: string, client: string, subject: string) {
    const time = now();
    const window = Math.floor(time / TOKEN_LIFETIME_MS);
    const expiresAt = new Date((window + 1) * TOKEN_LIFETIME_MS);
    return store.transaction(async tx => {
      await tx.purgeExpired(new Date(time));
      // Consume the global/IP budget first; arbitrary identifiers cannot create
      // unbounded rows after those ceilings have been reached.
      for (const entry of [
        { value: "global", maximum: 1000 },
        { value: `client:${client}`, maximum: 30 },
        { value: `subject:${subject}`, maximum: 5 },
      ]) if (!await tx.hitLimit({ key: digest("limit", `${scope}:${window}:${entry.value}`), maximum: entry.maximum, expiresAt })) return false;
      return true;
    });
  }
  async function eligible(tx: RecoveryTransaction, user: RecoveryUser | undefined): Promise<boolean> {
    return Boolean(user && user.openId.startsWith("local_") && user.passwordHash && user.badgeNumber
      && Number.isSafeInteger(user.authVersion) && user.authVersion >= 0 && user.authVersion < 2147483647
      && !await tx.revoked(user.openId));
  }
  async function mailboxBudget(tx: RecoveryTransaction, email: string) {
    const window = Math.floor(now() / TOKEN_LIFETIME_MS);
    // One recipient budget across identifier spellings, lookup methods,
    // purposes, enrollment accounts and application instances.
    return tx.hitLimit({ key: digest("send", `${window}:${normalizeRecoveryEmail(email)}`), maximum: 5,
      expiresAt: new Date((window + 1) * TOKEN_LIFETIME_MS) });
  }
  function tokenValue(user: RecoveryUser, kind: RecoveryToken["kind"], email: string, language: RecoveryToken["language"]) {
    const token = randomToken();
    return { token, row: { tokenHash: recoveryTokenHash(token), userId: user.id, kind, language, email,
      authVersion: user.authVersion, expiresAt: new Date(now() + TOKEN_LIFETIME_MS) } satisfies RecoveryToken };
  }
  async function lockedToken(tx: RecoveryTransaction, token: string, kind: RecoveryToken["kind"]) {
    const hash = recoveryTokenHash(token);
    const initial = await tx.token(hash);
    if (!initial) throw invalidLink();
    // Lock in the same user-first order as account withdrawal. Then re-read the
    // token under lock; concurrent redemption/reset/deletion cannot reuse it.
    const user = await tx.user(initial.userId, true);
    const row = await tx.token(hash, true);
    if (!user || !await eligible(tx, user) || !row || row.userId !== user.id || row.kind !== kind
      || row.expiresAt.getTime() <= now() || row.authVersion !== user.authVersion) throw invalidLink();
    return { user, row };
  }
  return {
    availability,
    async status(userId: number) {
      if (!(await availability()).available) return { available: false, verifiedEmail: null, loginId: null };
      return secure(async () => {
        const store = await dependencies.store();
        const user = await store.user(userId);
        if (!user || !await eligible(store, user)) return { available: true, verifiedEmail: null, loginId: null };
        const address = await store.userEmail(userId);
        return { available: true, verifiedEmail: address?.email ?? null, loginId: user.badgeNumber };
      });
    },
    async enroll(userId: number, input: RecoveryEnrollment, client: string) {
      await requireAvailable();
      return receipt(() => secure(async () => {
        const store = await dependencies.store();
        if (!await limit(store, "enroll", client, String(userId))) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "RECOVERY_TRY_LATER" });
        const mail = await store.transaction(async tx => {
          const user = await tx.user(userId, true);
          if (!user || !await eligible(tx, user) || !verifyPassword(input.currentPassword, user.passwordHash!)) throw denied();
          const email = normalizeRecoveryEmail(input.email);
          // Do not reveal whether another account uses this email. A candidate
          // address never changes the verified recovery address before proof.
          const owners = await tx.emailsByKey(emailKey(email));
          if (owners.some(owner => owner.userId !== userId) || owners.length > 1) return null;
          if (!await mailboxBudget(tx, email)) return null;
          await tx.deleteTokens(userId, "verify");
          const value = tokenValue(user, "verify", email, input.language);
          await tx.addToken(value.row);
          return { to: email, language: input.language, kind: "verify", token: value.token } satisfies Mail;
        });
        if (mail) {
          try { await dependencies.send(mail); } catch { console.warn("[Account recovery] Enrollment delivery unavailable"); }
        }
        return accepted();
      }));
    },
    async confirmEmail(token: string, client: string) {
      await requireAvailable();
      return secure(async () => {
        const store = await dependencies.store();
        if (!await limit(store, "confirm", client, recoveryTokenHash(token))) throw invalidLink();
        try {
          return await store.transaction(async tx => {
            const { user, row } = await lockedToken(tx, token, "verify");
            const key = emailKey(row.email);
            const owners = await tx.emailsByKey(key);
            if (owners.length > 1 || owners.some(owner => owner.userId !== user.id)) throw invalidLink();
            await tx.saveEmail({ userId: user.id, email: row.email, emailKey: key, verifiedAt: new Date(now()) });
            await tx.deleteTokens(user.id);
            return success();
          });
        } catch (error) {
          // A concurrent unique-address conflict is intentionally indistinguishable
          // from any other invalid verification link.
          if (error instanceof TRPCError) throw error;
          throw invalidLink();
        }
      });
    },
    async request(input: RecoveryRequest, client: string) {
      // Disabled means no identity lookup, token creation, or false sent claim.
      await requireAvailable();
      return receipt(() => secure(async () => {
        const store = await dependencies.store();
        const identifier = input.method === "email" ? normalizeRecoveryEmail(input.identifier) : input.identifier.trim();
        if (!await limit(store, "request", client, `${input.method}:${identifier}`)) return accepted();
        const candidate = await store.transaction(async tx => {
          let userId: number | undefined;
          if (input.method === "id") {
            const users = await tx.usersByLoginId(identifier);
            if (users.length === 1) userId = users[0].id;
          } else {
            const addresses = await tx.emailsByKey(emailKey(identifier));
            if (addresses.length === 1) userId = addresses[0].userId;
          }
          if (userId === undefined) return null;
          const user = await tx.user(userId, true);
          if (!user || !await eligible(tx, user)) return null;
          const address = await tx.userEmail(user.id);
          if (!address || (input.method === "email" && address.emailKey !== emailKey(identifier))) return null;
          const owners = await tx.emailsByKey(address.emailKey);
          if (owners.length !== 1 || owners[0].userId !== user.id) return null;
          if (!await mailboxBudget(tx, address.email)) return null;
          // Username recovery reveals an ID only to its verified mailbox.
          if (input.purpose === "id") return { to: address.email, language: input.language, kind: "id", loginId: user.badgeNumber! } satisfies Mail;
          const value = tokenValue(user, "password", address.email, input.language);
          await tx.addToken(value.row);
          return { to: address.email, language: input.language, kind: "password", token: value.token } satisfies Mail;
        });
        if (candidate) {
          try { await dependencies.send(candidate); } catch { console.warn("[Account recovery] Request delivery unavailable"); }
        }
        return accepted();
      }));
    },
    async reset(input: RecoveryReset, client: string) {
      await requireAvailable();
      return secure(async () => {
        const store = await dependencies.store();
        if (!await limit(store, "reset", client, recoveryTokenHash(input.token))) throw invalidLink();
        const notification = await store.transaction(async tx => {
          const { user, row } = await lockedToken(tx, input.token, "password");
          const address = await tx.userEmail(user.id);
          if (!address || address.email !== row.email) throw invalidLink();
          const owners = await tx.emailsByKey(address.emailKey);
          if (owners.length !== 1 || owners[0].userId !== user.id) throw invalidLink();
          await tx.changePassword(user.id, hashPassword(input.password), user.authVersion + 1);
          await tx.deleteTokens(user.id);
          return { to: address.email, language: row.language, kind: "changed" } satisfies Mail;
        });
        try { await dependencies.send(notification); } catch { console.warn("[Account recovery] Password-change notice unavailable"); }
        return success();
      });
    },
  };
}

export const accountRecovery = createAccountRecoveryService({
  available: () => process.env.SEMIGUARD_ACCOUNT_RECOVERY_ENABLED === "1" && Boolean(ENV.cookieSecret) && recoveryMailAvailable(),
  store: getRecoveryStore,
  send: sendRecoveryMail,
  secret: () => ENV.cookieSecret,
});
