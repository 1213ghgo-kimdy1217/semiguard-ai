import { beforeEach, describe, expect, it, vi } from "vitest";
import { SignJWT } from "jose";
import { COOKIE_NAME } from "../shared/const";
import { sdk } from "./_core/sdk";
import { sessionMatchesUser } from "./accountRecoverySession";
import * as db from "./db";

const SECRET = "synthetic-session-version-test-secret";
vi.mock("./_core/env", () => ({ ENV: { cookieSecret: "synthetic-session-version-test-secret", appId: "synthetic-app", oAuthServerUrl: "https://example.invalid" } }));
vi.mock("./db", () => ({ isUserRevoked: vi.fn(), getUserByOpenId: vi.fn(), touchUser: vi.fn(), upsertUser: vi.fn() }));
const request = (token: string, bearer = false) => ({ headers: bearer ? { authorization: `Bearer ${token}` } : { cookie: `${COOKIE_NAME}=${token}` } }) as any;
const legacyToken = (authVersion?: unknown) => new SignJWT({ openId: "local_synthetic", appId: "synthetic-app", name: "QA", ...(authVersion === undefined ? {} : { authVersion }) })
  .setProtectedHeader({ alg: "HS256", typ: "JWT" }).setIssuedAt().setExpirationTime("1h").sign(new TextEncoder().encode(SECRET));
beforeEach(() => { vi.resetAllMocks(); vi.mocked(db.isUserRevoked).mockResolvedValue(false); });

describe("password recovery session epochs", () => {
  it("keeps a genuine pre-migration cookie usable only while the account is version zero", async () => {
    const token = await legacyToken();
    vi.mocked(db.getUserByOpenId).mockResolvedValue({ id: 21, openId: "local_synthetic", authVersion: 0 } as any);
    expect((await sdk.authenticateRequest(request(token))).id).toBe(21);
    vi.mocked(db.getUserByOpenId).mockResolvedValue({ id: 21, openId: "local_synthetic", authVersion: 1 } as any);
    vi.mocked(db.touchUser).mockClear();
    await expect(sdk.authenticateRequest(request(token))).rejects.toThrow("Session is no longer current");
    expect(db.touchUser).not.toHaveBeenCalled(); expect(db.upsertUser).not.toHaveBeenCalled();
  });
  it.each([false, true])("rejects an old signed session after reset (Bearer=%s), accepts the new epoch", async bearer => {
    const old = await sdk.createSessionToken("local_synthetic", { name: "QA", authVersion: 2 });
    const current = await sdk.createSessionToken("local_synthetic", { name: "QA", authVersion: 3 });
    vi.mocked(db.getUserByOpenId).mockResolvedValue({ id: 21, openId: "local_synthetic", authVersion: 3 } as any);
    await expect(sdk.authenticateRequest(request(old, bearer))).rejects.toThrow("Session is no longer current");
    expect(db.touchUser).not.toHaveBeenCalled();
    expect((await sdk.authenticateRequest(request(current, bearer))).id).toBe(21);
    expect((await sdk.verifySession(current))?.authVersion).toBe(3);
  });
  it.each([-1, 0.1, "1", null, Number.MAX_SAFE_INTEGER + 1])("rejects malformed signed authVersion=%s", async value => {
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(await sdk.verifySession(await legacyToken(value))).toBeNull();
    warning.mockRestore();
  });
  it("never uses changing profile timestamps as a session epoch", () => {
    expect(sessionMatchesUser({}, {})).toBe(true);
    expect(sessionMatchesUser({}, { authVersion: 1 })).toBe(false);
    expect(sessionMatchesUser({ authVersion: 3 }, { authVersion: 3 })).toBe(true);
    expect(sessionMatchesUser({ authVersion: 4 }, { authVersion: 3 })).toBe(false);
  });
});
