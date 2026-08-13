import { COOKIE_NAME, ONE_YEAR_MS, OAUTH_STATE_COOKIE, decodeOAuthState } from "@shared/const";
import { parse as parseCookieHeader } from "cookie";
import type { Express, Request, Response } from "express";
import axios from "axios";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";
import { ENV } from "./env";

interface SocialUserInfo {
  id: string;
  email?: string;
  name?: string;
  provider: "google" | "naver" | "kakao";
}

interface GoogleTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  id_token?: string;
}

interface GoogleUserInfo {
  // The v2 userinfo endpoint returns `id`; OpenID Connect responses may expose `sub`.
  id?: string;
  sub?: string;
  email?: string;
  name?: string;
  picture?: string;
}

interface NaverTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
}

interface NaverUserInfo {
  resultcode: string;
  message: string;
  response: {
    id: string;
    nickname: string;
    name: string;
    email: string;
    profile_image?: string;
  };
}

interface KakaoTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  refresh_token_expires_in?: number;
}

interface KakaoUserInfo {
  id: number;
  kakao_account: {
    profile_nickname?: string;
    email?: string;
    name?: string;
  };
}

type SocialOAuthErrorReason = "unlinked" | "link_required" | "already_linked" | "failed";

class SocialOAuthPolicyError extends Error {
  constructor(public readonly reason: Exclude<SocialOAuthErrorReason, "failed">) {
    super(reason);
    this.name = "SocialOAuthPolicyError";
  }
}

function getQueryParam(req: Request, key: string): string | undefined {
  const value = req.query[key];
  return typeof value === "string" ? value : undefined;
}

function getOAuthRedirectUri(req: Request, state: string | undefined, provider: SocialUserInfo["provider"]): string {
  if (!state) throw new Error("OAuth state is missing");

  const decoded = decodeOAuthState(state);
  const expectedNonce = parseCookieHeader(req.headers.cookie ?? "")[OAUTH_STATE_COOKIE];
  if (!decoded.nonce || !expectedNonce || decoded.nonce !== expectedNonce) {
    throw new Error("OAuth state validation failed");
  }

  const redirectUri = new URL(decoded.redirectUri);
  const expectedPath = `/api/oauth/${provider}/callback`;
  if (!['http:', 'https:'].includes(redirectUri.protocol) || redirectUri.pathname !== expectedPath || redirectUri.search) {
    throw new Error("OAuth redirect URI is invalid");
  }

  return redirectUri.toString();
}

function redirectToSocialLoginError(
  res: Response,
  redirectUri: string,
  provider: SocialUserInfo["provider"],
  reason: SocialOAuthErrorReason = "failed",
) {
  try {
    const origin = new URL(redirectUri).origin;
    const params = new URLSearchParams({ oauth_error: `${provider}_${reason}` });
    res.redirect(302, `${origin}/login?${params.toString()}`);
  } catch {
    res.status(500).json({ error: `${provider} OAuth callback failed` });
  }
}

function getSocialOAuthErrorReason(error: unknown): SocialOAuthErrorReason {
  return error instanceof SocialOAuthPolicyError ? error.reason : "failed";
}

