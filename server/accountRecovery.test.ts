import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { createAccountRecoveryService, recoveryTokenHash, assertRecoveryRequestOrigin } from "./accountRecovery";
import type { RecoveryEmail, RecoveryLimit, RecoveryStore, RecoveryToken, RecoveryTransaction, RecoveryUser } from "./accountRecoveryStore";
import { recoveryEnrollmentSchema, recoveryRequestSchema, recoveryResetSchema } from "../shared/accountRecovery";
import { hashPassword, verifyPassword } from "./password";
import type { RecoveryMail } from "./recoveryMail";

const SECRET = "synthetic-recovery-unit-test-secret";
const PASSWORD = "synthetic-old-password";
const NEW_PASSWORD = "synthetic-new-password";
const initialHash = hashPassword(PASSWORD);
const initialTime = Date.UTC(2026, 10, 1, 4, 0, 0);
const emailKey = (email: string) => createHmac("sha256", SECRET)
  .update(`semiguard-account-recovery-v1\0email\0${email.toLowerCase()}`).digest("hex");
const baseUser = (id = 21): RecoveryUser => ({ id, openId: `local_synthetic-${id}`, badgeNumber: `QA-${id}`, passwordHash: initialHash, authVersion: 0 });

/** Serializable transactional fixture. A failed callback restores every table;
 * competing redemptions see committed state rather than preselected row arrays. */
function fixture() {
  let state = {
    users: new Map<number, RecoveryUser>([[21, baseUser()], [22, baseUser(22)]]),
    emails: new Map<number, RecoveryEmail>(), tokens: new Map<string, RecoveryToken>(),
    limits: new Map<string, { hits: number; expiresAt: Date }>(), revoked: new Set<string>(),
  };
  let time = initialTime;
  let available = true;
  let ready = true;
  let sequence = 0;
  let failDelete = false;
  let failDelivery: RecoveryMail["kind"] | null = null;
  const mail: RecoveryMail[] = [];
  const reads = vi.fn();
  const lockOrder: string[] = [];
  let tail: Promise<void> = Promise.resolve();
  const store: RecoveryStore = {
    ready: async () => ready,
    async user(id, lock) { reads("user"); if (lock) lockOrder.push("user"); return state.users.get(id); },
    async usersByLoginId(id) { reads("loginId"); return [...state.users.values()].filter(user => user.badgeNumber?.toLowerCase() === id.toLowerCase()).slice(0, 2); },
    async emailsByKey(key) { reads("email"); return [...state.emails.values()].filter(email => email.emailKey === key).slice(0, 2); },
    async userEmail(id) { reads("userEmail"); return state.emails.get(id); },
    async token(hash, lock) { if (lock) lockOrder.push("token"); return state.tokens.get(hash); },
    async revoked(openId) { return state.revoked.has(openId); },
    async addToken(row) { if (state.tokens.has(row.tokenHash)) throw new Error("synthetic-duplicate"); state.tokens.set(row.tokenHash, row); },
    async deleteTokens(id, kind) {
      if (failDelete) throw new Error("synthetic-private-driver-query-must-not-escape");
      for (const [hash, token] of state.tokens) if (token.userId === id && (!kind || kind === token.kind)) state.tokens.delete(hash);
    },
    async saveEmail(row) {
      if ([...state.emails.values()].some(email => email.userId !== row.userId && email.emailKey === row.emailKey)) throw new Error("synthetic-unique-conflict");
      state.emails.set(row.userId, row);
    },
    async changePassword(id, hash, version) { const row = state.users.get(id)!; state.users.set(id, { ...row, passwordHash: hash, authVersion: version }); },
    async hitLimit(limit: RecoveryLimit) {
      const hits = (state.limits.get(limit.key)?.hits ?? 0) + 1;
      state.limits.set(limit.key, { hits, expiresAt: limit.expiresAt });
      return hits <= limit.maximum;
    },
    async purgeExpired(now) {
      for (const [key, row] of state.limits) if (row.expiresAt <= now) state.limits.delete(key);
      for (const [key, row] of state.tokens) if (row.expiresAt <= now) state.tokens.delete(key);
    },
    async transaction<T>(callback: (tx: RecoveryTransaction) => Promise<T>): Promise<T> {
      const previous = tail;
      let release!: () => void;
      tail = new Promise<void>(resolve => { release = resolve; });
      await previous;
      const snapshot = structuredClone(state);
      try { return await callback(store); } catch (error) { state = snapshot; throw error; } finally { release(); }
    },
  };
  const storeFactory = vi.fn(async () => store);
  const send = vi.fn(async (value: RecoveryMail) => {
    if (value.kind === failDelivery) throw new Error("synthetic-private-provider-response");
    mail.push(structuredClone(value));
  });
  const build = (receiptMinimumMs = 0) => createAccountRecoveryService({
    available: () => available, store: storeFactory, send, secret: () => SECRET,
    now: () => time, randomToken: () => Buffer.alloc(32, ++sequence).toString("base64url"), receiptMinimumMs,
  });
  const service = build();
  const addEmail = (id = 21, email = `synthetic-${id}@example.invalid`) => state.emails.set(id, { userId: id, email, emailKey: emailKey(email), verifiedAt: new Date(time) });
  const request = (identifier = "QA-21", method: "id" | "email" = "id") => service.request({ purpose: "password", method, identifier, language: "en" }, "synthetic-client");
  const reset = (token: string) => service.reset({ token, password: NEW_PASSWORD, confirmation: NEW_PASSWORD }, "synthetic-client");
  return { service, build, mail, reads, store, storeFactory, send, addEmail, request, reset, lockOrder,
    state: () => state, advance: (ms: number) => { time += ms; }, disable: () => { available = false; },
    missingMigration: () => { ready = false; }, failDelete: () => { failDelete = true; },
    failDelivery: (kind: RecoveryMail["kind"]) => { failDelivery = kind; } };
}

