import { beforeEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import * as db from "./db";
import { sdk } from "./_core/sdk";

vi.mock("./db", () => ({
  getUserByBadgeNumber: vi.fn(),
  createLocalUser: vi.fn(),
}));

vi.mock("./_core/sdk", () => ({
  sdk: {
    createSessionToken: vi.fn(),
  },
}));

describe("local authentication", () => {
  const res = {
    cookie: vi.fn(),
    clearCookie: vi.fn(),
  };
  const ctx = {
    req: {
      protocol: "https",
      headers: { "x-forwarded-proto": "https" },
    } as any,
    res: res as any,
    user: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.createLocalUser).mockResolvedValue({} as any);
    vi.mocked(sdk.createSessionToken).mockResolvedValue("local-session-token");
  });

  it("stores a salted password hash during signup and creates a session on login", async () => {
    vi.mocked(db.getUserByBadgeNumber).mockResolvedValueOnce(undefined);
    const caller = appRouter.createCaller(ctx);

    await caller.auth.signup({
      badgeNumber: "EMP-TEST-001",
      name: "홍길동",
      dateOfBirth: "2000-01-01",
      password: "correct-password",
    });

    const createdUser = vi.mocked(db.createLocalUser).mock.calls[0]?.[0];
    expect(createdUser?.passwordHash).toMatch(/^scrypt\$[0-9a-f]+\$[0-9a-f]+$/);
    expect(createdUser?.passwordHash).not.toBe("correct-password");

    vi.mocked(db.getUserByBadgeNumber).mockResolvedValueOnce({
      id: 21,
      openId: "local_EMP-TEST-001",
      name: "홍길동",
      email: null,
      loginMethod: "password",
      badgeNumber: "EMP-TEST-001",
      dateOfBirth: new Date("2000-01-01T00:00:00.000Z"),
      passwordHash: createdUser?.passwordHash ?? null,
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    } as any);

    await caller.auth.login({
      badgeNumber: "EMP-TEST-001",
      password: "correct-password",
    });

    expect(sdk.createSessionToken).toHaveBeenCalledWith(
      "local_EMP-TEST-001",
      expect.objectContaining({ name: "홍길동" })
    );
    expect(res.cookie).toHaveBeenCalledWith(
      expect.any(String),
      "local-session-token",
      expect.objectContaining({ httpOnly: true, secure: true, maxAge: expect.any(Number) })
    );
  });

  it("rejects an incorrect password", async () => {
    vi.mocked(db.getUserByBadgeNumber).mockResolvedValue({
      openId: "local_EMP-TEST-002",
      name: "홍길동",
      passwordHash: "scrypt$invalid$not-a-valid-hash",
    } as any);

    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.auth.login({ badgeNumber: "EMP-TEST-002", password: "wrong-password" })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(res.cookie).not.toHaveBeenCalled();
  });
});