async function getGoogleUserInfo(accessToken: string): Promise<GoogleUserInfo> {
  const response = await axios.get("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return response.data;
}

async function getNaverUserInfo(accessToken: string): Promise<NaverUserInfo> {
  const response = await axios.get("https://openapi.naver.com/v1/nid/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return response.data;
}

async function getKakaoUserInfo(accessToken: string): Promise<KakaoUserInfo> {
  const response = await axios.get("https://kapi.kakao.com/v2/user/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return response.data;
}

async function handleSocialLogin(
  req: Request,
  res: Response,
  userInfo: SocialUserInfo,
  redirectUri: string,
  mode: "login" | "link",
) {
  const providerLink = await db.getSocialAccountLink(userInfo.provider, userInfo.id);

  if (mode === "link") {
    let currentUser;
    try {
      currentUser = await sdk.authenticateRequest(req);
    } catch {
      currentUser = null;
    }

    if (!currentUser) {
      throw new SocialOAuthPolicyError("link_required");
    }
    if (providerLink && providerLink.userId !== currentUser.id) {
      throw new SocialOAuthPolicyError("already_linked");
    }
    if (!providerLink) {
      await db.createSocialAccountLink({
        userId: currentUser.id,
        provider: userInfo.provider,
        providerUserId: userInfo.id,
        email: userInfo.email ?? null,
      });
    }

    const origin = new URL(redirectUri).origin;
    console.info("[Social OAuth] Account linked", {
      provider: userInfo.provider,
      hasProviderId: Boolean(userInfo.id),
      redirect: "/?social_linked=true",
    });
    res.redirect(302, `${origin}/?social_linked=${userInfo.provider}`);
    return;
  }

  if (!providerLink) {
    throw new SocialOAuthPolicyError("unlinked");
  }

  const user = await db.getUserById(providerLink.userId);
  if (!user) {
    throw new Error("Linked local user was not found");
  }
  await db.touchUser(user.id);

  const sessionToken = await sdk.createSessionToken(user.openId, {
    name: user.name ?? "",
    expiresInMs: ONE_YEAR_MS,
  });
  const cookieOptions = getSessionCookieOptions(req);
  res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
  console.info("[Social OAuth] Session established", {
    provider: userInfo.provider,
    hasProviderId: Boolean(userInfo.id),
    redirect: "/",
    cookieSecure: cookieOptions.secure,
    cookieSameSite: cookieOptions.sameSite,
  });

  const origin = new URL(redirectUri).origin;
  res.redirect(302, `${origin}/`);
}

export function registerSocialOAuthRoutes(app: Express) {
  // Google OAuth callback
  app.get("/api/oauth/google/callback", async (req: Request, res: Response) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");
    let redirectUri = "";

    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }

    try {
      redirectUri = getOAuthRedirectUri(req, state, "google");

      // Exchange code for token
      const googleTokenBody = new URLSearchParams({
        client_id: ENV.googleClientId,
        client_secret: ENV.googleClientSecret,
        code,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
      });
      const tokenResponse = await axios.post<GoogleTokenResponse>(
        "https://oauth2.googleapis.com/token",
        googleTokenBody,
        { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
      );

      // Get user info
      const googleUserInfo = await getGoogleUserInfo(tokenResponse.data.access_token);

      const googleId = googleUserInfo.sub || googleUserInfo.id;
      if (!googleId) {
        throw new Error("Google user identifier is missing");
      }

      const userInfo: SocialUserInfo = {
        id: googleId,
        email: googleUserInfo.email,
        name: googleUserInfo.name,
        provider: "google",
      };

      const mode = decodeOAuthState(state).mode ?? "login";
      await handleSocialLogin(req, res, userInfo, redirectUri, mode);
    } catch (error) {
      console.error("[Google OAuth] Callback failed", error);
      redirectToSocialLoginError(res, redirectUri, "google", getSocialOAuthErrorReason(error));
    }
  });

  // Naver OAuth callback
  app.get("/api/oauth/naver/callback", async (req: Request, res: Response) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");
    let redirectUri = "";

    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }

    try {
      redirectUri = getOAuthRedirectUri(req, state, "naver");

      // Exchange code for token
      const naverTokenBody = new URLSearchParams({
        grant_type: "authorization_code",
        client_id: ENV.naverClientId,
        client_secret: ENV.naverClientSecret,
        code,
        state,
      });
      const tokenResponse = await axios.post<NaverTokenResponse>(
        "https://nid.naver.com/oauth2.0/token",
        naverTokenBody,
        { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
      );

      // Get user info
      const naverUserInfo = await getNaverUserInfo(tokenResponse.data.access_token);

      if (naverUserInfo.resultcode !== "00") {
        throw new Error("Failed to get Naver user info");
      }

      const userInfo: SocialUserInfo = {
        id: naverUserInfo.response.id,
        email: naverUserInfo.response.email,
        name: naverUserInfo.response.name || naverUserInfo.response.nickname,
        provider: "naver",
      };

      const mode = decodeOAuthState(state).mode ?? "login";
      await handleSocialLogin(req, res, userInfo, redirectUri, mode);
    } catch (error) {
      console.error("[Naver OAuth] Callback failed", error);
      redirectToSocialLoginError(res, redirectUri, "naver", getSocialOAuthErrorReason(error));
    }
  });

  // Kakao OAuth callback
  app.get("/api/oauth/kakao/callback", async (req: Request, res: Response) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");
    let redirectUri = "";

    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }

    try {
      redirectUri = getOAuthRedirectUri(req, state, "kakao");

      // Exchange code for token
      const kakaoTokenBody = new URLSearchParams({
        grant_type: "authorization_code",
        client_id: ENV.kakaoClientId,
        client_secret: ENV.kakaoClientSecret,
        code,
        redirect_uri: redirectUri,
      });
      const tokenResponse = await axios.post<KakaoTokenResponse>(
        "https://kauth.kakao.com/oauth/token",
        kakaoTokenBody,
        { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
      );

      // Get user info
      const kakaoUserInfo = await getKakaoUserInfo(tokenResponse.data.access_token);

      const userInfo: SocialUserInfo = {
        id: String(kakaoUserInfo.id),
        email: kakaoUserInfo.kakao_account.email,
        name: kakaoUserInfo.kakao_account.name || kakaoUserInfo.kakao_account.profile_nickname,
        provider: "kakao",
      };

      const mode = decodeOAuthState(state).mode ?? "login";
      await handleSocialLogin(req, res, userInfo, redirectUri, mode);
    } catch (error) {
      console.error("[Kakao OAuth] Callback failed", error);
      redirectToSocialLoginError(res, redirectUri, "kakao", getSocialOAuthErrorReason(error));
    }
  });
}