describe("account recovery proof and request receipts", () => {
  it("does no storage or identity work when explicitly disabled", async () => {
    const f = fixture(); f.disable();
    expect(await f.service.availability()).toEqual({ available: false });
    expect(await f.service.status(21)).toEqual({ available: false, verifiedEmail: null, loginId: null });
    await expect(f.request()).rejects.toMatchObject({ code: "SERVICE_UNAVAILABLE", message: "RECOVERY_UNAVAILABLE" });
    expect(f.storeFactory).not.toHaveBeenCalled(); expect(f.reads).not.toHaveBeenCalled(); expect(f.send).not.toHaveBeenCalled();
  });
  it("reports missing migration unavailable before inspecting any account", async () => {
    const f = fixture(); f.missingMigration();
    expect(await f.service.availability()).toEqual({ available: false });
    await expect(f.request()).rejects.toMatchObject({ message: "RECOVERY_UNAVAILABLE" });
    expect(f.reads).not.toHaveBeenCalled();
  });
  it("requires current password and does not promote a candidate email before link proof", async () => {
    const f = fixture(); f.addEmail();
    await expect(f.service.enroll(21, { email: "new@example.invalid", currentPassword: "wrong", language: "ko" }, "client"))
      .rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(f.mail).toEqual([]);
    await f.service.enroll(21, { email: "New@Example.Invalid", currentPassword: PASSWORD, language: "ja" }, "client");
    expect(f.state().emails.get(21)?.email).toBe("synthetic-21@example.invalid");
    const token = f.mail[0].token!;
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const stored = [...f.state().tokens.values()][0];
    expect(stored.tokenHash).toBe(recoveryTokenHash(token));
    expect(JSON.stringify(stored)).not.toContain(token);
    expect(f.mail[0].language).toBe("ja");
    await f.service.confirmEmail(token, "client");
    expect(await f.service.status(21)).toEqual({ available: true, verifiedEmail: "new@example.invalid", loginId: "QA-21" });
    await expect(f.service.confirmEmail(token, "client")).rejects.toMatchObject({ message: "RECOVERY_LINK_INVALID" });
  });
  it("never trusts a profile/imported/provider email and returns the same unknown receipt", async () => {
    const f = fixture(); Object.assign(f.state().users.get(21)!, { email: "profile@example.invalid" });
    expect(await f.request()).toEqual({ accepted: true });
    expect(await f.request("profile@example.invalid", "email")).toEqual({ accepted: true });
    expect(await f.request("not-an-account")).toEqual({ accepted: true });
    expect(f.mail).toEqual([]); expect(f.state().tokens.size).toBe(0);
  });
  it("both lookup methods deliver only to the same verified owner without a public profile", async () => {
    const f = fixture(); f.addEmail();
    expect(await f.request()).toEqual({ accepted: true });
    expect(await f.request("SYNTHETIC-21@EXAMPLE.INVALID", "email")).toEqual({ accepted: true });
    expect(f.mail.map(mail => mail.to)).toEqual(["synthetic-21@example.invalid", "synthetic-21@example.invalid"]);
    expect(f.mail.every(mail => mail.kind === "password" && !mail.loginId)).toBe(true);
  });
  it("puts forgotten ID inside the verified mailbox only and creates no reset token", async () => {
    const f = fixture(); f.addEmail();
    const result = await f.service.request({ purpose: "id", method: "email", identifier: "synthetic-21@example.invalid", language: "ko" }, "client");
    expect(result).toEqual({ accepted: true });
    expect(f.mail).toEqual([{ to: "synthetic-21@example.invalid", language: "ko", kind: "id", loginId: "QA-21" }]);
    expect(f.state().tokens.size).toBe(0);
  });
  it.each(["duplicate-id", "duplicate-email", "revoked", "passwordless", "deleted"])("fails closed for %s without enumerating membership", async mode => {
    const f = fixture(); f.addEmail();
    if (mode === "duplicate-id") f.state().users.get(22)!.badgeNumber = "QA-21";
    if (mode === "duplicate-email") f.addEmail(22, "synthetic-21@example.invalid");
    if (mode === "revoked") f.state().revoked.add("local_synthetic-21");
    if (mode === "passwordless") f.state().users.get(21)!.passwordHash = null;
    if (mode === "deleted") f.state().users.delete(21);
    expect(await f.request()).toEqual({ accepted: true }); expect(f.mail).toEqual([]);
  });
  it("does not let a different owner claim an already-verified address", async () => {
    const f = fixture(); f.addEmail(22, "occupied@example.invalid");
    expect(await f.service.enroll(21, { email: "occupied@example.invalid", currentPassword: PASSWORD, language: "ko" }, "client")).toEqual({ accepted: true });
    expect(f.mail).toEqual([]); expect(f.state().emails.get(22)?.email).toBe("occupied@example.invalid");
  });
  it("does not reveal a provider delivery failure or print its private response", async () => {
    const f = fixture(); f.addEmail(); f.failDelivery("password");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(await f.request()).toEqual({ accepted: true });
    expect(warn).toHaveBeenCalledWith("[Account recovery] Request delivery unavailable");
    expect(JSON.stringify(warn.mock.calls)).not.toContain("private-provider"); warn.mockRestore();
  });
});

