import { OAUTH_STATE_COOKIE, encodeOAuthState } from "@shared/const";

export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

// Start the Manus OAuth login. Call this from an event handler or effect at the
// moment you want to navigate, e.g. `onClick={() => startLogin()}`.
//
// It has SIDE EFFECTS — it mints a one-time nonce, writes the __Host- state
// cookie, and navigates immediately — so the cookie nonce always matches the
// `state` it sends. Do NOT call it during render (no `href={startLogin()}` /
// `loginUrl={...}`): each call overwrites the cookie, so a stray render-phase
// call would desync it from an in-flight login and the callback would reject it
// with "invalid oauth state". It returns void by design, so there is no URL to
// stash across renders.
export const startLogin = () => {
  const oauthPortalUrl = import.meta.env.VITE_OAUTH_PORTAL_URL;
  const appId = import.meta.env.VITE_APP_ID;
  const redirectUri = `${window.location.origin}/api/oauth/callback`;

  const nonce = crypto.randomUUID();
  document.cookie = `${OAUTH_STATE_COOKIE}=${nonce}; Path=/; Max-Age=600; SameSite=None; Secure`;
  const state = encodeOAuthState({ redirectUri, nonce });

  const url = new URL(`${oauthPortalUrl}/app-auth`);
  url.searchParams.set("appId", appId);
  url.searchParams.set("redirectUri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("type", "signIn");

  window.location.href = url.toString();
};

// Social login and account-linking functions
export type SocialAuthMode = "login" | "link";

function startSocialOAuth(provider: "google" | "naver" | "kakao", mode: SocialAuthMode) {
  const clientIds = {
    google: import.meta.env.VITE_GOOGLE_CLIENT_ID,
    naver: import.meta.env.VITE_NAVER_CLIENT_ID,
    kakao: import.meta.env.VITE_KAKAO_CLIENT_ID,
  } as const;
  const authorizationEndpoints = {
    google: "https://accounts.google.com/o/oauth2/v2/auth",
    naver: "https://nid.naver.com/oauth2.0/authorize",
    kakao: "https://kauth.kakao.com/oauth/authorize",
  } as const;
  const redirectUri = `${window.location.origin}/api/oauth/${provider}/callback`;
  const nonce = crypto.randomUUID();
  document.cookie = `${OAUTH_STATE_COOKIE}=${nonce}; Path=/; Max-Age=600; SameSite=None; Secure`;
  const state = encodeOAuthState({ redirectUri, nonce, mode });

  const url = new URL(authorizationEndpoints[provider]);
  url.searchParams.set("client_id", clientIds[provider]);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("state", state);
  if (provider === "google") url.searchParams.set("scope", "openid email profile");

  window.location.href = url.toString();
}

export const startGoogleLogin = () => startSocialOAuth("google", "login");
export const startNaverLogin = () => startSocialOAuth("naver", "login");
export const startKakaoLogin = () => startSocialOAuth("kakao", "login");
export const startGoogleLink = () => startSocialOAuth("google", "link");
export const startNaverLink = () => startSocialOAuth("naver", "link");
export const startKakaoLink = () => startSocialOAuth("kakao", "link");
