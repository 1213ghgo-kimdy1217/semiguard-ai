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
  upsertUser: vi.fn(),
}));

vi.mock("./_core/sdk", () => ({
  sdk: {
    createSessionToken: vi.fn(),
  },
}));

type Provider = "google" | "naver" | "kakao";

function buildState(provider: Provider) {
  const origin = "http://localhost:3000";
  const nonce = `test-nonce-${provider}`;
  const redirectUri = `${origin}/api/oauth/${provider}/callback`;

  return {
    state: encodeOAuthState({ redirectUri, nonce }),
    cookie: `${OAUTH_STATE_COOKIE}=${nonce}`,
  };
}

async function requestCallback(provider: Provider, state: string, cookie: string) {
  const app = express();
  registerSocialOAuthRoutes(app);
  const server = app.listen(0);

  try {
    const address = server.address() as AddressInfo;
    const response = await fetch(
      `http://127.0.0.1:${address.port}/api/oauth/${provider}/callback?code=test-code&state=${encodeURIComponent(state)}`,
      {
        headers: { cookie },
        redirect: "manual",
      }
    );
    return response;
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
}

describe("social OAuth callbacks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.upsertUser).mockResolvedValue(undefined);
    vi.mocked(sdk.createSessionToken).mockResolvedValue("test-session-token");
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
        `http://localhost:3000/login?oauth_error=${provider}`
      );
    }
  );

  it.each<Provider>(["naver", "kakao"])(
    "creates a session cookie and redirects after %s login",
    async provider => {
      const accessToken = `${provider}-token`;
      vi.mocked(axios.post).mockResolvedValueOnce({ data: { access_token: accessToken } });
      if (provider === "naver") {
        vi.mocked(axios.get).mockResolvedValueOnce({
          data: {
            resultcode: "00",
            message: "success",
            response: {
              id: "naver-user-1",
              nickname: "Naver User",
              name: "Naver User",
              email: "naver@example.com",
            },
          },
        });
      } else {
        vi.mocked(axios.get).mockResolvedValueOnce({
          data: {
            id: 987654,
            kakao_account: {
              email: "kakao@example.com",
              name: "Kakao User",
              profile_nickname: "Kakao User",
            },
          },
        });
      }

      const { state, cookie } = buildState(provider);
      const response = await requestCallback(provider, state, cookie);
      const expectedOpenId = provider === "naver" ? "naver_naver-user-1" : "kakao_987654";

      expect(response.status).toBe(302);
      expect(response.headers.get("location")).toBe("/");
      expect(response.headers.get("set-cookie")).toContain(COOKIE_NAME);
      expect(db.upsertUser).toHaveBeenCalledWith(
        expect.objectContaining({ openId: expectedOpenId, loginMethod: provider })
      );
      expect(sdk.createSessionToken).toHaveBeenCalledWith(
        expectedOpenId,
        expect.objectContaining({ name: expect.any(String) })
      );
    }
  );

  it("creates a session cookie and redirects to the dashboard after Google login", async () => {
    vi.mocked(axios.post).mockResolvedValueOnce({ data: { access_token: "google-token" } });
    vi.mocked(axios.get).mockResolvedValueOnce({
      data: {
        sub: "google-user-1",
        email: "user@example.com",
        name: "Test User",
      },
    });
    const { state, cookie } = buildState("google");

    const response = await requestCallback("google", state, cookie);

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("/");
    expect(response.headers.get("set-cookie")).toContain(COOKIE_NAME);
    expect(db.upsertUser).toHaveBeenCalledWith(
      expect.objectContaining({
        openId: "google_google-user-1",
        loginMethod: "google",
      })
    );
    expect(sdk.createSessionToken).toHaveBeenCalledWith(
      "google_google-user-1",
      expect.objectContaining({ name: "Test User" })
    );
  });
});