describe("atomic password replacement and expiry", () => {
  it("changes only the token owner, invalidates all their tokens, and sends no password", async () => {
    const f = fixture(); f.addEmail();
    await f.request(); const first = f.mail[0].token!;
    await f.request(); expect(f.state().tokens.size).toBe(2);
    expect(await f.reset(first)).toEqual({ success: true });
    expect(verifyPassword(NEW_PASSWORD, f.state().users.get(21)!.passwordHash!)).toBe(true);
    expect(verifyPassword(PASSWORD, f.state().users.get(21)!.passwordHash!)).toBe(false);
    expect(f.state().users.get(21)!.authVersion).toBe(1);
    expect(f.state().users.get(22)).toEqual(baseUser(22));
    expect(f.state().tokens.size).toBe(0);
    expect(f.mail.at(-1)).toEqual({ to: "synthetic-21@example.invalid", language: "en", kind: "changed" });
    expect(JSON.stringify(f.mail)).not.toContain(NEW_PASSWORD);
    await expect(f.reset(first)).rejects.toMatchObject({ message: "RECOVERY_LINK_INVALID" });
    expect(f.lockOrder.slice(-2)).toEqual(["user", "token"]);
  });
  it("allows exactly one of two concurrent redemptions", async () => {
    const f = fixture(); f.addEmail(); await f.request();
    const results = await Promise.allSettled([f.reset(f.mail[0].token!), f.reset(f.mail[0].token!)]);
    expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter(result => result.status === "rejected")).toHaveLength(1);
    expect(f.state().users.get(21)!.authVersion).toBe(1);
  });
  it.each(["expiry", "revocation", "deletion", "version", "address-change", "wrong-kind"])("rejects %s without changing the password", async mode => {
    const f = fixture(); f.addEmail(); await f.request();
    const token = f.mail[0].token!;
    if (mode === "expiry") f.advance(15 * 60 * 1000);
    if (mode === "revocation") f.state().revoked.add("local_synthetic-21");
    if (mode === "deletion") f.state().users.delete(21);
    if (mode === "version") f.state().users.get(21)!.authVersion = 1;
    if (mode === "address-change") f.addEmail(21, "replacement@example.invalid");
    if (mode === "wrong-kind") f.state().tokens.get(recoveryTokenHash(token))!.kind = "verify";
    await expect(f.reset(token)).rejects.toMatchObject({ message: "RECOVERY_LINK_INVALID" });
    if (mode !== "deletion") expect(f.state().users.get(21)!.passwordHash).toBe(initialHash);
  });
  it("rolls password, version and token consumption back together when a later write fails", async () => {
    const f = fixture(); f.addEmail(); await f.request(); const token = f.mail[0].token!;
    f.failDelete();
    await expect(f.reset(token)).rejects.toMatchObject({ message: "RECOVERY_UNAVAILABLE" });
    expect(f.state().users.get(21)).toEqual(baseUser());
    expect(f.state().tokens.has(recoveryTokenHash(token))).toBe(true);
    expect(f.mail).toHaveLength(1);
  });
  it("does not roll a completed reset back when the notification fails", async () => {
    const f = fixture(); f.addEmail(); await f.request(); f.failDelivery("changed");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(await f.reset(f.mail[0].token!)).toEqual({ success: true });
    expect(f.state().users.get(21)!.authVersion).toBe(1); expect(f.state().tokens.size).toBe(0);
    expect(warn).toHaveBeenCalledWith("[Account recovery] Password-change notice unavailable"); warn.mockRestore();
  });
});

