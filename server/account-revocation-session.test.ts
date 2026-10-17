import { beforeEach, describe, expect, it, vi } from "vitest";
import { COOKIE_NAME } from "../shared/const";
import { sdk } from "./_core/sdk";
import * as db from "./db";

vi.mock("./_core/env", () => ({ ENV: { cookieSecret: "synthetic-session-test-secret", appId: "synthetic-app", oAuthServerUrl: "https://example.invalid" } }));
vi.mock("./db", () => ({ isUserRevoked: vi.fn(), getUserByOpenId: vi.fn(), touchUser: vi.fn(), upsertUser: vi.fn() }));
beforeEach(() => vi.resetAllMocks());
const request = (token: string) => ({ headers: { cookie: `${COOKIE_NAME}=${token}` } }) as any;

describe("withdrawn identity authentication", () => {
  it("adds a signed issuance time to new sign-ins and reads it back", async () => {
    const token = await sdk.createSessionToken("local_synthetic", { name: "QA" });
    const result = await sdk.verifySession(token);
    expect(result?.issuedAt).toBeGreaterThan(Math.floor(Date.now() / 1000) - 3);
  });
  it("rejects an otherwise-valid token for a revoked account without OAuth sync or writes", async () => {
    vi.mocked(db.isUserRevoked).mockResolvedValue(true);
    const remote = vi.spyOn(sdk, "getUserInfoWithJwt");
    const token = await sdk.createSessionToken("local_synthetic-deleted", { name: "QA" });
    await expect(sdk.authenticateRequest(request(token))).rejects.toThrow("Account is unavailable");
    expect(remote).not.toHaveBeenCalled(); expect(db.getUserByOpenId).not.toHaveBeenCalled(); expect(db.upsertUser).not.toHaveBeenCalled(); expect(db.touchUser).not.toHaveBeenCalled();
    remote.mockRestore();
  });
  it("fails closed if the revocation store is unavailable", async () => {
    vi.mocked(db.isUserRevoked).mockRejectedValue(new Error("synthetic-unavailable"));
    const token = await sdk.createSessionToken("local_synthetic", { name: "QA" });
    await expect(sdk.authenticateRequest(request(token))).rejects.toThrow("synthetic-unavailable");
    expect(db.getUserByOpenId).not.toHaveBeenCalled();
  });
  it("never recreates a missing local account using an old signed cookie", async () => {
    vi.mocked(db.isUserRevoked).mockResolvedValue(false); vi.mocked(db.getUserByOpenId).mockResolvedValue(undefined);
    const token = await sdk.createSessionToken("local_old-badge", { name: "QA" });
    await expect(sdk.authenticateRequest(request(token))).rejects.toThrow("User not found");
    expect(db.upsertUser).not.toHaveBeenCalled();
  });
  it("touches an existing row rather than using an upsert that could recreate it", async () => {
    vi.mocked(db.isUserRevoked).mockResolvedValue(false);
    vi.mocked(db.getUserByOpenId).mockResolvedValue({ id: 21, openId: "local_synthetic" } as any);
    const token = await sdk.createSessionToken("local_synthetic", { name: "QA" });
    expect((await sdk.authenticateRequest(request(token))).id).toBe(21);
    expect(db.touchUser).toHaveBeenCalledWith(21); expect(db.upsertUser).not.toHaveBeenCalled();
  });
});
