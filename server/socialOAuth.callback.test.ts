import express from "express";
import type { AddressInfo } from "node:net";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import axios from "axios";
import { COOKIE_NAME, OAUTH_STATE_COOKIE, encodeOAuthState } from "@shared/const";
import * as db from "./db";
import { registerSocialOAuthRoutes } from "./_core/socialOAuth";
import { sdk } from "./_core/sdk";

vi.mock("axios", () => ({
  default: {
    post: vi.fn(),
    get: vi.fn(),
  },
}));

vi.mock("./db", () => ({
  getSocialAccountLink: vi.fn(),
  getUserById: vi.fn(),
  touchUser: vi.fn(),
  createSocialAccountLink: vi.fn(),
}));

vi.mock("./_core/sdk", () => ({
  sdk: {
    createSessionToken: vi.fn(),
    authenticateRequest: vi.fn(),
  },
}));

type Provider = "google" | "naver" | "kakao";

function buildState(provider: Provider, mode: "login" | "link" = "login") {
  const origin = "http://localhost:3000";
  const nonce = `test-nonce-${provider}-${mode}`;
  const redirectUri = `${origin}/api/oauth/${provider}/callback`;

  return {
    state: encodeOAuthState({ redirectUri, nonce, mode }),
    cookie: `${OAUTH_STATE_COOKIE}=${nonce}`,
  };
}

async function requestCallback(provider: Provider, state: string, cookie: string) {
  const app = express();
  registerSocialOAuthRoutes(app);
  const server = app.listen(0);

  try {
    const address = server.address() as AddressInfo;
    return await fetch(
      `http://127.0.0.1:${address.port}/api/oauth/${provider}/callback?code=test-code&state=${encodeURIComponent(state)}`,
      {
        headers: { cookie },
        redirect: "manual",
      },
    );
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
}

function mockProviderResponse(provider: Provider) {
  const accessToken = `${provider}-token`;
  vi.mocked(axios.post).mockResolvedValueOnce({ data: { access_token: accessToken } });
  if (provider === "google") {
    vi.mocked(axios.get).mockResolvedValueOnce({
      data: { sub: "google-user-1", email: "google@example.com", name: "Google User" },
    });
  } else if (provider === "naver") {
    vi.mocked(axios.get).mockResolvedValueOnce({
      data: {
        resultcode: "00",
        message: "success",
        response: { id: "naver-user-1", nickname: "Naver User", name: "Naver User", email: "naver@example.com" },
      },
    });
  } else {
    vi.mocked(axios.get).mockResolvedValueOnce({
      data: { id: 987654, kakao_account: { email: "kakao@example.com", name: "Kakao User", profile_nickname: "Kakao User" } },
    });
  }
}

function providerUserId(provider: Provider) {
  return provider === "google" ? "google-user-1" : provider === "naver" ? "naver-user-1" : "987654";
}

describe("social OAuth callbacks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.getSocialAccountLink).mockResolvedValue(undefined);
    vi.mocked(db.getUserById).mockResolvedValue({
      id: 42,
      openId: "local_EMP-42",
      name: "Local User",
    } as any);
    vi.mocked(db.touchUser).mockResolvedValue(undefined);
    vi.mocked(db.createSocialAccountLink).mockResolvedValue(undefined);
    vi.mocked(sdk.createSessionToken).mockResolvedValue("test-session-token");
    vi.mocked(sdk.authenticateRequest).mockResolvedValue(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each<Provider>(["google", "naver", "kakao"])(
    "%s redirects provider failures back to the login page",
    async provider => {
      vi.mocked(axios.post).mockRejectedValueOnce(new Error("provider token failure"));
      const { state, cookie } = buildState(provider);

      const response = await requestCallback(provider, state, cookie);

      expect(response.status).toBe(302);
      expect(response.headers.get("location")).toBe(
        `http://localhost:3000/login?oauth_error=${provider}_failed`,
      );
    },
  );

  it.each<Provider>(["google", "naver", "kakao"])(
    "does not auto-create an account when %s is not linked",
    async provider => {
      mockProviderResponse(provider);
      const { state, cookie } = buildState(provider, "login");

      const response = await requestCallback(provider, state, cookie);

      expect(response.status).toBe(302);
      expect(response.headers.get("location")).toBe(
        `http://localhost:3000/login?oauth_error=${provider}_unlinked`,
      );
      expect(response.headers.get("set-cookie")).toBeNull();
      expect(sdk.createSessionToken).not.toHaveBeenCalled();
      expect(db.createSocialAccountLink).not.toHaveBeenCalled();
    },
  );

  it.each<Provider>(["google", "naver", "kakao"])(
    "logs the existing local user in after %s is linked",
    async provider => {
      mockProviderResponse(provider);
      vi.mocked(db.getSocialAccountLink).mockResolvedValue({
        userId: 42,
        provider,
        providerUserId: providerUserId(provider),
      } as any);
      const { state, cookie } = buildState(provider, "login");

      const response = await requestCallback(provider, state, cookie);

      expect(response.status).toBe(302);
      expect(response.headers.get("location")).toBe("http://localhost:3000/");
      expect(response.headers.get("set-cookie")).toContain(COOKIE_NAME);
      expect(db.getUserById).toHaveBeenCalledWith(42);
      expect(db.touchUser).toHaveBeenCalledWith(42);
      expect(sdk.createSessionToken).toHaveBeenCalledWith(
        "local_EMP-42",
        expect.objectContaining({ name: "Local User" }),
      );
    },
  );

  it.each<Provider>(["google", "naver", "kakao"])(
    "links %s to the authenticated local user without replacing the session",
    async provider => {
      mockProviderResponse(provider);
      vi.mocked(sdk.authenticateRequest).mockResolvedValue({ id: 42, openId: "local_EMP-42", name: "Local User" } as any);
      const { state, cookie } = buildState(provider, "link");

      const response = await requestCallback(provider, state, cookie);

      expect(response.status).toBe(302);
      expect(response.headers.get("location")).toBe(`http://localhost:3000/?social_linked=${provider}`);
      expect(response.headers.get("set-cookie")).toBeNull();
      expect(db.createSocialAccountLink).toHaveBeenCalledWith({
        userId: 42,
        provider,
        providerUserId: providerUserId(provider),
        email: expect.any(String),
      });
      expect(sdk.createSessionToken).not.toHaveBeenCalled();
    },
  );

  it("rejects linking a provider that belongs to another local user", async () => {
    mockProviderResponse("google");
    vi.mocked(sdk.authenticateRequest).mockResolvedValue({ id: 42, openId: "local_EMP-42", name: "Local User" } as any);
    vi.mocked(db.getSocialAccountLink).mockResolvedValue({
      userId: 99,
      provider: "google",
      providerUserId: "google-user-1",
    } as any);
    const { state, cookie } = buildState("google", "link");

    const response = await requestCallback("google", state, cookie);

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("http://localhost:3000/login?oauth_error=google_already_linked");
    expect(db.createSocialAccountLink).not.toHaveBeenCalled();
  });
});