describe("durable abuse controls and input boundary", () => {
  it("shares the per-identifier ceiling between independent service instances", async () => {
    const f = fixture(); f.addEmail();
    for (let i = 0; i < 7; i++) {
      const service = f.build();
      expect(await service.request({ purpose: "password", method: "id", identifier: "QA-21", language: "ko" }, `client-${i}`)).toEqual({ accepted: true });
    }
    expect(f.mail).toHaveLength(5);
    expect([...f.state().limits.keys()].every(key => /^[a-f0-9]{64}$/.test(key))).toBe(true);
  });
  it("caps identifier-row creation per client and cleans expired state on the next request", async () => {
    const f = fixture();
    for (let i = 0; i < 40; i++) await f.request(`unknown-${i}`);
    // One global, one client, and at most thirty subject counters.
    expect(f.state().limits.size).toBe(32);
    f.advance(15 * 60 * 1000);
    await f.request("unknown-after-window");
    expect(f.state().limits.size).toBe(3);
  });
  it("shares a verified-mailbox budget across ID collation variants, email and ID-recovery purposes", async () => {
    const f = fixture(); f.addEmail();
    for (const [index, identifier] of ["QA-21", "qa-21", "qA-21", "Qa-21"].entries()) {
      await f.service.request({ purpose: "password", method: "id", identifier, language: "ko" }, `client-${index}`);
    }
    await f.service.request({ purpose: "id", method: "email", identifier: "synthetic-21@example.invalid", language: "ja" }, "different-client");
    expect(await f.service.request({ purpose: "password", method: "email", identifier: "SYNTHETIC-21@EXAMPLE.INVALID", language: "en" }, "another-client")).toEqual({ accepted: true });
    expect(f.mail).toHaveLength(5); expect(f.state().tokens.size).toBe(4);
  });
  it("bounds enrollment email volume across different authenticated owners", async () => {
    const f = fixture();
    for (let id = 21; id <= 27; id++) {
      f.state().users.set(id, baseUser(id));
      expect(await f.service.enroll(id, { email: "one-mailbox@example.invalid", currentPassword: PASSWORD, language: "ko" }, `client-${id}`)).toEqual({ accepted: true });
    }
    expect(f.mail).toHaveLength(5); expect(f.state().tokens.size).toBe(5);
  });
  it("rejects extra fields, malformed tokens, short/mismatching passwords and ID-by-ID lookup", () => {
    expect(recoveryEnrollmentSchema.parse({ email: "qa@example.invalid", currentPassword: PASSWORD }).language).toBe("ko");
    expect(recoveryRequestSchema.safeParse({ purpose: "id", method: "id", identifier: "QA-21", language: "ko" }).success).toBe(false);
    expect(recoveryRequestSchema.safeParse({ purpose: "password", method: "email", identifier: "not-email", language: "ko" }).success).toBe(false);
    expect(recoveryResetSchema.safeParse({ token: "bad", password: NEW_PASSWORD, confirmation: NEW_PASSWORD }).success).toBe(false);
    expect(recoveryResetSchema.safeParse({ token: "A".repeat(43), password: "short", confirmation: "short" }).success).toBe(false);
    expect(recoveryResetSchema.safeParse({ token: "A".repeat(43), password: NEW_PASSWORD, confirmation: PASSWORD }).success).toBe(false);
    expect(recoveryResetSchema.safeParse({ token: "A".repeat(43), password: NEW_PASSWORD, confirmation: NEW_PASSWORD, userId: 22 }).success).toBe(false);
  });
  it("rejects foreign/missing origins, GET and batched mutations", () => {
    const request = { protocol: "https", method: "POST", path: "/accountRecovery.reset", headers: { host: "example.invalid", origin: "https://example.invalid" } };
    expect(() => assertRecoveryRequestOrigin(request as any)).not.toThrow();
    for (const invalid of [
      { ...request, method: "GET" }, { ...request, path: "/accountRecovery.reset,auth.me" },
      { ...request, headers: { host: "example.invalid", origin: "https://foreign.invalid" } },
      { ...request, headers: { host: "example.invalid", origin: "http://example.invalid" } },
      { ...request, headers: { host: "example.invalid" } },
    ]) expect(() => assertRecoveryRequestOrigin(invalid as any)).toThrow("RECOVERY_ORIGIN");
  });
  it("waits the same minimum receipt duration for absent and eligible accounts", async () => {
    vi.useFakeTimers();
    try {
      const absent = fixture(); const eligible = fixture(); eligible.addEmail();
      const done = vi.fn();
      const a = absent.build(10_000).request({ purpose: "password", method: "id", identifier: "missing", language: "ko" }, "client").then(done);
      const b = eligible.build(10_000).request({ purpose: "password", method: "id", identifier: "QA-21", language: "ko" }, "client").then(done);
      await vi.advanceTimersByTimeAsync(9999); expect(done).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(1); await Promise.all([a, b]); expect(done).toHaveBeenCalledTimes(2);
    } finally { vi.useRealTimers(); }
  });
});
