import { COOKIE_NAME, ONE_YEAR_MS, OAUTH_STATE_COOKIE } from "@shared/const";
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
  sub: string;
  email: string;
  name: string;
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

function getQueryParam(req: Request, key: string): string | undefined {
  const value = req.query[key];
  return typeof value === "string" ? value : undefined;
}

async function getGoogleUserInfo(accessToken: string): Promise<GoogleUserInfo> {
  const response = await axios.get("https://www.googleapis.com/oauth2/v2/userinfo", {
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
  userInfo: SocialUserInfo
) {
  try {
    // Create or update user in database
    const openId = `${userInfo.provider}_${userInfo.id}`;
    await db.upsertUser({
      openId,
      name: userInfo.name || null,
      email: userInfo.email || null,
      loginMethod: userInfo.provider,
      lastSignedIn: new Date(),
    });

    // Create session token
    const sessionToken = await sdk.createSessionToken(openId, {
      name: userInfo.name || "",
      expiresInMs: ONE_YEAR_MS,
    });

    const cookieOptions = getSessionCookieOptions(req);
    res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

    res.redirect(302, "/");
  } catch (error) {
    console.error("[Social OAuth] Login failed", error);
    res.status(500).json({ error: "Social login failed" });
  }
}

export function registerSocialOAuthRoutes(app: Express) {
  // Google OAuth callback
  app.get("/api/oauth/google/callback", async (req: Request, res: Response) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");

    if (!code) {
      res.status(400).json({ error: "code is required" });
      return;
    }

    try {
      const redirectUri = `${req.protocol}://${req.get("host")}/api/oauth/google/callback`;

      // Exchange code for token
      const tokenResponse = await axios.post<GoogleTokenResponse>(
        "https://oauth2.googleapis.com/token",
        {
          client_id: ENV.googleClientId,
          client_secret: ENV.googleClientSecret,
          code,
          grant_type: "authorization_code",
          redirect_uri: redirectUri,
        }
      );

      // Get user info
      const googleUserInfo = await getGoogleUserInfo(tokenResponse.data.access_token);

      const userInfo: SocialUserInfo = {
        id: googleUserInfo.sub,
        email: googleUserInfo.email,
        name: googleUserInfo.name,
        provider: "google",
      };

      await handleSocialLogin(req, res, userInfo);
    } catch (error) {
      console.error("[Google OAuth] Callback failed", error);
      res.status(500).json({ error: "Google OAuth callback failed" });
    }
  });

  // Naver OAuth callback
  app.get("/api/oauth/naver/callback", async (req: Request, res: Response) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");

    if (!code) {
      res.status(400).json({ error: "code is required" });
      return;
    }

    try {
      const redirectUri = `${req.protocol}://${req.get("host")}/api/oauth/naver/callback`;

      // Exchange code for token
      const tokenResponse = await axios.post<NaverTokenResponse>(
        "https://nid.naver.com/oauth2.0/token",
        null,
        {
          params: {
            grant_type: "authorization_code",
            client_id: ENV.naverClientId,
            client_secret: ENV.naverClientSecret,
            code,
            state,
          },
        }
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

      await handleSocialLogin(req, res, userInfo);
    } catch (error) {
      console.error("[Naver OAuth] Callback failed", error);
      res.status(500).json({ error: "Naver OAuth callback failed" });
    }
  });

  // Kakao OAuth callback
  app.get("/api/oauth/kakao/callback", async (req: Request, res: Response) => {
    const code = getQueryParam(req, "code");

    if (!code) {
      res.status(400).json({ error: "code is required" });
      return;
    }

    try {
      const redirectUri = `${req.protocol}://${req.get("host")}/api/oauth/kakao/callback`;

      // Exchange code for token
      const tokenResponse = await axios.post<KakaoTokenResponse>(
        "https://kauth.kakao.com/oauth/token",
        null,
        {
          params: {
            grant_type: "authorization_code",
            client_id: ENV.kakaoClientId,
            client_secret: ENV.kakaoClientSecret,
            code,
            redirect_uri: redirectUri,
          },
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
        }
      );

      // Get user info
      const kakaoUserInfo = await getKakaoUserInfo(tokenResponse.data.access_token);

      const userInfo: SocialUserInfo = {
        id: String(kakaoUserInfo.id),
        email: kakaoUserInfo.kakao_account.email,
        name: kakaoUserInfo.kakao_account.name || kakaoUserInfo.kakao_account.profile_nickname,
        provider: "kakao",
      };

      await handleSocialLogin(req, res, userInfo);
    } catch (error) {
      console.error("[Kakao OAuth] Callback failed", error);
      res.status(500).json({ error: "Kakao OAuth callback failed" });
    }
  });
}
