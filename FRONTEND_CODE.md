# SemiGuard AI - Frontend Code

## 프론트엔드 전체 소스 코드

생성일: Fri Aug  7 11:22:44 UTC 2026


---

## 파일: client/src/App.tsx

```
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, useLocation } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Dashboard from "./pages/Dashboard";
import { Login } from "./pages/Login";
import { useAuth } from "./_core/hooks/useAuth";
import { useEffect } from "react";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!loading && !user) {
      setLocation("/login");
    }
  }, [user, loading, setLocation]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 to-slate-800">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return <>{children}</>;
}

function Router() {
  return (
    <Switch>
      <Route path={"/login"} component={Login} />
      <Route path={"/"}>
        <ProtectedRoute>
          <Dashboard />
        </ProtectedRoute>
      </Route>
      <Route path={"/404"} component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
```

---

## 파일: client/src/main.tsx

```
import { trpc } from "@/lib/trpc";
import { COOKIE_NAME, UNAUTHED_ERR_MSG } from '@shared/const';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, TRPCClientError } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import { startLogin } from "./const";
import "./index.css";

const queryClient = new QueryClient();

const redirectToLoginIfUnauthorized = (error: unknown) => {
  if (!(error instanceof TRPCClientError)) return;
  if (typeof window === "undefined") return;

  const isUnauthorized = error.message === UNAUTHED_ERR_MSG;

  if (!isUnauthorized) return;

  startLogin();
};

queryClient.getQueryCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.query.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Query Error]", error);
  }
});

queryClient.getMutationCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.mutation.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Mutation Error]", error);
  }
});

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      transformer: superjson,
      headers() {
        // Preview auto-login fallback: when the browser blocks iframe cookies
        // (Safari ITP / private browsing / WebView), the runtime mirrors the
        // session into sessionStorage so we can forward it as a Bearer token.
        // The regular OAuth cookie flow keeps working and takes priority server-side.
        try {
          const raw = sessionStorage.getItem("manus-cookie");
          if (raw) {
            const prefix = `${COOKIE_NAME}=`;
            const pair = raw.split(";").find(s => s.trim().startsWith(prefix));
            const token = pair?.trim().slice(prefix.length);
            if (token) {
              return { Authorization: `Bearer ${token}` };
            }
          }
        } catch {
          // sessionStorage unavailable
        }
        return {};
      },
      fetch(input, init) {
        return globalThis.fetch(input, {
          ...(init ?? {}),
          credentials: "include",
        });
      },
    }),
  ],
});

createRoot(document.getElementById("root")!).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </trpc.Provider>
);
```

---

## 파일: client/src/const.ts

```
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

// Social login functions
export const startGoogleLogin = () => {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  const redirectUri = `${window.location.origin}/api/oauth/google/callback`;
  const scope = "openid email profile";
  const responseType = "code";

  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", responseType);
  url.searchParams.set("scope", scope);

  window.location.href = url.toString();
};

export const startNaverLogin = () => {
  const clientId = import.meta.env.VITE_NAVER_CLIENT_ID;
  const redirectUri = `${window.location.origin}/api/oauth/naver/callback`;
  const state = crypto.randomUUID();

  const url = new URL("https://nid.naver.com/oauth2.0/authorize");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("state", state);

  window.location.href = url.toString();
};

export const startKakaoLogin = () => {
  const clientId = import.meta.env.VITE_KAKAO_CLIENT_ID;
  const redirectUri = `${window.location.origin}/api/oauth/kakao/callback`;

  const url = new URL("https://kauth.kakao.com/oauth/authorize");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");

  window.location.href = url.toString();
};
```

---

## 파일: client/src/_core/hooks/useAuth.ts

```
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import { TRPCClientError } from "@trpc/client";
import { useCallback, useEffect, useMemo } from "react";

type UseAuthOptions = {
  redirectOnUnauthenticated?: boolean;
  redirectPath?: string;
};

export function useAuth(options?: UseAuthOptions) {
  // Login is started via startLogin() in the effect below, only when we actually
  // navigate — never during render. startLogin() mints a one-time nonce + writes
  // the state cookie, so calling it per render would overwrite the cookie and
  // desync it from an in-flight login's `state`.
  const { redirectOnUnauthenticated = false, redirectPath } = options ?? {};
  const utils = trpc.useUtils();

  const meQuery = trpc.auth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => {
      utils.auth.me.setData(undefined, null);
    },
  });

  const logout = useCallback(async () => {
    try {
      await logoutMutation.mutateAsync();
    } catch (error: unknown) {
      if (
        error instanceof TRPCClientError &&
        error.data?.code === "UNAUTHORIZED"
      ) {
        return;
      }
      throw error;
    } finally {
      // Clear the Preview auto-login token mirrored into sessionStorage, so
      // header-based sessions (Safari ITP / WebView) are logged out too. The
      // backend cookie is cleared by the logout mutation.
      try {
        sessionStorage.removeItem("manus-cookie");
      } catch {}
      utils.auth.me.setData(undefined, null);
      await utils.auth.me.invalidate();
    }
  }, [logoutMutation, utils]);

  const state = useMemo(() => {
    localStorage.setItem(
      "manus-runtime-user-info",
      JSON.stringify(meQuery.data)
    );
    return {
      user: meQuery.data ?? null,
      loading: meQuery.isLoading || logoutMutation.isPending,
      error: meQuery.error ?? logoutMutation.error ?? null,
      isAuthenticated: Boolean(meQuery.data),
    };
  }, [
    meQuery.data,
    meQuery.error,
    meQuery.isLoading,
    logoutMutation.error,
    logoutMutation.isPending,
  ]);

  useEffect(() => {
    if (!redirectOnUnauthenticated) return;
    if (meQuery.isLoading || logoutMutation.isPending) return;
    if (state.user) return;
    if (typeof window === "undefined") return;
    if (redirectPath && window.location.pathname === redirectPath) return;

    // Navigate at this moment only. startLogin() mints the nonce + cookie itself.
    if (redirectPath) {
      window.location.href = redirectPath;
    } else {
      startLogin();
    }
  }, [
    redirectOnUnauthenticated,
    redirectPath,
    logoutMutation.isPending,
    meQuery.isLoading,
    state.user,
  ]);

  return {
    ...state,
    refresh: () => meQuery.refetch(),
    logout,
  };
}
```

---

## 파일: client/src/pages/Login.tsx

```
import { startLogin, startGoogleLogin, startNaverLogin, startKakaoLogin } from "@/const";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export function Login() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-4">
      <Card className="w-full max-w-md p-8 bg-slate-800 border-slate-700">
        <div className="space-y-6">
          {/* Header */}
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold text-white">SemiGuard AI</h1>
            <p className="text-slate-300">반도체 장비 예지안전 시스템</p>
          </div>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-600"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-slate-800 text-slate-400">로그인</span>
            </div>
          </div>

          {/* Social Login Buttons */}
          <div className="space-y-3">
            {/* Google Login */}
            <Button
              onClick={() => startGoogleLogin()}
              className="w-full bg-white hover:bg-slate-100 text-slate-900 font-semibold py-2 h-auto"
            >
              <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Google로 로그인
            </Button>

            {/* Naver Login */}
            <Button
              onClick={() => startNaverLogin()}
              className="w-full bg-[#00C73C] hover:bg-[#00B833] text-white font-semibold py-2 h-auto"
            >
              <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.37 0 0 5.37 0 12s5.37 12 12 12 12-5.37 12-12S18.63 0 12 0zm0 22c-5.52 0-10-4.48-10-10S6.48 2 12 2s10 4.48 10 10-4.48 10-10 10z" />
                <path d="M12 4c-4.42 0-8 3.58-8 8s3.58 8 8 8 8-3.58 8-8-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6s2.69-6 6-6 6 2.69 6 6-2.69 6-6 6z" />
              </svg>
              Naver로 로그인
            </Button>

            {/* Kakao Login */}
            <Button
              onClick={() => startKakaoLogin()}
              className="w-full bg-[#FFE812] hover:bg-[#F0D800] text-slate-900 font-semibold py-2 h-auto"
            >
              <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 5.58 2 10c0 2.54 1.19 4.85 3.1 6.4.38.34.6.84.5 1.32-.08.37-.31.68-.62.85-.31.17-.68.17-.99 0-.76-.42-1.44-.95-2.03-1.56C2.46 14.76 1 12.54 1 10c0-5.52 4.48-10 10-10s10 4.48 10 10-4.48 10-10 10c-.55 0-1 .45-1 1s.45 1 1 1c5.52 0 10-4.48 10-10S17.52 2 12 2z" />
              </svg>
              Kakao로 로그인
            </Button>

            {/* Manus Login */}
            <Button
              onClick={() => startLogin()}
              variant="outline"
              className="w-full border-slate-600 text-slate-300 hover:bg-slate-700 font-semibold py-2 h-auto"
            >
              Manus로 로그인
            </Button>
          </div>

          {/* Footer */}
          <p className="text-center text-sm text-slate-400">
            로그인하면 서비스 이용약관에 동의하는 것입니다.
          </p>
        </div>
      </Card>
    </div>
  );
}
```

---

## 파일: client/src/pages/Dashboard.tsx

```
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useIsMobile } from "@/hooks/useMobile";
import { trpc } from "@/lib/trpc";
import { translations, type Lang, type Translation } from "@/lib/i18n";
import type { RiskLevel, SensorData, AnomalyResult, AnomalyLogEntry } from "../../../shared/semiguard";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { toast } from "sonner";

// ─── 위험도 색상 매핑 ────────────────────────────────────────────────────────
// ─── 버튼 스피너 ─────────────────────────────────────────────────────────────
// ─── 미니 스파크라인 ──────────────────────────────────────────────────────────
function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) return null;
  const W = 80, H = 28;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * W;
    const y = H - ((v - min) / range) * (H - 4) - 2;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  const lastPt = pts.split(" ").pop()!;
  const [lx, ly] = lastPt.split(",").map(Number);
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ overflow: "visible" }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5"
        strokeLinecap="round" strokeLinejoin="round" opacity="0.8" />
      <circle cx={lx} cy={ly} r="2.5" fill={color} />
    </svg>
  );
}

// ─── CSV 내보내기 ─────────────────────────────────────────────────────────────
function exportLogsToCSV(logs: AnomalyLogEntry[], lang: Lang) {
  const headers = lang === "ko"
    ? ["발생 시각", "전류(A)", "온도(°C)", "진동(mm/s)", "소음(dB)", "이상 점수", "위험도", "이상 여부"]
    : ["Time", "Current(A)", "Temp(°C)", "Vib(mm/s)", "Noise(dB)", "Score", "Level", "Anomaly"];
  // 쉼표·따옴표·줄바꿈이 포함된 셀을 RFC 4180 방식으로 이스케이프
  const escape = (v: string | number) => {
    const s = String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows = logs.map(log => [
    escape(new Date(log.timestamp).toLocaleString(lang === "ko" ? "ko-KR" : lang === "ja" ? "ja-JP" : "en-US", { hour12: false })),
    escape(log.current.toFixed(2)),
    escape(log.temperature.toFixed(1)),
    escape(log.vibration.toFixed(2)),
    escape(log.noise.toFixed(1)),
    escape(log.anomalyScore),
    escape(log.riskLevel),
    escape(log.isAnomaly ? (lang === "ko" ? "이상" : "Anomaly") : (lang === "ko" ? "정상" : "Normal")),
  ]);
  const csv = [headers.map(h => escape(h)), ...rows].map(r => r.join(",")).join("\n");
  const bom = "\uFEFF";
  const blob = new Blob([bom + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `semiguard_logs_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Web Audio 경고음 ────────────────────────────────────────────────────────
// AudioContext를 모듈 수준에서 지연 생성하여 재사용 (autoplay 정책 대응)
let _audioCtx: AudioContext | null = null;
// 재생 중인 oscillator 추적 (음소거 즉시 중단용)
const _activeOscillators: OscillatorNode[] = [];

function getAudioCtx(): AudioContext | null {
  try {
    if (!_audioCtx || _audioCtx.state === "closed") {
      _audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return _audioCtx;
  } catch (_) { return null; }
}

function playDangerAlertSound(volume = 0.35) {
  try {
    const ctx = getAudioCtx();
    if (!ctx) return;
    // 브라우저 autoplay 정책: suspended 상태이면 resume 후 재생
    const doPlay = () => {
      const beepAt = (startTime: number, freq: number, duration: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = "square";
        osc.frequency.setValueAtTime(freq, startTime);
        gain.gain.setValueAtTime(Math.max(0.001, volume), startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
        osc.start(startTime);
        osc.stop(startTime + duration);
        _activeOscillators.push(osc);
        osc.onended = () => {
          const idx = _activeOscillators.indexOf(osc);
          if (idx !== -1) _activeOscillators.splice(idx, 1);
        };
      };
      const t0 = ctx.currentTime;
      beepAt(t0,        880, 0.18);
      beepAt(t0 + 0.22, 660, 0.18);
      beepAt(t0 + 0.44, 880, 0.18);
      beepAt(t0 + 0.66, 660, 0.28);
    };
    if (ctx.state === "suspended") {
      ctx.resume().then(doPlay).catch(() => {});
    } else {
      doPlay();
    }
  } catch (_) { /* 브라우저 미지원 시 무시 */ }
}

// ─── 카운트업/다운 훅 ────────────────────────────────────────────────────────
function useAnimatedScore(target: number, duration = 400): number {
  const [displayed, setDisplayed] = useState(target);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    const from = displayed;
    if (from === target) return;
    const startTime = performance.now();
    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // easeOutCubic
      setDisplayed(Math.round(from + (target - from) * eased));
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        setDisplayed(target);
        rafRef.current = null;
      }
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => { if (rafRef.current !== null) cancelAnimationFrame(rafRef.current); };
  }, [target]);

  return displayed;
}

function ButtonSpinner({ color }: { color: string }) {
  return (
    <span className="inline-block w-3 h-3 rounded-full border-2 border-transparent"
      style={{
        borderTopColor: color,
        borderRightColor: color,
        animation: "spin 0.6s linear infinite",
        verticalAlign: "middle",
      }} />
  );
}

const RISK_COLORS: Record<RiskLevel, string> = {
  normal: "#22c55e",
  caution: "#eab308",
  warning: "#f97316",
  danger: "#ef4444",
};
const RISK_BG: Record<RiskLevel, string> = {
  normal: "rgba(34,197,94,0.10)",
  caution: "rgba(234,179,8,0.10)",
  warning: "rgba(249,115,22,0.10)",
  danger: "rgba(239,68,68,0.10)",
};
const RISK_BORDER: Record<RiskLevel, string> = {
  normal: "rgba(34,197,94,0.30)",
  caution: "rgba(234,179,8,0.30)",
  warning: "rgba(249,115,22,0.30)",
  danger: "rgba(239,68,68,0.30)",
};

interface ChartPoint extends SensorData { label: string; }
const MAX_CHART_POINTS = 30;

// ─── 센서 카드 ───────────────────────────────────────────────────────────────
function SensorCard({ label, value, unit, color, icon }: {
  label: string; value: number; unit: string; color: string; icon: string;
}) {
  return (
    <div className="rounded-xl p-4 border flex flex-col gap-2 transition-all duration-300"
      style={{ background: "rgba(255,255,255,0.025)", borderColor: `${color}35` }}>
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">{label}</span>
        <span className="text-base opacity-70">{icon}</span>
      </div>
      <div className="flex items-end gap-1.5">
        <span className="text-3xl font-bold font-mono leading-none" style={{ color }}>{value.toFixed(1)}</span>
        <span className="text-xs text-muted-foreground mb-0.5">{unit}</span>
      </div>
    </div>
  );
}

// ─── 위험도 게이지 ───────────────────────────────────────────────────────────
function RiskGauge({ score, riskLevel, t }: { score: number; riskLevel: RiskLevel; t: Translation }) {
  const color = RISK_COLORS[riskLevel];
  const animatedScore = useAnimatedScore(score);
  const circumference = 2 * Math.PI * 48;
  const offset = circumference * (1 - animatedScore / 100);

  return (
    <div className="flex flex-col items-center gap-3 w-full">
      <div className="relative w-40 h-40">
        <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
          <circle cx="60" cy="60" r="48" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
          <circle cx="60" cy="60" r="48" fill="none"
            stroke={color} strokeWidth="8" strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset 0.7s cubic-bezier(0.23,1,0.32,1), stroke 0.4s ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
          <span className="text-4xl font-bold font-mono leading-none" style={{ color, transition: "color 0.4s" }}>{animatedScore}</span>
          <span className="text-[10px] text-muted-foreground tracking-wide">{t.riskScore}</span>
        </div>
      </div>
      <div className="px-5 py-1.5 rounded-full text-sm font-bold tracking-widest border transition-all duration-400"
        style={{ color, background: RISK_BG[riskLevel], borderColor: RISK_BORDER[riskLevel] }}>
        {t[riskLevel]}
      </div>
      {/* 4단계 인디케이터 바 */}
      <div className="flex gap-1.5 w-full px-1">
        {(["normal","caution","warning","danger"] as RiskLevel[]).map(lvl => (
          <div key={lvl} className="flex-1 h-1.5 rounded-full transition-all duration-300"
            style={{ background: riskLevel === lvl ? RISK_COLORS[lvl] : "rgba(255,255,255,0.05)" }} />
        ))}
      </div>
    </div>
  );
}

// ─── Heartbeat 인디케이터 ───────────────────────────────────────────────────

// ─── 카운트업 애니메이션 훅 ──────────────────────────────────────────────────
function useCountUp(target: number, duration = 800) {
  const [display, setDisplay] = useState(target);
  const prevRef = useRef(target);
  const rafRef = useRef<number | null>(null);
  useEffect(() => {
    const from = prevRef.current;
    const to = target;
    if (from === to) return;
    prevRef.current = to;
    const start = performance.now();
    const animate = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(from + (to - from) * eased));
      if (progress < 1) rafRef.current = requestAnimationFrame(animate);
    };
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(animate);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [target, duration]);
  return display;
}

function HeartbeatIndicator({ alive, t }: { alive: boolean; t: Translation }) {
  return (
    <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-semibold"
      style={{ background: alive ? "rgba(34,197,94,0.10)" : "rgba(239,68,68,0.10)" }}>
      <div className="w-2 h-2 rounded-full" style={{
        background: alive ? "#22c55e" : "#ef4444",
        animation: alive ? "pulse 2s infinite" : "none",
      }} />
      <span style={{ color: alive ? "#22c55e" : "#ef4444" }}>
        {alive ? t.heartbeatOk : t.heartbeatFail}
      </span>
    </div>
  );
}

// ─── 경고 패널 ──────────────────────────────────────────────────────────────
function AlertPanel({ riskLevel, relayTripped, t }: { riskLevel: RiskLevel; relayTripped: boolean; t: Translation }) {
  const isDanger = riskLevel === "danger";
  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1.5">
        <div className="w-2.5 h-2.5 rounded-full" style={{
          background: isDanger ? "#ef4444" : "#22c55e",
          animation: isDanger ? "pulse 0.5s infinite" : "none",
        }} />
        <span className="text-xs font-semibold text-muted-foreground">{t.alertLight}</span>
      </div>
      <div className="w-px h-4 bg-border" />
      <div className="flex items-center gap-1.5">
        <span className="text-xs font-semibold" style={{ color: relayTripped ? "#ef4444" : "#22c55e" }}>
          {relayTripped ? t.relayActive : t.relayInactive}
        </span>
      </div>
    </div>
  );
}

// ─── 커스텀 차트 Tooltip ────────────────────────────────────────────────────
function CustomTooltip(props: any) {
  if (!props.active || !props.payload) return null;
  return (
    <div className="bg-black/80 border border-white/20 rounded-lg p-2 text-xs text-white backdrop-blur">
      {props.payload.map((entry: any, i: number) => (
        <div key={i} style={{ color: entry.color }}>
          {entry.name}: {entry.value.toFixed(2)}
        </div>
      ))}
    </div>
  );
}

// ─── 임팩트 통계 카드 ────────────────────────────────────────────────────────
function ImpactCard({ label, value, unit, icon, color }: {
  label: string; value: string | number; unit?: string; icon: string; color: string;
}) {
  return (
    <div className="rounded-xl p-4 border flex flex-col gap-2"
      style={{ background: "rgba(255,255,255,0.025)", borderColor: `${color}35` }}>
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">{label}</span>
        <span className="text-lg">{icon}</span>
      </div>
      <div className="flex items-end gap-1.5">
        <span className="text-2xl font-bold font-mono leading-none" style={{ color }}>
          {typeof value === "number" ? value.toLocaleString() : value}
        </span>
        {unit && <span className="text-xs text-muted-foreground mb-0.5">{unit}</span>}
      </div>
    </div>
  );
}

// ─── 월간 히트맵 캘린더 ──────────────────────────────────────────────────────
const RISK_ORDER: Record<RiskLevel, number> = { normal: 1, caution: 2, warning: 3, danger: 4 };

// ─── 위험도 점수 라인 차트 ────────────────────────────────────────────────────
const RISK_COLOR_MAP: Record<string, string> = {
  normal: "#22c55e", caution: "#eab308", warning: "#f97316", danger: "#ef4444",
};

function ScoreLineChart({
  data,
  lang,
  isDark = true,
}: {
  data: { timestamp: string; score: number; riskLevel: string }[];
  lang: Lang;
  isDark?: boolean;
}) {
  const chartTextColor = isDark ? "oklch(0.45 0.01 240)" : "oklch(0.30 0.01 240)";
  const chartAxisColor = isDark ? "oklch(0.25 0.02 240)" : "oklch(0.75 0.01 240)";
  const chartDotStroke = isDark ? "oklch(0.10 0.01 240)" : "oklch(0.95 0.005 240)";
  const tooltipBg      = isDark ? "oklch(0.15 0.02 240)" : "oklch(0.97 0.005 240)";
  const tooltipBorder  = isDark ? "oklch(0.28 0.03 240)" : "oklch(0.80 0.01 240)";
  const tooltipTime    = isDark ? "oklch(0.55 0.01 240)" : "oklch(0.40 0.01 240)";

  const [tooltip, setTooltip] = useState<{ x: number; y: number; score: number; time: string; risk: string } | null>(null);
  const W = 800, H = 200, PAD = { top: 16, right: 16, bottom: 32, left: 44 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  if (data.length < 2) {
    return (
      <div className="flex items-center justify-center h-[200px] text-xs text-muted-foreground">
        {lang === "ko" ? "데이터가 쌓이면 차트가 표시됩니다." : "Chart will appear as data accumulates."}
      </div>
    );
  }

  const minScore = 0, maxScore = 100;
  const xScale = (i: number) => PAD.left + (i / (data.length - 1)) * innerW;
  const yScale = (v: number) => PAD.top + innerH - ((v - minScore) / (maxScore - minScore)) * innerH;

  // 위험 단계별 배경 밴드
  const bands = [
    { y1: yScale(70), y2: yScale(100), color: "rgba(239,68,68,0.06)" },
    { y1: yScale(50), y2: yScale(70),  color: "rgba(249,115,22,0.06)" },
    { y1: yScale(30), y2: yScale(50),  color: "rgba(234,179,8,0.06)" },
    { y1: yScale(0),  y2: yScale(30),  color: "rgba(34,197,94,0.06)" },
  ];

  // 임계선
  const threshLines = [
    { y: yScale(70), color: "#ef4444", label: "70" },
    { y: yScale(50), color: "#f97316", label: "50" },
    { y: yScale(30), color: "#eab308", label: "30" },
  ];

  // 폴리라인 포인트
  const points = data.map((d, i) => `${xScale(i)},${yScale(d.score)}`).join(" ");

  // X축 레이블 (최대 6개)
  const xLabels: { i: number; label: string }[] = [];
  const step = Math.max(1, Math.floor((data.length - 1) / 5));
  for (let i = 0; i < data.length; i += step) {
    const d = new Date(data[i].timestamp);
    xLabels.push({ i, label: `${d.getHours().toString().padStart(2,"0")}:${d.getMinutes().toString().padStart(2,"0")}` });
  }
  if (xLabels[xLabels.length - 1]?.i !== data.length - 1) {
    const last = data[data.length - 1];
    const d = new Date(last.timestamp);
    xLabels.push({ i: data.length - 1, label: `${d.getHours().toString().padStart(2,"0")}:${d.getMinutes().toString().padStart(2,"0")}` });
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 200 }}>
      {/* 배경 밴드 */}
      {bands.map((b, i) => (
        <rect key={i} x={PAD.left} y={b.y1} width={innerW} height={Math.abs(b.y2 - b.y1)} fill={b.color} />
      ))}
      {/* 임계선 */}
      {threshLines.map(tl => (
        <g key={tl.label}>
          <line x1={PAD.left} y1={tl.y} x2={PAD.left + innerW} y2={tl.y}
            stroke={tl.color} strokeWidth={0.8} strokeDasharray="4 3" opacity={0.6} />
          <text x={PAD.left - 4} y={tl.y + 4} textAnchor="end" fontSize={9} fill={tl.color} opacity={0.8}>{tl.label}</text>
        </g>
      ))}
      {/* Y축 레이블 */}
      {[0, 50, 100].map(v => (
        <text key={v} x={PAD.left - 4} y={yScale(v) + 4} textAnchor="end" fontSize={9} fill={chartTextColor}>{v}</text>
      ))}
      {/* 라인 */}
      <polyline points={points} fill="none" stroke="oklch(0.65 0.18 200)" strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round" />
      {/* 점 */}
      {data.map((d, i) => (
        <circle key={i} cx={xScale(i)} cy={yScale(d.score)} r={3}
          fill={RISK_COLOR_MAP[d.riskLevel] ?? "#38bdf8"}
          stroke={chartDotStroke} strokeWidth={1}
          style={{ cursor: "crosshair" }}
          onMouseEnter={() => {
            const d2 = new Date(d.timestamp);
            setTooltip({
              x: xScale(i),
              y: yScale(d.score),
              score: d.score,
              time: `${d2.getHours().toString().padStart(2,"0")}:${d2.getMinutes().toString().padStart(2,"0")}:${d2.getSeconds().toString().padStart(2,"0")}`,
              risk: d.riskLevel,
            });
          }}
          onMouseLeave={() => setTooltip(null)}
        />
      ))}
      {/* X축 레이블 */}
      {xLabels.map(xl => (
        <text key={xl.i} x={xScale(xl.i)} y={H - 4} textAnchor="middle" fontSize={9} fill={chartTextColor}>{xl.label}</text>
      ))}
      {/* X축 선 */}
      <line x1={PAD.left} y1={PAD.top + innerH} x2={PAD.left + innerW} y2={PAD.top + innerH} stroke={chartAxisColor} strokeWidth={1} />
      {/* 툴팁 */}
      {tooltip && (() => {
        const TW = 110, TH = 44;
        const tx = tooltip.x + TW + 8 > W ? tooltip.x - TW - 8 : tooltip.x + 8;
        const ty = tooltip.y - TH / 2 < PAD.top ? PAD.top : tooltip.y + TH / 2 > H - PAD.bottom ? H - PAD.bottom - TH : tooltip.y - TH / 2;
        const riskColor = RISK_COLOR_MAP[tooltip.risk] ?? "#38bdf8";
        return (
          <g style={{ pointerEvents: "none" }}>
            <rect x={tx} y={ty} width={TW} height={TH} rx={6} fill={tooltipBg} stroke={tooltipBorder} strokeWidth={1} />
            <text x={tx + 8} y={ty + 15} fontSize={10} fill={riskColor} fontWeight="600">{`${lang === "ko" ? "점수" : "Score"}: ${tooltip.score}`}</text>
            <text x={tx + 8} y={ty + 30} fontSize={9} fill={tooltipTime}>{tooltip.time}</text>
            <text x={tx + 8} y={ty + 42} fontSize={9} fill={riskColor} opacity={0.8}>{
              lang === "ko"
                ? tooltip.risk === "danger" ? "위험" : tooltip.risk === "warning" ? "경고" : tooltip.risk === "caution" ? "주의" : "정상"
                : tooltip.risk.charAt(0).toUpperCase() + tooltip.risk.slice(1)
            }</text>
          </g>
        );
      })()}
    </svg>
  );
}

function MonthlyHeatmap({
  dailyData,
  lang,
  t,
  onDateClick,
  isDark,
}: {
  dailyData: { date: string; riskLevel: string }[];
  lang: Lang;
  t: import("@/lib/i18n").Translation;
  onDateClick?: (date: string) => void;
  isDark: boolean;
}) {
  const th = {
    bgCard:    isDark ? "oklch(0.13 0.015 240)"  : "oklch(0.99 0.003 240)",
    border:    isDark ? "oklch(0.20 0.02 240)"   : "oklch(0.85 0.01 240)",
    border2:   isDark ? "oklch(0.25 0.02 240)"   : "oklch(0.80 0.01 240)",
    textMuted: isDark ? "oklch(0.50 0.01 240)"   : "oklch(0.45 0.01 240)",
  };
  const [calMonth, setCalMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  // 날짜별 최고 위험도 집계
  const dayMap = useMemo(() => {
    const map: Record<string, RiskLevel> = {};
    for (const row of dailyData) {
      map[row.date] = row.riskLevel as RiskLevel;
    }
    return map;
  }, [dailyData]);

  const year = calMonth.getFullYear();
  const month = calMonth.getMonth();
  const firstDow = new Date(year, month, 1).getDay(); // 0=일
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayStr = (() => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
  })();

  const CELL_COLOR: Record<RiskLevel, string> = {
    normal:  "rgba(34,197,94,0.55)",
    caution: "rgba(234,179,8,0.65)",
    warning: "rgba(249,115,22,0.70)",
    danger:  "rgba(239,68,68,0.80)",
  };
  const CELL_BORDER: Record<RiskLevel, string> = {
    normal:  "rgba(34,197,94,0.80)",
    caution: "rgba(234,179,8,0.90)",
    warning: "rgba(249,115,22,0.90)",
    danger:  "rgba(239,68,68,1.00)",
  };

  const weekDays = lang === "ko"
    ? ["일", "월", "화", "수", "목", "금", "토"]
    : ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

  const monthLabel = calMonth.toLocaleDateString(lang === "ko" ? "ko-KR" : lang === "ja" ? "ja-JP" : "en-US", { year: "numeric", month: "long" });

  // 범례 항목
  const legend: { level: RiskLevel; label: string }[] = [
    { level: "normal",  label: lang === "ko" ? "정상" : "Normal" },
    { level: "caution", label: lang === "ko" ? "주의" : "Caution" },
    { level: "warning", label: lang === "ko" ? "경고" : "Warning" },
    { level: "danger",  label: lang === "ko" ? "위험" : "Danger" },
  ];

  return (
    <div className="rounded-xl border p-5" style={{ background: th.bgCard, borderColor: th.border }}>
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
          {lang === "ko" ? "월간 위험도 히트맵" : "Monthly Risk Heatmap"}
        </p>
        <div className="flex items-center gap-2">
          <button onClick={() => setCalMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
            className="w-6 h-6 flex items-center justify-center rounded text-xs border transition-all hover:opacity-80 active:scale-95"
            style={{ borderColor: th.border2, color: th.textMuted }}>‹</button>
          <span className="text-xs font-semibold min-w-[90px] text-center">{monthLabel}</span>
          <button onClick={() => setCalMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
            className="w-6 h-6 flex items-center justify-center rounded text-xs border transition-all hover:opacity-80 active:scale-95"
            style={{ borderColor: th.border2, color: th.textMuted }}>›</button>
        </div>
      </div>

      {/* 요일 헤더 */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {weekDays.map(d => (
          <div key={d} className="text-center text-[9px] font-semibold text-muted-foreground py-0.5">{d}</div>
        ))}
      </div>

      {/* 날짜 셀 */}
      <div className="grid grid-cols-7 gap-1">
        {/* 첫 주 빈 칸 */}
        {Array.from({ length: firstDow }).map((_, i) => <div key={`empty-${i}`} />)}
        {/* 날짜 */}
        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
          const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const lvl = dayMap[key];
          const isToday = key === todayStr;
          return (
            <div key={day}
              title={lvl ? `${key}: ${lang === "ko" ? { normal: "정상", caution: "주의", warning: "경고", danger: "위험" }[lvl] : lvl}` : key}
              onClick={() => onDateClick?.(key)}
              className="aspect-square flex items-center justify-center rounded text-[10px] font-mono transition-all duration-200 select-none"
              style={{
                cursor: onDateClick ? "pointer" : "default",
                background: lvl ? CELL_COLOR[lvl] : (isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)"),
                border: isToday
                  ? "1.5px solid oklch(0.65 0.18 200)"
                  : lvl ? `1px solid ${CELL_BORDER[lvl]}` : `1px solid ${isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.10)"}`,
                color: lvl ? (isDark ? "#fff" : "#111") : (isDark ? "oklch(0.45 0.01 240)" : "oklch(0.30 0.01 240)"),
                fontWeight: isToday ? 700 : 400,
              }}>
              {day}
            </div>
          );
        })}
      </div>

      {/* 범례 */}
      <div className="flex items-center gap-3 mt-4 flex-wrap">
        <span className="text-[9px] text-muted-foreground">{lang === "ko" ? "범례:" : "Legend:"}</span>
        {legend.map(({ level, label }) => (
          <div key={level} className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-sm" style={{ background: CELL_COLOR[level], border: `1px solid ${CELL_BORDER[level]}` }} />
            <span className="text-[9px] text-muted-foreground">{label}</span>
          </div>
        ))}
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-sm" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }} />
          <span className="text-[9px] text-muted-foreground">{lang === "ko" ? "데이터 없음" : "No data"}</span>
        </div>
      </div>
    </div>
  );
}

// ─── 메인 대시보드 ───────────────────────────────────────────────────────────
function DashboardContent() {
  const [lang, setLang] = useState<Lang>("ko");
  const t = translations[lang] as Translation;
  const [isDark, setIsDark] = useState<boolean>(() => {
    try { return localStorage.getItem("semiguard_theme") !== "light"; } catch { return true; }
  });
  const isMobile = useIsMobile();
  // ─── 테마 색상 팔레트 ─────────────────────────────────────────────────────
  const th = {
    bg:        isDark ? "oklch(0.10 0.01 240)"   : "oklch(0.97 0.005 240)",
    bgCard:    isDark ? "oklch(0.13 0.015 240)"  : "oklch(0.99 0.003 240)",
    bgCard2:   isDark ? "oklch(0.115 0.015 240)" : "oklch(0.96 0.005 240)",
    border:    isDark ? "oklch(0.20 0.02 240)"   : "oklch(0.85 0.01 240)",
    border2:   isDark ? "oklch(0.25 0.02 240)"   : "oklch(0.80 0.01 240)",
    text:      isDark ? "oklch(0.90 0.01 240)"   : "oklch(0.15 0.01 240)",
    textMuted: isDark ? "oklch(0.50 0.01 240)"   : "oklch(0.45 0.01 240)",
    accent:    "oklch(0.65 0.18 200)",
    header:    isDark ? "oklch(0.115 0.015 240)" : "oklch(0.98 0.005 240)",
  };

  // ─── 위험도 임계값 state (클라이언트 전용) ───────────────────────────────────
  const [thresholds, setThresholds] = useState({ normal: 29, caution: 49, warning: 69 });
  const saveThresholdsMutation = trpc.semiguard.saveThresholds.useMutation();
  const getThresholdsQuery = trpc.semiguard.getThresholds.useQuery(undefined, { staleTime: Infinity });

  // DB에서 임계값 불러오기 (초기 1회)
  useEffect(() => {
    if (getThresholdsQuery.data) {
      setThresholds(getThresholdsQuery.data);
    }
  }, [getThresholdsQuery.data]);
  const [showThresholdPanel, setShowThresholdPanel] = useState(false);

  // 임계값 기반 riskLevel 판정 함수 (클라이언트 로컬 analyzeData에 사용)
  const getLocalRiskLevel = useCallback((score: number): RiskLevel => {
    if (score <= thresholds.normal) return "normal";
    if (score <= thresholds.caution) return "caution";
    if (score <= thresholds.warning) return "warning";
    return "danger";
  }, [thresholds]);

  // ─── 히트맵 날짜 클릭 → 로그 탭 날짜 필터 state ──────────────────────────────
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [dateStart, setDateStart] = useState<string>("");
  const [dateEnd, setDateEnd] = useState<string>("");

  const [chartData, setChartData] = useState<ChartPoint[]>([]);
  const [current, setCurrent] = useState<AnomalyResult | null>(null);
  const [heartbeatAlive, setHeartbeatAlive] = useState(true);
  const lastUpdateRef = useRef<number>(Date.now());
  const [relayTripped, setRelayTripped] = useState(false);
  const [activeTab, setActiveTab] = useState<"dashboard" | "log">("dashboard");
  const [initialized, setInitialized] = useState(false);
  const [showLanding, setShowLanding] = useState(true);
  const autoPollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [dangerAlert, setDangerAlert] = useState(false);
  const [muted, setMuted] = useState<boolean>(false);
  const mutedRef = useRef<boolean>(false);
  // localStorage에서 초기값 복원
  useEffect(() => {
    try {
      const savedMuted = localStorage.getItem("semiguard_muted") === "true";
      const savedVolume = parseFloat(localStorage.getItem("semiguard_volume") ?? "0.35");
      setMuted(savedMuted);
      mutedRef.current = savedMuted;
      const vol = isNaN(savedVolume) ? 0.35 : Math.min(1, Math.max(0, savedVolume));
      setVolume(vol);
      volumeRef.current = vol;
    } catch { /* localStorage 미지원 환경 무시 */ }
  }, []);
  const [volume, setVolume] = useState<number>(0.35);
  const volumeRef = useRef<number>(0.35);
  const [dangerFlash, setDangerFlash] = useState(false);
  const [newLogCount, setNewLogCount] = useState(0);
  const prevLogCountRef = useRef(0);
  const [selectedLog, setSelectedLog] = useState<import("../../../shared/semiguard").AnomalyLogEntry | null>(null);
  const [logPage, setLogPage] = useState(1);
  const LOG_PAGE_SIZE = 10;
  const [scoreHistory, setScoreHistory] = useState<number[]>([10]);
  const [logFilter, setLogFilter] = useState<RiskLevel | "all">("all");
  const [llmAnalysis, setLlmAnalysis] = useState<{
    primaryCause: string;
    details: string;
    recommendation: string;
    score: number;
    riskLevel: string;
  } | null>(null);
  const [llmLoading, setLlmLoading] = useState(false);
  const [showAiHistory, setShowAiHistory] = useState(false);
  const llmHistoryQuery = trpc.semiguard.getLlmHistory.useQuery(undefined, { refetchInterval: 10000 });

  // ─── 경고음 콜백 ─────────────────────────────────────────────────────────
  const playAlert = useCallback(() => {
    if (!mutedRef.current) playDangerAlertSound(volumeRef.current);
  }, []); // mutedRef는 ref이므로 deps 불필요 — 항상 최신 muted 값 참조

  // 음소거 토글 시 재생 중인 소리 즉시 중단
  useEffect(() => {
    if (muted) {
      _activeOscillators.forEach(osc => { try { osc.stop(); } catch (_) {} });
      _activeOscillators.length = 0;
    }
  }, [muted]);


  const injectNormal = trpc.semiguard.injectNormal.useMutation();
  const injectAnomaly = trpc.semiguard.injectAnomaly.useMutation();
  const clearLogs = trpc.semiguard.clearLogs.useMutation();
  const trackVisit = trpc.semiguard.trackVisit.useMutation();
  const injectCaution = trpc.semiguard.injectCaution.useMutation();
  const injectWarning = trpc.semiguard.injectWarning.useMutation();
  const autoFetch = trpc.semiguard.autoFetch.useMutation();
  const resetCostMutation = trpc.semiguard.resetSavedCost.useMutation();
  const analyzeAnomalyMutation = trpc.semiguard.analyzeAnomaly.useMutation();
  const getStats = trpc.semiguard.getStats.useQuery(undefined, { refetchInterval: 5000 });
  const getLogs = trpc.semiguard.getLogs.useQuery({ limit: 200 }, { refetchInterval: 5000 });
  const getDailyMaxRisk = trpc.semiguard.getDailyMaxRisk.useQuery(undefined, { refetchInterval: 10000 });
  const utils = trpc.useUtils();
  const getRecentScoresQuery = trpc.semiguard.getRecentScores.useQuery({ limit: 50 }, { refetchInterval: 5000 });
  const { data: logsData, isLoading: logsLoading } = getLogs;

  const [lastInjectedMode, setLastInjectedMode] = useState<RiskLevel | null>(null);

  // ─── 센서별 임계값 state ─────────────────────────────────────────────────────
  const [sensorThresh, setSensorThresh] = useState({
    currentCaution: 7.0, currentWarning: 9.0, currentDanger: 11.0,
    tempCaution: 55.0, tempWarning: 70.0, tempDanger: 85.0,
    vibCaution: 2.3, vibWarning: 2.6, vibDanger: 3.0,
    noiseCaution: 65.0, noiseWarning: 75.0, noiseDanger: 85.0,
  });
  const [showSensorPanel, setShowSensorPanel] = useState(false);

  // ─── 데모 자동 실행 state ────────────────────────────────────────────────────
  const [demoRunning, setDemoRunning] = useState(false);
  const [demoSpeed, setDemoSpeed] = useState(3); // 1~10초
  const [pdfExporting, setPdfExporting] = useState(false);
  const displayedSavedCost = useCountUp(getStats.data?.savedCost ?? 0, 1000);
  const demoIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ─── 센서별 임계값 tRPC 훅 ──────────────────────────────────────────────────
  const getSensorThresholdsQuery = trpc.semiguard.getSensorThresholds.useQuery(undefined, { staleTime: Infinity });
  const saveSensorThresholdsMutation = trpc.semiguard.saveSensorThresholds.useMutation();

  const sensorData = current?.sensorData;
  const anomalyScore = current?.anomalyScore ?? 0;
  const riskLevel = current?.riskLevel ?? "normal";
  const logs = logsData ?? [];
  // 새 기록 배너: logs 개수 증가 감지
  useEffect(() => {
    const prev = prevLogCountRef.current;
    const curr = logs.length;
    if (curr > prev && prev > 0) {
      setNewLogCount(n => n + (curr - prev));
    }
    prevLogCountRef.current = curr;
  }, [logs.length]);
  const filteredLogs = useMemo(
    () => {
      let result = logs;
      if (selectedDate) result = result.filter(l => l.timestamp.slice(0, 10) === selectedDate);
      // 날짜 범위 필터 (dateStart ~ dateEnd)
      if (dateStart) result = result.filter(l => l.timestamp.slice(0, 10) >= dateStart);
      if (dateEnd)   result = result.filter(l => l.timestamp.slice(0, 10) <= dateEnd);
      if (logFilter !== "all") result = result.filter(l => l.riskLevel === logFilter);
      return result;
    },
    [logs, logFilter, selectedDate, dateStart, dateEnd]
  );
  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / LOG_PAGE_SIZE));
  const pagedLogs = useMemo(
    () => filteredLogs.slice((logPage - 1) * LOG_PAGE_SIZE, logPage * LOG_PAGE_SIZE),
    [filteredLogs, logPage]
  );

  // 초기 방문자 추적
  useEffect(() => {
    trackVisit.mutate();
  }, []);

  // DB에서 센서 임계값 불러오기 (초기 1회)
  useEffect(() => {
    if (getSensorThresholdsQuery.data) {
      setSensorThresh(getSensorThresholdsQuery.data);
    }
  }, [getSensorThresholdsQuery.data]);

  // 데모 자동 실행 useEffect
  useEffect(() => {
    if (demoRunning) {
      const modes = ["normal", "caution", "warning", "danger"] as const;
      let step = 0;
      demoIntervalRef.current = setInterval(async () => {
        const mode = modes[step % modes.length];
        step++;
        try {
          let result;
          if (mode === "normal") result = await injectNormal.mutateAsync();
          else if (mode === "caution") result = await injectCaution.mutateAsync();
          else if (mode === "warning") result = await injectWarning.mutateAsync();
          else result = await injectAnomaly.mutateAsync();
          setScoreHistory(prev => [...prev.slice(-19), result.anomalyScore]);
          setCurrent(result);
          setChartData(prev => [...prev, { ...result.sensorData, label: `D${step}` }].slice(-MAX_CHART_POINTS));
          if (result.riskLevel === "danger") {
            setRelayTripped(true);
            setDangerAlert(true);
            setDangerFlash(true);
            setTimeout(() => setDangerFlash(false), 600);
            playAlert();
            setTimeout(() => setRelayTripped(false), 2000);
            triggerLlmAnalysis(result);
          }
          await utils.semiguard.getStats.invalidate();
          await utils.semiguard.getLogs.invalidate();
        } catch (_) {}
      }, demoSpeed * 1000);
    } else {
      if (demoIntervalRef.current) {
        clearInterval(demoIntervalRef.current);
        demoIntervalRef.current = null;
      }
    }
    return () => {
      if (demoIntervalRef.current) {
        clearInterval(demoIntervalRef.current);
        demoIntervalRef.current = null;
      }
    };
  }, [demoRunning, demoSpeed]);

  // 자동 폴링 (4초마다)
  useEffect(() => {
    if (!initialized) {
      const initData = generateInitialData();
      setCurrent(initData);
      setChartData([{ ...initData.sensorData, label: "0s" }]);
      setInitialized(true);
    }

    autoPollingRef.current = setInterval(() => {
      const now = Date.now();
      const elapsed = Math.round((now - lastUpdateRef.current) / 1000);
      // 자동 폴링: 80% 정상, 10% 주의, 10% 경고 (자연스러운 변동)
      const roll = Math.random();
      const newData = roll < 0.80
        ? generateNormalData()
        : roll < 0.90
          ? generateSlightCautionData()
          : generateSlightWarningData();
      const result = analyzeData(newData);
      // 서버 DB에도 저장 (fire-and-forget)
      autoFetch.mutate(undefined, {
        onSuccess: () => {
          utils.semiguard.getLogs.invalidate();
          utils.semiguard.getStats.invalidate();
        }
      });
      setScoreHistory(prev => [...prev.slice(-19), result.anomalyScore]);
      setCurrent(result);
      setChartData(prev => {
        const updated = [...prev, { ...result.sensorData, label: `${elapsed}s` }];
        return updated.slice(-MAX_CHART_POINTS);
      });
      setHeartbeatAlive(true);
      if (result.riskLevel === "danger") {
        setRelayTripped(true);
        setDangerAlert(true);
        setDangerFlash(true);
        setTimeout(() => setDangerFlash(false), 600);
        playAlert();
        setTimeout(() => setRelayTripped(false), 2000);
        triggerLlmAnalysis(result);
      }
    }, 4000);

    return () => {
      if (autoPollingRef.current) clearInterval(autoPollingRef.current);
    };
  }, [initialized]);

  // LLM 이상 원인 분석 트리거 (30초 throttle)
  const lastLlmCallRef = useRef<number>(0);
  const triggerLlmAnalysis = useCallback(async (result: AnomalyResult) => {
    if (!result.sensorData) return;
    // 30초 이내 중복 호출 방지
    const now = Date.now();
    if (now - lastLlmCallRef.current < 30_000) return;
    lastLlmCallRef.current = now;
    setLlmLoading(true);
    try {
      const analysis = await analyzeAnomalyMutation.mutateAsync({
        current: result.sensorData.current,
        temperature: result.sensorData.temperature,
        vibration: result.sensorData.vibration,
        noise: result.sensorData.noise,
        anomalyScore: result.anomalyScore,
        riskLevel: result.riskLevel,
        lang: lang,
      });
      setLlmAnalysis({
        ...analysis,
        score: result.anomalyScore,
        riskLevel: result.riskLevel,
      });
    } catch {
      // 분석 실패 시 무시
    } finally {
      setLlmLoading(false);
    }
  }, [lang, analyzeAnomalyMutation]);

  const handleInjectNormal = async () => {
    try {
      const result = await injectNormal.mutateAsync();
      // ✅ FIXED: 서버 결과(result)를 그대로 신뢰, analyzeData 호출 제거
      setScoreHistory(prev => [...prev.slice(-19), result.anomalyScore]);
      setCurrent(result);
      setChartData(prev => [...prev, { ...result.sensorData, label: `${prev.length}` }].slice(-MAX_CHART_POINTS));
      await utils.semiguard.getStats.invalidate();
      await utils.semiguard.getLogs.invalidate();
      setLastInjectedMode("normal");
      toast.success(`✅ ${t.injectNormal} 완료`);
    } catch (e) {
      toast.error(t.error);
    }
  };

  const handleInjectAnomaly = async () => {
    try {
      const result = await injectAnomaly.mutateAsync();
      // ✅ FIXED: 서버 결과(result)를 그대로 신뢰, analyzeData 호출 제거
      setScoreHistory(prev => [...prev.slice(-19), result.anomalyScore]);
      setCurrent(result);
      setChartData(prev => [...prev, { ...result.sensorData, label: `${prev.length}` }].slice(-MAX_CHART_POINTS));
      await utils.semiguard.getStats.invalidate();
      await utils.semiguard.getLogs.invalidate();
      setLastInjectedMode("danger");
      if (result.riskLevel === "danger") {
        setRelayTripped(true);
        setDangerAlert(true);
        setDangerFlash(true);
        setTimeout(() => setDangerFlash(false), 600);
        playAlert();
        setTimeout(() => setRelayTripped(false), 2000);
        triggerLlmAnalysis(result);
      }
      toast.error(`⚠ ${t.injectAnomaly} 완료`);
    } catch (e) {
      toast.error(t.error);
    }
  };

  const handleInjectCaution = async () => {
    try {
      const result = await injectCaution.mutateAsync();
      // ✅ FIXED: 서버 결과(result)를 그대로 신뢰, analyzeData 호출 제거
      setScoreHistory(prev => [...prev.slice(-19), result.anomalyScore]);
      setCurrent(result);
      setChartData(prev => [...prev, { ...result.sensorData, label: `${prev.length}` }].slice(-MAX_CHART_POINTS));
      await utils.semiguard.getStats.invalidate();
      await utils.semiguard.getLogs.invalidate();
      setLastInjectedMode("caution");
      toast.info(`⚡ ${t.injectCaution} 완료`);
    } catch (e) {
      toast.error(t.error);
    }
  };

  const handleInjectWarning = async () => {
    try {
      const result = await injectWarning.mutateAsync();
      // ✅ FIXED: 서버 결과(result)를 그대로 신뢰, analyzeData 호출 제거
      setScoreHistory(prev => [...prev.slice(-19), result.anomalyScore]);
      setCurrent(result);
      setChartData(prev => [...prev, { ...result.sensorData, label: `${prev.length}` }].slice(-MAX_CHART_POINTS));
      await utils.semiguard.getStats.invalidate();
      await utils.semiguard.getLogs.invalidate();
      setLastInjectedMode("warning");
      if (result.riskLevel === "warning" || result.riskLevel === "danger") {
        triggerLlmAnalysis(result);
      }
      toast.warning(`🔶 ${t.injectWarning} 완료`);
    } catch (e) {
      toast.error(t.error);
    }
  };

  const handleResetCost = async () => {
    try {
      await resetCostMutation.mutateAsync();
      await utils.semiguard.getStats.invalidate();
      toast.success("절감 비용이 초기화되었습니다.");
    } catch (e) {
      toast.error(t.error);
    }
  };

  const handleClearLogs = async () => {
    try {
      await clearLogs.mutateAsync();
      await utils.semiguard.getLogs.invalidate();
      await utils.semiguard.getStats.invalidate();
      toast.success("로그가 초기화되었습니다.");
    } catch (e) {
      toast.error(t.error);
    }
  };

  // 임시 데이터 생성 함수 (서버 함수와 동일)
  function generateInitialData(): AnomalyResult {
    return {
      sensorData: { current: 5.0, temperature: 45.0, vibration: 2.0, noise: 55.0, timestamp: Date.now() },
      anomalyScore: 10,
      riskLevel: "normal",
      isAnomaly: false,
    };
  }

  function generateNormalData(): SensorData {
    return {
      current: 5.0 + (Math.random() - 0.5) * 0.5,
      temperature: 45.0 + (Math.random() - 0.5) * 2,
      vibration: 2.0 + (Math.random() - 0.5) * 0.3,
      noise: 55.0 + (Math.random() - 0.5) * 3,
      timestamp: Date.now(),
    };
  }

  // 자동 폴링용 약한 주의 데이터 (점수 25~40)
  function generateSlightCautionData(): SensorData {
    const rand = (mean: number, std: number) =>
      mean + std * (1.2 + Math.random() * 0.8) * (Math.random() > 0.5 ? 1 : -1);
    return {
      current: parseFloat(rand(5.0, 0.5).toFixed(2)),
      temperature: parseFloat(rand(45.0, 3.0).toFixed(1)),
      vibration: parseFloat(rand(2.0, 0.3).toFixed(2)),
      noise: parseFloat(rand(55.0, 4.0).toFixed(1)),
      timestamp: Date.now(),
    };
  }

  // 자동 폴링용 약한 경고 데이터 (점수 45~60)
  function generateSlightWarningData(): SensorData {
    const rand = (mean: number, std: number) =>
      mean + std * (2.0 + Math.random() * 0.8) * (Math.random() > 0.5 ? 1 : -1);
    return {
      current: parseFloat(rand(5.0, 0.5).toFixed(2)),
      temperature: parseFloat(rand(45.0, 3.0).toFixed(1)),
      vibration: parseFloat(rand(2.0, 0.3).toFixed(2)),
      noise: parseFloat(rand(55.0, 4.0).toFixed(1)),
      timestamp: Date.now(),
    };
  }

  function analyzeData(data: SensorData): AnomalyResult {
    const currentMean = 5.0, currentStd = 0.3;
    const tempMean = 45.0, tempStd = 3.0;
    const vibMean = 2.0, vibStd = 0.4;
    const noiseMean = 55.0, noiseStd = 4.0;

    const zCurrent = Math.abs((data.current - currentMean) / currentStd);
    const zTemp = Math.abs((data.temperature - tempMean) / tempStd);
    const zVib = Math.abs((data.vibration - vibMean) / vibStd);
    const zNoise = Math.abs((data.noise - noiseMean) / noiseStd);

    // 서버와 동일한 점수 계산: 각 센서 z-score에 8을 곱하고 25로 cap (최대 100)
    const score = Math.min(100, Math.round(
      Math.min(zCurrent * 8, 25) +
      Math.min(zTemp * 8, 25) +
      Math.min(zVib * 8, 25) +
      Math.min(zNoise * 8, 25)
    ));
    const riskLevel: RiskLevel = score <= 29 ? "normal" : score <= 49 ? "caution" : score <= 69 ? "warning" : "danger";
    const isAnomaly = score > thresholds.warning;

    return { sensorData: data, anomalyScore: score, riskLevel, isAnomaly };
  }

  return (
    <div id="dashboard-root" className="min-h-screen flex flex-col" style={{ background: th.bg, color: th.text, transition: "background 0.3s ease, color 0.3s ease" }}>
      {/* ── 위험 화면 플래시 효과 ── */}
      {dangerFlash && (
        <div
          className="fixed inset-0 z-[1000] pointer-events-none"
          style={{
            background: "rgba(239, 68, 68, 0.35)",
            animation: "dangerFlashAnim 0.6s ease-out forwards",
          }}
        />
      )}
      {/* ── 위험 상태 팝업 ── */}
      {/* ── 이상 이력 상세 모달 ── */}
      {selectedLog && (() => {
        const log = selectedLog;
        const lvl = log.riskLevel as RiskLevel;
        const color = RISK_COLORS[lvl];
        const sensorItems = [
          { label: lang === "ko" ? "전류" : "Current",     value: log.current.toFixed(2),    unit: "A",    icon: "⚡", color: "#38bdf8" },
          { label: lang === "ko" ? "온도" : "Temperature", value: log.temperature.toFixed(1), unit: "°C",   icon: "🌡", color: "#fb923c" },
          { label: lang === "ko" ? "진동" : "Vibration",   value: log.vibration.toFixed(2),   unit: "mm/s", icon: "📳", color: "#a78bfa" },
          { label: lang === "ko" ? "소음" : "Noise",       value: log.noise.toFixed(1),       unit: "dB",   icon: "🔊", color: "#34d399" },
        ];
        return (
          <div className="fixed inset-0 z-[1100] flex items-center justify-center"
            style={{ background: "rgba(0,0,0,0.65)", animation: "fadeIn 0.2s ease-out" }}
            onClick={() => setSelectedLog(null)}>
            <div className="relative w-full max-w-sm mx-4 rounded-2xl shadow-2xl overflow-hidden"
              style={{ background: isDark ? "oklch(0.13 0.015 240)" : "oklch(0.99 0.003 240)", border: `1px solid ${color}40` }}
              onClick={e => e.stopPropagation()}>
              {/* 헤더 */}
              <div className="px-5 py-4 border-b flex items-center justify-between"
                style={{ borderColor: `${color}30`, background: `${color}10` }}>
                <div>
                  <p className="text-xs font-semibold" style={{ color: isDark ? "oklch(0.90 0.01 240)" : "oklch(0.15 0.01 240)" }}>
                    {lang === "ko" ? "이상 이력 상세" : lang === "ja" ? "異常履歴詳細" : "Anomaly Detail"}
                  </p>
                  <p className="text-[10px] mt-0.5" style={{ color: isDark ? "oklch(0.50 0.01 240)" : "oklch(0.45 0.01 240)" }}>
                    {new Date(log.timestamp).toLocaleString(lang === "ko" ? "ko-KR" : lang === "ja" ? "ja-JP" : "en-US", { hour12: false })}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold border"
                    style={{ color, background: RISK_BG[lvl], borderColor: RISK_BORDER[lvl] }}>
                    {lang === "ko"
                      ? lvl === "danger" ? "위험" : lvl === "warning" ? "경고" : lvl === "caution" ? "주의" : "정상"
                      : lvl.charAt(0).toUpperCase() + lvl.slice(1)}
                  </span>
                  <button onClick={() => setSelectedLog(null)}
                    className="text-lg leading-none hover:opacity-60 transition-opacity"
                    style={{ color: isDark ? "oklch(0.50 0.01 240)" : "oklch(0.45 0.01 240)" }}>✕</button>
                </div>
              </div>
              {/* 이상 점수 */}
              <div className="px-5 pt-4 pb-2 flex items-center justify-between">
                <span className="text-[11px] font-semibold" style={{ color: isDark ? "oklch(0.60 0.01 240)" : "oklch(0.40 0.01 240)" }}>
                  {lang === "ko" ? "이상 점수" : lang === "ja" ? "異常スコア" : "Anomaly Score"}
                </span>
                <span className="text-2xl font-bold font-mono" style={{ color }}>{log.anomalyScore}</span>
              </div>
              {/* 점수 바 */}
              <div className="px-5 pb-4">
                <div className="w-full h-2 rounded-full" style={{ background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)" }}>
                  <div className="h-2 rounded-full transition-all duration-700"
                    style={{ width: `${Math.min(log.anomalyScore, 100)}%`, background: color }} />
                </div>
              </div>
              {/* 센서 값 그리드 */}
              <div className="px-5 pb-5 grid grid-cols-2 gap-2">
                {sensorItems.map(s => (
                  <div key={s.label} className="rounded-xl p-3 border flex flex-col gap-1"
                    style={{ background: `${s.color}0d`, borderColor: `${s.color}30` }}>
                    <div className="flex items-center gap-1">
                      <span className="text-sm">{s.icon}</span>
                      <span className="text-[9px] font-semibold uppercase tracking-wide" style={{ color: s.color }}>{s.label}</span>
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-xl font-bold font-mono" style={{ color: s.color }}>{s.value}</span>
                      <span className="text-[9px]" style={{ color: isDark ? "oklch(0.50 0.01 240)" : "oklch(0.45 0.01 240)" }}>{s.unit}</span>
                    </div>
                  </div>
                ))}
              </div>
              {/* LLM 분석 결과 (저장된 경우) - 현재 언어에 맞는 컬럼 표시 */}
              {(log.llmAnalysisKo || log.llmAnalysisEn) && (() => {
                const raw = lang === "ko" ? log.llmAnalysisKo : lang === "ja" ? log.llmAnalysisJa : log.llmAnalysisEn;
                const fallback = log.llmAnalysisKo || log.llmAnalysisEn || log.llmAnalysisJa;
                try {
                  const a = JSON.parse(raw ?? fallback ?? "");
                  return (
                    <div className="px-5 pb-5 flex flex-col gap-2">
                      <div className="rounded-xl p-3 border" style={{ background: "oklch(0.75 0.18 200 / 0.06)", borderColor: "oklch(0.75 0.18 200 / 0.25)" }}>
                        <p className="text-[9px] font-bold uppercase tracking-wider mb-1.5" style={{ color: "oklch(0.75 0.18 200)" }}>
                          🤖 {lang === "ko" ? "AI 이상 원인 분석" : lang === "ja" ? "AI異常原因分析" : "AI Anomaly Analysis"}
                        </p>
                        <p className="text-[11px] font-semibold mb-1" style={{ color: isDark ? "oklch(0.90 0.01 240)" : "oklch(0.15 0.01 240)" }}>{a.primaryCause}</p>
                        <p className="text-[10px] leading-relaxed mb-1.5" style={{ color: isDark ? "oklch(0.60 0.01 240)" : "oklch(0.40 0.01 240)" }}>{a.details}</p>
                        <p className="text-[10px] font-medium" style={{ color: "oklch(0.75 0.18 200)" }}>→ {a.recommendation}</p>
                      </div>
                    </div>
                  );
                } catch { return null; }
              })()}
            </div>
          </div>
        );
      })()}
      {dangerAlert && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.7)", animation: "fadeIn 0.3s ease-out" }}>
          <div className="relative w-full max-w-md mx-4 rounded-2xl p-8 shadow-2xl"
            style={{
              background: "linear-gradient(135deg, rgba(239,68,68,0.15), rgba(220,38,38,0.10))",
              border: "2px solid rgb(239,68,68)",
              animation: "slideUp 0.4s cubic-bezier(0.23, 1, 0.32, 1)"
            }}>
            <div className="flex flex-col items-center gap-4">
              <div className="text-6xl animate-pulse">🚨</div>
              <h2 className="text-2xl font-bold text-center" style={{ color: "rgb(239,68,68)" }}>
                {lang === "ko" ? "위험 단계 도달!" : lang === "ja" ? "危険レベル到達！" : "DANGER LEVEL REACHED!"}
              </h2>
              <p className="text-center text-sm" style={{ color: "rgb(220,38,38)" }}>
                {lang === "ko"
                  ? "장비가 위험 상태에 도달했습니다. 즉시 점검이 필요합니다."
                  : lang === "ja"
                  ? "装置が危険な状態に達しました。即時点検が必要です。"
                  : "Equipment has reached a dangerous state. Immediate inspection required."}
              </p>
              <div className="w-full h-1 rounded-full" style={{ background: "rgb(239,68,68)" }}>
                <div className="h-full rounded-full" style={{
                  background: "rgb(239,68,68)",
                  animation: "pulse 1s ease-in-out infinite"
                }} />
              </div>
              {/* LLM 분석 결과 */}
              {llmLoading && (
                <div className="w-full flex items-center gap-2 px-3 py-2 rounded-lg"
                  style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
                  <div className="w-4 h-4 rounded-full border-2 border-red-400 border-t-transparent animate-spin flex-shrink-0" />
                  <span className="text-xs" style={{ color: "rgb(220,38,38)" }}>
                    {lang === "ko" ? "AI 이상 원인 분석 중..." : lang === "ja" ? "AI異常原因分析中..." : "AI analyzing anomaly cause..."}
                  </span>
                </div>
              )}
              {llmAnalysis && !llmLoading && (
                <div className="w-full rounded-xl p-4 text-left"
                  style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(239,68,68,0.3)" }}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm">🤖</span>
                    <span className="text-xs font-bold" style={{ color: "oklch(0.65 0.18 200)" }}>
                      {lang === "ko" ? "AI 이상 원인 분석" : lang === "ja" ? "AI異常原因分析" : "AI Anomaly Analysis"}
                    </span>
                  </div>
                  <p className="text-sm font-bold mb-1" style={{ color: "rgb(239,68,68)" }}>
                    {llmAnalysis.primaryCause}
                  </p>
                  <p className="text-xs mb-2 leading-relaxed" style={{ color: "rgba(255,255,255,0.75)" }}>
                    {llmAnalysis.details}
                  </p>
                  <div className="flex items-start gap-1.5">
                    <span className="text-xs mt-0.5">💡</span>
                    <p className="text-xs" style={{ color: "rgba(255,200,100,0.9)" }}>
                      {llmAnalysis.recommendation}
                    </p>
                  </div>
                </div>
              )}
              <button
                onClick={() => { setDangerAlert(false); }}
                className="mt-4 px-6 py-2 rounded-lg font-bold transition-all duration-200 active:scale-95"
                style={{
                  background: "rgb(239,68,68)",
                  color: "white",
                  boxShadow: "0 0 20px rgba(239,68,68,0.5)"
                }}>
                {lang === "ko" ? "확인" : "OK"}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* LLM 분석 결과 플로팅 패널 (위험/경고 탐지 후 dangerAlert 닫혀도 유지) */}
      {llmAnalysis && !dangerAlert && (
        <div className="fixed bottom-6 right-6 z-[500] w-80 rounded-2xl shadow-2xl"
          style={{
            background: isDark ? "oklch(0.13 0.015 240)" : "oklch(0.99 0.003 240)",
            border: `1px solid ${llmAnalysis.riskLevel === "danger" ? "rgba(239,68,68,0.5)" : "rgba(249,115,22,0.5)"}`,
            animation: "slideUp 0.4s cubic-bezier(0.23, 1, 0.32, 1)"
          }}>
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-base">🤖</span>
                <span className="text-xs font-bold" style={{ color: "oklch(0.65 0.18 200)" }}>
                  {lang === "ko" ? "AI 이상 원인 분석" : lang === "ja" ? "AI異常原因分析" : "AI Anomaly Analysis"}
                </span>
              </div>
              <button
                onClick={() => setLlmAnalysis(null)}
                className="w-5 h-5 rounded-full flex items-center justify-center text-xs transition-opacity hover:opacity-70"
                style={{ background: "rgba(128,128,128,0.2)", color: th.textMuted }}>
                ✕
              </button>
            </div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs px-2 py-0.5 rounded-full font-bold"
                style={{
                  background: llmAnalysis.riskLevel === "danger" ? "rgba(239,68,68,0.15)" : "rgba(249,115,22,0.15)",
                  color: llmAnalysis.riskLevel === "danger" ? "rgb(239,68,68)" : "rgb(249,115,22)",
                  border: `1px solid ${llmAnalysis.riskLevel === "danger" ? "rgba(239,68,68,0.3)" : "rgba(249,115,22,0.3)"}`
                }}>
                {lang === "ko"
                  ? (llmAnalysis.riskLevel === "danger" ? "위험" : llmAnalysis.riskLevel === "warning" ? "경고" : "주의")
                  : llmAnalysis.riskLevel}
                &nbsp;{llmAnalysis.score.toFixed(0)}점
              </span>
            </div>
            <p className="text-sm font-bold mb-2" style={{ color: th.text }}>
              {llmAnalysis.primaryCause}
            </p>
            <p className="text-xs mb-3 leading-relaxed" style={{ color: th.textMuted }}>
              {llmAnalysis.details}
            </p>
            <div className="flex items-start gap-1.5 rounded-lg p-2"
              style={{ background: isDark ? "rgba(255,200,100,0.06)" : "rgba(180,120,0,0.06)", border: "1px solid rgba(255,200,100,0.15)" }}>
              <span className="text-xs mt-0.5 flex-shrink-0">💡</span>
              <p className="text-xs leading-relaxed" style={{ color: isDark ? "rgba(255,200,100,0.9)" : "oklch(0.40 0.10 80)" }}>
                {llmAnalysis.recommendation}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── AI 분석 히스토리 패널 ── */}
      {showAiHistory && (
        <div className="fixed bottom-6 left-6 z-[490] w-80 rounded-2xl shadow-2xl overflow-hidden"
          style={{
            background: isDark ? "oklch(0.13 0.015 240)" : "oklch(0.99 0.003 240)",
            border: "1px solid oklch(0.75 0.18 200 / 0.35)",
            animation: "slideUp 0.4s cubic-bezier(0.23, 1, 0.32, 1)"
          }}>
          <div className="px-4 py-3 flex items-center justify-between border-b" style={{ borderColor: "oklch(0.75 0.18 200 / 0.20)", background: "oklch(0.75 0.18 200 / 0.06)" }}>
            <div className="flex items-center gap-2">
              <span className="text-sm">📋</span>
              <span className="text-xs font-bold" style={{ color: "oklch(0.75 0.18 200)" }}>
                {lang === "ko" ? "AI 분석 히스토리 (최근 5건)" : lang === "ja" ? "AI分析履歴（直近5件）" : "AI Analysis History (Last 5)"}
              </span>
            </div>
            <button onClick={() => setShowAiHistory(false)}
              className="w-5 h-5 rounded-full flex items-center justify-center text-xs transition-opacity hover:opacity-70"
              style={{ background: "rgba(128,128,128,0.2)", color: th.textMuted }}>✕</button>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {llmHistoryQuery.isLoading ? (
              <div className="px-4 py-6 flex justify-center">
                <div className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "oklch(0.75 0.18 200)", borderTopColor: "transparent" }} />
              </div>
            ) : llmHistoryQuery.isError ? (
              <div className="px-4 py-6 text-center text-xs" style={{ color: "rgb(239,68,68)" }}>
                {lang === "ko" ? "분석 이력을 불러오지 못했습니다." : lang === "ja" ? "分析履歴を取得できませんでした。" : "Failed to load analysis history."}
              </div>
            ) : !llmHistoryQuery.data || llmHistoryQuery.data.length === 0 ? (
              <div className="px-4 py-6 text-center text-xs text-muted-foreground">
                {lang === "ko" ? "저장된 AI 분석 결과가 없습니다." : lang === "ja" ? "保存されたAI分析結果がありません。" : "No AI analysis results saved yet."}
              </div>
            ) : llmHistoryQuery.data.map((item) => {
              let parsed: { primaryCause?: string; recommendation?: string } = {};
              const rawItem = lang === "ko" ? item.llmAnalysisKo : lang === "ja" ? item.llmAnalysisJa : item.llmAnalysisEn;
              const fallbackItem = item.llmAnalysisKo || item.llmAnalysisEn || item.llmAnalysisJa;
              try { parsed = JSON.parse(rawItem ?? fallbackItem ?? ""); } catch {}
              const lvlColor = item.riskLevel === "danger" ? "rgb(239,68,68)" : item.riskLevel === "warning" ? "rgb(249,115,22)" : "rgb(234,179,8)";
              return (
                <div key={item.id} className="px-4 py-3 border-b last:border-0" style={{ borderColor: isDark ? "oklch(0.18 0.015 240)" : "oklch(0.90 0.005 240)" }}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[9px] font-mono text-muted-foreground">
                      {new Date(item.timestamp).toLocaleString(lang === "ko" ? "ko-KR" : lang === "ja" ? "ja-JP" : "en-US", { hour12: false })}
                    </span>
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ color: lvlColor, background: `${lvlColor}18`, border: `1px solid ${lvlColor}30` }}>
                      {lang === "ko" ? (item.riskLevel === "danger" ? "위험" : item.riskLevel === "warning" ? "경고" : "주의") : lang === "ja" ? (item.riskLevel === "danger" ? "危険" : item.riskLevel === "warning" ? "警告" : "注意") : item.riskLevel} {item.anomalyScore}
                    </span>
                  </div>
                  {parsed.primaryCause && <p className="text-[11px] font-semibold mb-1" style={{ color: isDark ? "oklch(0.88 0.01 240)" : "oklch(0.15 0.01 240)" }}>{parsed.primaryCause}</p>}
                  {parsed.recommendation && <p className="text-[10px]" style={{ color: "oklch(0.75 0.18 200)" }}>→ {parsed.recommendation}</p>}
                </div>
              );
            })}
          </div>
        </div>
      )}
      {/* AI 히스토리 토글 버튼 */}
      {!showAiHistory && (
        <button
          onClick={() => setShowAiHistory(true)}
          className="fixed bottom-6 left-6 z-[490] flex items-center gap-2 px-3 py-2 rounded-xl shadow-lg text-xs font-bold border transition-all duration-200 hover:opacity-90 active:scale-95"
          style={{ background: isDark ? "oklch(0.13 0.015 240)" : "oklch(0.99 0.003 240)", borderColor: "oklch(0.75 0.18 200 / 0.40)", color: "oklch(0.75 0.18 200)" }}>
          📋 {lang === "ko" ? "AI 분석 이력" : lang === "ja" ? "AI分析履歴" : "AI History"}
          {llmHistoryQuery.data && llmHistoryQuery.data.length > 0 && (
            <span className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold" style={{ background: "oklch(0.75 0.18 200)", color: "white" }}>
              {llmHistoryQuery.data.length}
            </span>
          )}
        </button>
      )}
      {/* ── 헤더 ── */}
      <header className="sticky top-0 z-50 border-b flex items-center justify-between px-3 sm:px-5 py-3"
        style={{ background: th.header, borderColor: th.border, transition: "background 0.3s ease" }}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xl font-bold"
            style={{ background: "linear-gradient(135deg, oklch(0.65 0.18 200), oklch(0.55 0.20 220))" }}>
            🛡
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-wide">{t.appTitle}</h1>
            <p className="text-[10px] text-muted-foreground leading-tight">{t.appSubtitle}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-4">
          {!isMobile && <HeartbeatIndicator alive={heartbeatAlive} t={t} />}
          {!isMobile && <div className="w-px h-5 bg-border" />}
          <AlertPanel riskLevel={riskLevel} relayTripped={relayTripped} t={t} />
          {!isMobile && <div className="w-px h-5 bg-border" />}
          <button onClick={() => setLang(l => l === "ko" ? "en" : l === "en" ? "ja" : "ko")}
            className="px-3 py-1.5 rounded-lg text-xs font-bold border transition-all duration-200 hover:opacity-80 active:scale-95"
            style={{ borderColor: "oklch(0.65 0.18 200 / 0.4)", color: "oklch(0.65 0.18 200)", background: "oklch(0.65 0.18 200 / 0.08)" }}
            title={lang === "ko" ? "영어로 전환" : lang === "en" ? "日本語に切替" : "한국어로 전환"}>
            {lang === "ko" ? "EN" : lang === "en" ? "日本語" : "한국어"}
          </button>
          {/* 다크/라이트 모드 전환 */}
          <button
            onClick={() => setIsDark(d => {
              const next = !d;
              try { localStorage.setItem("semiguard_theme", next ? "dark" : "light"); } catch {}
              return next;
            })}
            title={isDark ? (lang === "ko" ? "라이트 모드" : "Light Mode") : (lang === "ko" ? "다크 모드" : "Dark Mode")}
            className="w-8 h-8 flex items-center justify-center rounded-lg border transition-all duration-200 hover:opacity-80 active:scale-95 text-base"
            style={{
              borderColor: isDark ? "oklch(0.35 0.01 240)" : "oklch(0.75 0.08 80 / 0.5)",
              color: isDark ? "oklch(0.65 0.15 60)" : "oklch(0.40 0.08 80)",
              background: isDark ? "oklch(0.15 0.01 240)" : "oklch(0.92 0.04 80 / 0.3)",
            }}>
            {isDark ? "☀️" : "🌙"}
          </button>
          {/* 음소거 토글 */}
          <button
            onClick={() => {
              setMuted(m => {
                const next = !m;
                mutedRef.current = next;
                try { localStorage.setItem("semiguard_muted", String(next)); } catch {}
                return next;
              });
            }}
            title={muted ? (lang === "ko" ? "소리 켜기" : "Unmute") : (lang === "ko" ? "소리 끄기" : "Mute")}
            className="w-8 h-8 flex items-center justify-center rounded-lg border transition-all duration-200 hover:opacity-80 active:scale-95 text-base"
            style={{
              borderColor: muted ? "oklch(0.35 0.01 240)" : "oklch(0.65 0.18 200 / 0.4)",
              color: muted ? "oklch(0.45 0.01 240)" : "oklch(0.65 0.18 200)",
              background: muted ? (isDark ? "oklch(0.15 0.01 240)" : "oklch(0.88 0.01 240)") : "oklch(0.65 0.18 200 / 0.08)",
            }}>
            {muted ? "🔕" : "🔔"}
          </button>
          {/* 볼륨 슬라이더 - 모바일 숨김 */}
          {!muted && !isMobile && (
            <div className="flex items-center gap-1.5" title={lang === "ko" ? "볼륨 조절" : "Volume"}>
              <span style={{ fontSize: 11, color: "oklch(0.50 0.01 240)" }}>🔉</span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={volume}
                onChange={e => {
                  const v = parseFloat(e.target.value);
                  setVolume(v);
                  volumeRef.current = v;
                  try { localStorage.setItem("semiguard_volume", String(v)); } catch {}
                }}
                style={{
                  width: 72,
                  accentColor: "oklch(0.65 0.18 200)",
                  cursor: "pointer",
                }}
              />
              <span style={{ fontSize: 10, color: "oklch(0.50 0.01 240)", minWidth: 28, textAlign: "right" }}>
                {Math.round(volume * 100)}%
              </span>
            </div>
          )}
          {/* 데모 자동 실행 토글 */}
          <button
            onClick={() => setDemoRunning(r => !r)}
            title={demoRunning ? (lang === "ko" ? "데모 중지" : "Stop Demo") : (lang === "ko" ? "데모 자동 실행" : "Auto Demo")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all duration-200 hover:opacity-80 active:scale-95"
            style={{
              borderColor: demoRunning ? "oklch(0.65 0.20 30 / 0.6)" : "oklch(0.35 0.01 240)",
              color: demoRunning ? "oklch(0.75 0.20 30)" : "oklch(0.50 0.01 240)",
              background: demoRunning ? "oklch(0.65 0.20 30 / 0.12)" : th.bgCard,
            }}>
            {demoRunning ? (
              <><span className="inline-block w-2 h-2 rounded-sm" style={{ background: "oklch(0.75 0.20 30)", animation: "pulse 1s ease-in-out infinite" }} /> {lang === "ko" ? "데모 중" : "Demo ON"}</>
            ) : (
              <><span>▶</span> {lang === "ko" ? "데모" : "Demo"}</>
            )}
          </button>
          {/* 데모 속도 슬라이더 - 모바일 숨김 */}
          {demoRunning && !isMobile && (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg border text-xs"
              style={{ borderColor: th.border2, background: th.bgCard }}>
              <span style={{ color: "oklch(0.50 0.01 240)" }}>{lang === "ko" ? "속도" : "Speed"}</span>
              <input
                type="range" min={1} max={10} step={1}
                value={demoSpeed}
                onChange={e => setDemoSpeed(Number(e.target.value))}
                className="w-20 h-1 accent-orange-400 cursor-pointer"
              />
              <span style={{ color: "oklch(0.65 0.18 200)", fontWeight: 700 }}>{demoSpeed}s</span>
            </div>
          )}
          {/* PDF 내보내기 버튼 */}
          <button
            id="btn-export-pdf"
            disabled={pdfExporting}
            onClick={async () => {
              // PDF 전용: 헤더/버튼 숨기고 센서+차트 영역만 캡처
              const captureEl = document.getElementById('pdf-capture-area');
              if (!captureEl) { toast.error(lang === "ko" ? "캡처 영역을 찾을 수 없습니다." : "Capture area not found."); return; }
              const el = captureEl;
              setPdfExporting(true);
              try {
                // html-to-image: oklch 포함 모든 CSS 색상 지원, html2canvas 대체
                const { toJpeg } = await import('html-to-image');
                const { jsPDF } = await import('jspdf');
                const dataUrl = await toJpeg(el, {
                  quality: 0.92,
                  backgroundColor: isDark ? '#0d1117' : '#f5f7fa',
                  width: el.scrollWidth,
                  height: el.scrollHeight,
                  style: { transform: 'none' },
                  skipFonts: false,
                  pixelRatio: 1,
                });
                // dataUrl에서 실제 이미지 크기 추출
                const img = new Image();
                await new Promise<void>((resolve, reject) => {
                  img.onload = () => resolve();
                  img.onerror = reject;
                  img.src = dataUrl;
                });
                const pdfW = img.naturalWidth;
                const pdfH = img.naturalHeight;
                const pdf = new jsPDF({
                  orientation: pdfW > pdfH ? 'landscape' : 'portrait',
                  unit: 'px',
                  format: [pdfW, pdfH],
                  hotfixes: ['px_scaling'],
                });
                pdf.addImage(dataUrl, 'JPEG', 0, 0, pdfW, pdfH);
                pdf.save(`semiguard_report_${new Date().toISOString().slice(0,10)}.pdf`);
                toast.success(lang === "ko" ? "PDF가 저장되었습니다." : "PDF saved successfully.");
              } catch (e) {
                console.error('PDF export error:', e);
                toast.error(lang === "ko" ? "PDF 내보내기 실패: " + String(e) : "PDF export failed: " + String(e));
              } finally {
                setPdfExporting(false);
              }
            }}
            title={lang === "ko" ? "PDF 내보내기" : "Export PDF"}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all duration-200 hover:opacity-80 active:scale-95 disabled:opacity-50"
            style={{ borderColor: th.border2, color: "oklch(0.65 0.18 200)", background: th.bgCard }}>
            {pdfExporting ? <span style={{ display: "inline-block", width: 12, height: 12, border: "2px solid oklch(0.65 0.18 200)", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} /> : "📄"} {lang === "ko" ? "PDF" : "PDF"}
          </button>
        </div>
      </header>

      {/* ── 랜딩 섹션 ── */}
      {showLanding && (
        <div className="border-b px-5 py-6" style={{ borderColor: th.border, background: isDark ? "linear-gradient(135deg, oklch(0.13 0.015 240), oklch(0.12 0.01 240))" : "linear-gradient(135deg, oklch(0.97 0.005 240), oklch(0.95 0.008 240))" }}>
          <div className="max-w-4xl mx-auto flex items-start justify-between gap-6">
            <div className="flex-1">
              <div className="inline-block px-3 py-1 rounded-full text-xs font-bold mb-3"
                style={{ background: "oklch(0.65 0.18 200 / 0.15)", color: "oklch(0.65 0.18 200)" }}>
                {t.landingBadge}
              </div>
              <h2 className="text-xl font-bold mb-2">{t.landingTitle}</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">{t.landingDesc}</p>
            </div>
            <button onClick={() => setShowLanding(false)}
              className="text-xs px-3 py-1.5 rounded-lg border transition-all duration-200 hover:opacity-70"
              style={{ borderColor: th.border2, color: th.textMuted }}>
              ✕
            </button>
          </div>
        </div>
      )}

      {/* ── 탭 ── */}
      <div className="flex border-b px-5" style={{ borderColor: th.border }}>
        {(["dashboard", "log"] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className="px-4 py-3 text-sm font-medium border-b-2 transition-all duration-200 mr-1"
            style={{
              borderColor: activeTab === tab ? "oklch(0.65 0.18 200)" : "transparent",
              color: activeTab === tab ? "oklch(0.65 0.18 200)" : "oklch(0.50 0.01 240)",
            }}>
            {tab === "dashboard" ? t.dashboard : t.anomalyLog}
          </button>
        ))}
      </div>

      <main className="flex-1 p-3 sm:p-5">
        {activeTab === "dashboard" ? (
          <>
            {/* 임팩트 통계 섹션 */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              <ImpactCard label={t.totalVisitors} value={getStats.data?.totalVisitors ?? 0} icon="👥" color="#38bdf8" />
              <ImpactCard label={t.totalDetections} value={getStats.data?.totalDetections ?? 0} icon="📊" color="#a78bfa" />
              <ImpactCard label={t.dangerCount} value={getStats.data?.dangerCount ?? 0} icon="⚠️" color="#ef4444" />
              <ImpactCard label={t.uptimePct} value={`${getStats.data?.uptimePct ?? 100}%`} icon="✅" color="#22c55e" />
            </div>

            {/* 절감 비용 카드 */}
            <div className="rounded-xl border p-4 sm:p-5 mb-6 flex flex-col gap-2"
              style={{ background: "linear-gradient(135deg, rgba(34,197,94,0.10), rgba(34,197,94,0.05))", borderColor: "rgba(34,197,94,0.30)" }}>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">{t.savedCost}</p>
              <div className="flex items-end gap-2">
                <span className="text-3xl font-bold font-mono" style={{ color: "#22c55e" }}>
                  ₩{displayedSavedCost.toLocaleString()}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-2">{t.impactDesc}</p>
            </div>

            {/* 메인 대시보드 그리드 */}
            <div id="pdf-capture-area" className="grid grid-cols-12 gap-4">
              {/* ── 임계값 설정 패널 (전체 너비) ── */}
              <div className="col-span-12 mb-2">
                <div className="rounded-xl border overflow-hidden" style={{ borderColor: "oklch(0.20 0.02 240)" }}>
                  <button
                    onClick={() => setShowThresholdPanel(p => !p)}
                    className="w-full flex items-center justify-between px-5 py-3 text-left transition-all hover:opacity-80"
                    style={{ background: th.bgCard }}>
                    <div className="flex items-center gap-2">
                      <span className="text-base">⚙️</span>
                      <span className="text-xs font-semibold">{lang === "ko" ? "위험도 임계값 설정" : "Risk Threshold Settings"}</span>
                      <span className="text-[10px] text-muted-foreground ml-1">
                        {lang === "ko"
                          ? `정상 ≤${thresholds.normal} / 주의 ≤${thresholds.caution} / 경고 ≤${thresholds.warning} / 위험 >${thresholds.warning}`
                          : `Normal ≤${thresholds.normal} / Caution ≤${thresholds.caution} / Warning ≤${thresholds.warning} / Danger >${thresholds.warning}`}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground">{showThresholdPanel ? "▲" : "▼"}</span>
                  </button>
                  {showThresholdPanel && (
                    <div className="px-5 py-4 border-t grid grid-cols-1 md:grid-cols-3 gap-5"
                      style={{ background: th.bgCard2, borderColor: th.border }}>
                      {/* 정상 임계값 */}
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "#22c55e" }}>
                            {lang === "ko" ? "정상 최대 점수" : "Normal Max"}
                          </label>
                          <span className="text-xs font-mono font-bold" style={{ color: "#22c55e" }}>{thresholds.normal}</span>
                        </div>
                        <input type="range" min={10} max={thresholds.caution - 1} value={thresholds.normal}
                          className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                          style={{ accentColor: "#22c55e" }}
                          onChange={e => {
                            const v = Number(e.target.value);
                            setThresholds(p => {
                              const n = { ...p, normal: v };
                              saveThresholdsMutation.mutate(n);
                              return n;
                            });
                          }} />
                        <p className="text-[9px] text-muted-foreground">{lang === "ko" ? "이 점수 이하 → 정상" : "Score ≤ this → Normal"}</p>
                      </div>
                      {/* 주의 임계값 */}
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "#eab308" }}>
                            {lang === "ko" ? "주의 최대 점수" : "Caution Max"}
                          </label>
                          <span className="text-xs font-mono font-bold" style={{ color: "#eab308" }}>{thresholds.caution}</span>
                        </div>
                        <input type="range" min={thresholds.normal + 1} max={thresholds.warning - 1} value={thresholds.caution}
                          className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                          style={{ accentColor: "#eab308" }}
                          onChange={e => {
                            const v = Number(e.target.value);
                            setThresholds(p => {
                              const n = { ...p, caution: v };
                              saveThresholdsMutation.mutate(n);
                              return n;
                            });
                          }} />
                        <p className="text-[9px] text-muted-foreground">{lang === "ko" ? "이 점수 이하 → 주의" : "Score ≤ this → Caution"}</p>
                      </div>
                      {/* 경고 임계값 */}
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "#f97316" }}>
                            {lang === "ko" ? "경고 최대 점수" : "Warning Max"}
                          </label>
                          <span className="text-xs font-mono font-bold" style={{ color: "#f97316" }}>{thresholds.warning}</span>
                        </div>
                        <input type="range" min={thresholds.caution + 1} max={89} value={thresholds.warning}
                          className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                          style={{ accentColor: "#f97316" }}
                          onChange={e => {
                            const v = Number(e.target.value);
                            setThresholds(p => {
                              const n = { ...p, warning: v };
                              saveThresholdsMutation.mutate(n);
                              return n;
                            });
                          }} />
                        <p className="text-[9px] text-muted-foreground">{lang === "ko" ? `이 점수 초과 → 위험 (현재 >${thresholds.warning})` : `Score > this → Danger (now >${thresholds.warning})`}</p>
                      </div>
                      {/* 초기화 버튼 */}
                      <div className="col-span-1 md:col-span-3 flex justify-end">
                        <button
                          onClick={() => {
                            const def = { normal: 29, caution: 49, warning: 69 };
                            setThresholds(def);
                            saveThresholdsMutation.mutate(def);
                          }}
                          className="text-[10px] px-3 py-1.5 rounded-lg border transition-all hover:opacity-80 active:scale-95"
                          style={{ borderColor: th.border2, color: th.textMuted }}>
                          {lang === "ko" ? "기본값으로 초기화" : "Reset to Default"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* ── 센서별 임계값 설정 패널 ── */}
              <div className="col-span-12 mb-2">
                <div className="rounded-xl border overflow-hidden" style={{ borderColor: "oklch(0.20 0.02 240)" }}>
                  <button
                    onClick={() => setShowSensorPanel(p => !p)}
                    className="w-full flex items-center justify-between px-5 py-3 text-left transition-all hover:opacity-80"
                    style={{ background: th.bgCard }}>
                    <div className="flex items-center gap-2">
                      <span className="text-base">🔬</span>
                      <span className="text-xs font-semibold">{lang === "ko" ? "센서별 임계값 설정" : "Per-Sensor Threshold Settings"}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{showSensorPanel ? "▲" : "▼"}</span>
                  </button>
                  {showSensorPanel && (
                    <div className="px-5 py-4 border-t grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5"
                      style={{ background: th.bgCard2, borderColor: th.border }}>
                      {/* 전류 */}
                      {[
                        { key: "current" as const, label: lang === "ko" ? "전류 (A)" : "Current (A)", color: "#38bdf8", step: 0.1,
                          caution: sensorThresh.currentCaution, warning: sensorThresh.currentWarning, danger: sensorThresh.currentDanger,
                          setCaution: (v: number) => { const n = { ...sensorThresh, currentCaution: v }; setSensorThresh(n); saveSensorThresholdsMutation.mutate(n); },
                          setWarning: (v: number) => { const n = { ...sensorThresh, currentWarning: v }; setSensorThresh(n); saveSensorThresholdsMutation.mutate(n); },
                          setDanger:  (v: number) => { const n = { ...sensorThresh, currentDanger: v };  setSensorThresh(n); saveSensorThresholdsMutation.mutate(n); },
                          min: 5, max: 20 },
                        { key: "temp" as const, label: lang === "ko" ? "온도 (°C)" : "Temperature (°C)", color: "#fb923c", step: 1,
                          caution: sensorThresh.tempCaution, warning: sensorThresh.tempWarning, danger: sensorThresh.tempDanger,
                          setCaution: (v: number) => { const n = { ...sensorThresh, tempCaution: v }; setSensorThresh(n); saveSensorThresholdsMutation.mutate(n); },
                          setWarning: (v: number) => { const n = { ...sensorThresh, tempWarning: v }; setSensorThresh(n); saveSensorThresholdsMutation.mutate(n); },
                          setDanger:  (v: number) => { const n = { ...sensorThresh, tempDanger: v };  setSensorThresh(n); saveSensorThresholdsMutation.mutate(n); },
                          min: 40, max: 120 },
                        { key: "vib" as const, label: lang === "ko" ? "진동 (mm/s)" : "Vibration (mm/s)", color: "#a78bfa", step: 0.05,
                          caution: sensorThresh.vibCaution, warning: sensorThresh.vibWarning, danger: sensorThresh.vibDanger,
                          setCaution: (v: number) => { const n = { ...sensorThresh, vibCaution: v }; setSensorThresh(n); saveSensorThresholdsMutation.mutate(n); },
                          setWarning: (v: number) => { const n = { ...sensorThresh, vibWarning: v }; setSensorThresh(n); saveSensorThresholdsMutation.mutate(n); },
                          setDanger:  (v: number) => { const n = { ...sensorThresh, vibDanger: v };  setSensorThresh(n); saveSensorThresholdsMutation.mutate(n); },
                          min: 1.5, max: 5.0 },
                        { key: "noise" as const, label: lang === "ko" ? "소음 (dB)" : "Noise (dB)", color: "#34d399", step: 1,
                          caution: sensorThresh.noiseCaution, warning: sensorThresh.noiseWarning, danger: sensorThresh.noiseDanger,
                          setCaution: (v: number) => { const n = { ...sensorThresh, noiseCaution: v }; setSensorThresh(n); saveSensorThresholdsMutation.mutate(n); },
                          setWarning: (v: number) => { const n = { ...sensorThresh, noiseWarning: v }; setSensorThresh(n); saveSensorThresholdsMutation.mutate(n); },
                          setDanger:  (v: number) => { const n = { ...sensorThresh, noiseDanger: v };  setSensorThresh(n); saveSensorThresholdsMutation.mutate(n); },
                          min: 50, max: 100 },
                      ].map(s => (
                        <div key={s.key} className="flex flex-col gap-3 p-3 rounded-lg border" style={{ borderColor: `${s.color}30`, background: `${s.color}08` }}>
                          <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: s.color }}>{s.label}</p>
                          {[
                            { label: lang === "ko" ? "주의" : "Caution", val: s.caution, set: s.setCaution, color: "#eab308" },
                            { label: lang === "ko" ? "경고" : "Warning", val: s.warning, set: s.setWarning, color: "#f97316" },
                            { label: lang === "ko" ? "위험" : "Danger",  val: s.danger,  set: s.setDanger,  color: "#ef4444" },
                          ].map(row => (
                            <div key={row.label} className="flex flex-col gap-1">
                              <div className="flex items-center justify-between">
                                <span className="text-[9px] font-semibold" style={{ color: row.color }}>{row.label}</span>
                                <span className="text-[9px] font-mono" style={{ color: row.color }}>{row.val.toFixed(s.step < 1 ? 2 : 0)}</span>
                              </div>
                              <input type="range" min={s.min} max={s.max} step={s.step} value={row.val}
                                className="w-full h-1 rounded-full appearance-none cursor-pointer"
                                style={{ accentColor: row.color }}
                                onChange={e => row.set(Number(e.target.value))} />
                            </div>
                          ))}
                        </div>
                      ))}
                      <div className="col-span-1 md:col-span-2 xl:col-span-4 flex justify-end">
                        <button
                          onClick={() => {
                            const def = {
                              currentCaution: 7.0, currentWarning: 9.0, currentDanger: 11.0,
                              tempCaution: 55.0, tempWarning: 70.0, tempDanger: 85.0,
                              vibCaution: 2.3, vibWarning: 2.6, vibDanger: 3.0,
                              noiseCaution: 65.0, noiseWarning: 75.0, noiseDanger: 85.0,
                            };
                            setSensorThresh(def);
                            saveSensorThresholdsMutation.mutate(def);
                          }}
                          className="text-[10px] px-3 py-1.5 rounded-lg border transition-all hover:opacity-80 active:scale-95"
                          style={{ borderColor: th.border2, color: th.textMuted }}>
                          {lang === "ko" ? "기본값으로 초기화" : "Reset to Default"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* ── 왼쪽: 센서 카드 (재배치) ── */}
              <div className="col-span-12 lg:col-span-3">
              <div className="grid grid-cols-2 lg:grid-cols-1 gap-3">
                {[
                  { label: t.current,     value: sensorData?.current     ?? 5.0,  unit: t.unitA,   color: "#38bdf8", icon: "⚡", sensorKey: "current" },
                  { label: t.temperature, value: sensorData?.temperature ?? 45.0, unit: t.unitC,   color: "#fb923c", icon: "🌡", sensorKey: "temp" },
                  { label: t.vibration,   value: sensorData?.vibration   ?? 2.0,  unit: t.unitMms, color: "#a78bfa", icon: "📳", sensorKey: "vib" },
                  { label: t.noise,       value: sensorData?.noise       ?? 55.0, unit: t.unitDb,  color: "#34d399", icon: "🔊", sensorKey: "noise" },
                ].map(card => {
                  const alertLevel = (() => {
                    const v = card.value;
                    const k = card.sensorKey;
                    const danger = sensorThresh[`${k}Danger` as keyof typeof sensorThresh];
                    const warning = sensorThresh[`${k}Warning` as keyof typeof sensorThresh];
                    const caution = sensorThresh[`${k}Caution` as keyof typeof sensorThresh];
                    if (v >= danger) return "danger";
                    if (v >= warning) return "warning";
                    if (v >= caution) return "caution";
                    return "normal";
                  })();
                  const blinkBorderColor = alertLevel === "danger" ? "#ef4444" : alertLevel === "warning" ? "#f97316" : alertLevel === "caution" ? "#eab308" : `${card.color}35`;
                  const blinkAnim = alertLevel !== "normal" ? "sensorBlink 1s ease-in-out infinite" : "none";
                  return (
                  <div key={card.label} className="rounded-xl p-4 border flex flex-col gap-2 transition-all duration-300"
                    style={{ background: "rgba(255,255,255,0.025)", borderColor: blinkBorderColor, animation: blinkAnim, borderWidth: alertLevel !== "normal" ? "2px" : "1px" }}>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">{card.label}</span>
                      <span className="text-base opacity-70">{card.icon}</span>
                    </div>
                    <div className="flex items-end gap-1.5">
                      <span className="text-3xl font-bold font-mono leading-none" style={{ color: card.color }}>{card.value.toFixed(1)}</span>
                      <span className="text-xs text-muted-foreground mb-0.5">{card.unit}</span>
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      <span className="text-[9px] text-muted-foreground opacity-60">{lang === "ko" ? "점수 추이" : "Score trend"}</span>
                      <Sparkline data={scoreHistory} color={card.color} />
                    </div>
                  </div>
                  );
                })}
              </div>
              </div>

              {/* ── 가운데: 차트 ── */}
              <div className="col-span-12 lg:col-span-6 flex flex-col gap-4">
                {/* 전류 + 온도 */}
                <div className="rounded-xl border p-4" style={{ background: th.bgCard, borderColor: th.border }}>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-3">
                    {t.current} <span className="text-[#38bdf8]">●</span> / {t.temperature} <span className="text-[#fb923c]">●</span>
                  </p>
                  <ResponsiveContainer width="100%" height={150}>
                    <LineChart data={chartData} margin={{ top: 4, right: 8, left: -24, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                      <XAxis dataKey="label" tick={{ fontSize: 9, fill: "#4b5563" }} interval="preserveStartEnd" />
                      <YAxis tick={{ fontSize: 9, fill: "#4b5563" }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Line type="monotone" dataKey="current"     stroke="#38bdf8" strokeWidth={2} dot={false} isAnimationActive={false} name={t.current} />
                      <Line type="monotone" dataKey="temperature" stroke="#fb923c" strokeWidth={2} dot={false} isAnimationActive={false} name={t.temperature} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                {/* 진동 + 소음 */}
                <div className="rounded-xl border p-4" style={{ background: th.bgCard, borderColor: th.border }}>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-3">
                    {t.vibration} <span className="text-[#a78bfa]">●</span> / {t.noise} <span className="text-[#34d399]">●</span>
                  </p>
                  <ResponsiveContainer width="100%" height={150}>
                    <LineChart data={chartData} margin={{ top: 4, right: 8, left: -24, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                      <XAxis dataKey="label" tick={{ fontSize: 9, fill: "#4b5563" }} interval="preserveStartEnd" />
                      <YAxis tick={{ fontSize: 9, fill: "#4b5563" }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Line type="monotone" dataKey="vibration" stroke="#a78bfa" strokeWidth={2} dot={false} isAnimationActive={false} name={t.vibration} />
                      <Line type="monotone" dataKey="noise"     stroke="#34d399" strokeWidth={2} dot={false} isAnimationActive={false} name={t.noise} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* ── 오른쪽: 위험도 + 시뮬레이터 ── */}
              <div className="col-span-12 lg:col-span-3 flex flex-col gap-4">
                {/* 위험도 게이지 */}
                <div className="rounded-xl border p-5 flex flex-col items-center gap-4 transition-all duration-500"
                  style={{
                    background: RISK_BG[riskLevel],
                    borderColor: RISK_BORDER[riskLevel],
                    boxShadow: riskLevel === "danger" ? `0 0 30px ${RISK_COLORS.danger}25` : "none",
                  }}>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest self-start">{t.riskLevel}</p>
                  <RiskGauge score={anomalyScore} riskLevel={riskLevel} t={t} />
                </div>

                {/* 시뮬레이터 - 4단계 버튼 */}
                <div className="rounded-xl border p-4 flex flex-col gap-2.5"
                  style={{ background: th.bgCard, borderColor: th.border }}>
                  <div className="flex items-center justify-between mb-0.5">
                    <p className="text-xs font-semibold">{t.simulatorTitle}</p>
                    {lastInjectedMode && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                        style={{
                          background: lastInjectedMode === "normal" ? "rgba(34,197,94,0.15)" : lastInjectedMode === "caution" ? "rgba(234,179,8,0.15)" : lastInjectedMode === "warning" ? "rgba(249,115,22,0.15)" : "rgba(239,68,68,0.15)",
                          color: lastInjectedMode === "normal" ? "#22c55e" : lastInjectedMode === "caution" ? "#eab308" : lastInjectedMode === "warning" ? "#f97316" : "#ef4444",
                        }}>
                        {t[lastInjectedMode]}
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground leading-relaxed">{t.simulatorDesc}</p>
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    <button onClick={handleInjectNormal} disabled={injectNormal.isPending}
                      className="py-2 rounded-lg text-xs font-semibold border transition-all duration-200 active:scale-[0.97] disabled:opacity-40"
                      style={{ background: "rgba(34,197,94,0.10)", borderColor: "#22c55e45", color: "#22c55e" }}>
                      {injectNormal.isPending
                        ? <span className="flex items-center justify-center gap-1.5"><ButtonSpinner color="#22c55e" /><span>처리 중...</span></span>
                        : `▶ ${t.injectNormal}`}
                    </button>
                    <button onClick={handleInjectCaution} disabled={injectCaution.isPending}
                      className="py-2 rounded-lg text-xs font-semibold border transition-all duration-200 active:scale-[0.97] disabled:opacity-40"
                      style={{ background: "rgba(234,179,8,0.10)", borderColor: "#eab30845", color: "#eab308" }}>
                      {injectCaution.isPending
                        ? <span className="flex items-center justify-center gap-1.5"><ButtonSpinner color="#eab308" /><span>처리 중...</span></span>
                        : `⚡ ${t.injectCaution}`}
                    </button>
                    <button onClick={handleInjectWarning} disabled={injectWarning.isPending}
                      className="py-2 rounded-lg text-xs font-semibold border transition-all duration-200 active:scale-[0.97] disabled:opacity-40"
                      style={{ background: "rgba(249,115,22,0.10)", borderColor: "#f9731645", color: "#f97316" }}>
                      {injectWarning.isPending
                        ? <span className="flex items-center justify-center gap-1.5"><ButtonSpinner color="#f97316" /><span>처리 중...</span></span>
                        : `🔶 ${t.injectWarning}`}
                    </button>
                    <button onClick={handleInjectAnomaly} disabled={injectAnomaly.isPending}
                      className="py-2 rounded-lg text-xs font-semibold border transition-all duration-200 active:scale-[0.97] disabled:opacity-40"
                      style={{ background: "rgba(239,68,68,0.10)", borderColor: "#ef444445", color: "#ef4444" }}>
                      {injectAnomaly.isPending
                        ? <span className="flex items-center justify-center gap-1.5"><ButtonSpinner color="#ef4444" /><span>처리 중...</span></span>
                        : `⚠ ${t.injectAnomaly}`}
                    </button>
                  </div>
                </div>
                {/* 절감 비용 리셋 버튼 */}
                <button onClick={handleResetCost} disabled={resetCostMutation.isPending}
                  className="w-full py-2 rounded-lg text-xs font-semibold border transition-all duration-200 active:scale-[0.97] disabled:opacity-40"
                  style={{ background: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)", borderColor: th.border2, color: th.textMuted }}>
                  {resetCostMutation.isPending
                    ? <span className="flex items-center justify-center gap-1.5"><ButtonSpinner color="#6b7280" /><span>{t.processing}</span></span>
                    : `↺ ${t.resetCost}`}
                </button>
              </div>
            </div>
            {/* ── 월간 히트맵 캘린더 ── */}
            <div className="mt-4">
              {/* ── 위험도 점수 라인 차트 ── */}
              <div className="rounded-xl border p-4 mb-4" style={{ background: th.bgCard, borderColor: th.border }}>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
                    {lang === "ko" ? "위험도 점수 추이 (최근 50개)" : "Risk Score Trend (Last 50)"}
                  </p>
                  <div className="flex gap-3 text-[9px]">
                    {(["normal","caution","warning","danger"] as const).map(r => (
                      <span key={r} className="flex items-center gap-1">
                        <span className="inline-block w-2 h-2 rounded-full" style={{ background: RISK_COLOR_MAP[r] }} />
                        <span className="text-muted-foreground capitalize">{r}</span>
                      </span>
                    ))}
                  </div>
                </div>
                <ScoreLineChart data={getRecentScoresQuery.data ?? []} lang={lang} isDark={isDark} />
              </div>
              <MonthlyHeatmap
                dailyData={getDailyMaxRisk.data ?? []}
                lang={lang}
                t={t}
                isDark={isDark}
                onDateClick={(date) => {
                  setSelectedDate(date);
                  setLogFilter("all");
                  setLogPage(1);
                  setActiveTab("log");
                }}
              />
              </div>
          </>
        ) : (
        <div className="rounded-xl border overflow-hidden" style={{ borderColor: th.border }}>{/* 이상 이력 로그 탭 */}
          {/* 새 기록 알림 배너 */}
          {newLogCount > 0 && (
            <div
              className="flex items-center justify-between px-4 py-2 text-sm font-semibold cursor-pointer"
              style={{ background: "rgba(34,197,94,0.15)", borderBottom: "1px solid rgba(34,197,94,0.3)", color: "#22c55e" }}
              onClick={() => setNewLogCount(0)}
            >
              <span>🔔 {lang === "ko" ? `새 기록 ${newLogCount}건이 추가되었습니다` : `${newLogCount} new record${newLogCount > 1 ? "s" : ""} added`}</span>
              <span className="text-xs opacity-70">{lang === "ko" ? "클릭하여 닫기" : "Click to dismiss"}</span>
            </div>
          )}
          {/* 탭 헤더 - 2행 구조 */}
          <div className="px-5 py-3 border-b flex flex-col gap-2"
            style={{ background: th.bgCard, borderColor: th.border }}>
          {/* 0행: 통계 요약 카드 */}
          <div className="grid grid-cols-3 gap-2 mb-1">
            {(() => {
              // 날짜 범위 기준 필터된 로그
              const rangedLogs = logs.filter(l =>
                (dateStart ? l.timestamp.slice(0,10) >= dateStart : true) &&
                (dateEnd   ? l.timestamp.slice(0,10) <= dateEnd   : true)
              );
              const totalAbnormal = rangedLogs.filter(l => l.riskLevel !== "normal").length;
              const stats = [
                { label: lang === "ko" ? "위험" : "Danger",  count: rangedLogs.filter(l => l.riskLevel === "danger").length,  color: "#ef4444", bg: "rgba(239,68,68,0.08)",   border: "rgba(239,68,68,0.25)",   icon: "🔴" },
                { label: lang === "ko" ? "경고" : "Warning", count: rangedLogs.filter(l => l.riskLevel === "warning").length, color: "#f97316", bg: "rgba(249,115,22,0.08)",  border: "rgba(249,115,22,0.25)",  icon: "🟠" },
                { label: lang === "ko" ? "주의" : "Caution", count: rangedLogs.filter(l => l.riskLevel === "caution").length, color: "#eab308", bg: "rgba(234,179,8,0.08)",   border: "rgba(234,179,8,0.25)",   icon: "🟡" },
              ];
              return stats.map(s => {
                const pct = totalAbnormal > 0 ? Math.round(s.count / totalAbnormal * 100) : 0;
                return (
                  <div key={s.label} className="rounded-lg p-2.5 border flex flex-col gap-1"
                    style={{ background: s.bg, borderColor: s.border }}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <span className="text-xs">{s.icon}</span>
                        <span className="text-[10px] font-semibold" style={{ color: s.color }}>{s.label}</span>
                      </div>
                      <span className="text-base font-bold font-mono" style={{ color: s.color }}>{s.count}</span>
                    </div>
                    {/* 비율 바 */}
                    <div className="w-full h-1 rounded-full" style={{ background: "rgba(255,255,255,0.08)" }}>
                      <div className="h-1 rounded-full transition-all duration-500"
                        style={{ width: `${pct}%`, background: s.color }} />
                    </div>
                    <span className="text-[9px] font-mono text-right" style={{ color: s.color, opacity: 0.75 }}>
                      {totalAbnormal > 0 ? `${pct}%` : "-"}
                    </span>
                  </div>
                );
              });
            })()}
          </div>
          {/* 날짜 범위 필터 */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 flex-wrap">
            <span className="text-[10px] font-semibold" style={{ color: th.textMuted }}>{lang === "ko" ? "기간 (연-월-일)" : "Period (YYYY-MM-DD)"}:</span>
            <input type="date" value={dateStart}
              onChange={e => { setDateStart(e.target.value); setLogPage(1); }}
              className="text-[10px] px-2 py-1 rounded-lg border outline-none"
              style={{ background: th.bgCard2, borderColor: th.border, color: th.text, colorScheme: isDark ? "dark" : "light" }} />
            <span className="text-[10px]" style={{ color: th.textMuted }}>~</span>
            <input type="date" value={dateEnd}
              onChange={e => { setDateEnd(e.target.value); setLogPage(1); }}
              className="text-[10px] px-2 py-1 rounded-lg border outline-none"
              style={{ background: th.bgCard2, borderColor: th.border, color: th.text, colorScheme: isDark ? "dark" : "light" }} />
            {(dateStart || dateEnd) && (
              <button onClick={() => { setDateStart(""); setDateEnd(""); setLogPage(1); }}
                className="text-[10px] px-2 py-1 rounded-lg border transition-all hover:opacity-70"
                style={{ borderColor: th.border2, color: th.textMuted }}>
                {lang === "ko" ? "초기화" : "Reset"}
              </button>
            )}
            <span className="text-[10px] ml-auto" style={{ color: th.textMuted }}>
              {lang === "ko" ? `${filteredLogs.length}건 표시` : `${filteredLogs.length} records`}
            </span>
          </div>
          {/* 1행: 제목 + CSV/클리어 버튼 */}
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">{t.anomalyLog}</p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  if (!filteredLogs || filteredLogs.length === 0) {
                    toast.info(lang === "ko" ? "내보낼 로그가 없습니다." : lang === "ja" ? "エクスポートするログがありません。" : "No logs to export.");
                    return;
                  }
                  exportLogsToCSV(filteredLogs, lang);
                  toast.success(t.exportCsvSuccess);
                }}
                className="text-xs px-3 py-1.5 rounded-lg border transition-all duration-200 hover:opacity-80 active:scale-95"
                style={{ borderColor: "oklch(0.65 0.18 200 / 0.4)", color: "oklch(0.65 0.18 200)", background: "oklch(0.65 0.18 200 / 0.08)" }}>
                ⬇ {t.exportCsv}
              </button>
              <button onClick={handleClearLogs}
                className="text-xs px-3 py-1.5 rounded-lg border transition-all duration-200 hover:opacity-70"
                style={{ borderColor: th.border2, color: th.textMuted }}>
                {t.clearLogs}
              </button>
            </div>
          </div>
          {/* 2행: 필터 버튼 */}
          <div className="flex items-center gap-1.5 flex-wrap">
              {/* 날짜 필터 chip */}
              {selectedDate && (
                <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold border"
                  style={{ borderColor: "oklch(0.65 0.18 200 / 0.6)", color: "oklch(0.65 0.18 200)", background: "oklch(0.65 0.18 200 / 0.12)" }}>
                  📅 {selectedDate}
                  <button onClick={() => setSelectedDate(null)} className="ml-1 hover:opacity-70 transition-opacity" title={lang === "ko" ? "날짜 필터 해제" : lang === "ja" ? "日付フィルター解除" : "Clear date filter"}>✕</button>
                </div>
              )}
              {(["all", "normal", "caution", "warning", "danger"] as const).map(f => {
                const labelMap: Record<typeof f, string> = {
                  all:     lang === "ko" ? "전체" : "All",
                  normal:  lang === "ko" ? "정상" : "Normal",
                  caution: lang === "ko" ? "주의" : "Caution",
                  warning: lang === "ko" ? "경고" : "Warning",
                  danger:  lang === "ko" ? "위험" : "Danger",
                };
                const colorMap: Record<typeof f, string> = {
                  all:     "oklch(0.65 0.18 200)",
                  normal:  "#22c55e",
                  caution: "#eab308",
                  warning: "#f97316",
                  danger:  "#ef4444",
                };
                const isActive = logFilter === f;
                return (
                  <button key={f}
                    onClick={() => { setLogFilter(f); setLogPage(1); }}
                    className="px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all duration-150 hover:opacity-90 active:scale-95"
                    style={{
                      borderColor: isActive ? `${colorMap[f]}80` : "oklch(0.22 0.02 240)",
                      color: isActive ? colorMap[f] : "oklch(0.45 0.01 240)",
                      background: isActive ? `${colorMap[f]}18` : "transparent",
                    }}>
                    {labelMap[f]}
                    {f !== "all" && (
                      <span className="ml-1 opacity-60">
                        ({logs.filter(l => l.riskLevel === f).length})
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr style={{ background: th.bgCard2, borderBottom: `1px solid ${th.border}` }}>
                    {[t.logTime, t.logCurrent, t.logTemp, t.logVib, t.logNoise, t.logScore, t.logLevel, lang === "ko" ? "AI 분석" : lang === "ja" ? "AI分析" : "AI Analysis"].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-muted-foreground font-semibold uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {logsLoading ? (
                    <tr><td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">Loading...</td></tr>
                  ) : !logs || logs.length === 0 ? (
                    <tr><td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">{t.noLogs}</td></tr>
                  ) : pagedLogs.map(log => {
                    const lvl = log.riskLevel as RiskLevel;
                    const color = RISK_COLORS[lvl];
                    return (
                      <tr key={log.id}
                        className="border-b transition-colors hover:bg-white/[0.04] cursor-pointer"
                        style={{ borderColor: "oklch(0.17 0.015 240)" }}
                        onClick={() => setSelectedLog(log)}
                        title={lang === "ko" ? "클릭하여 상세 보기" : lang === "ja" ? "クリックして詳細を表示" : "Click for details"}>
                        <td className="px-4 py-3 font-mono text-muted-foreground whitespace-nowrap">
                          {new Date(log.timestamp).toLocaleString(lang === "ko" ? "ko-KR" : lang === "ja" ? "ja-JP" : "en-US", { hour12: false })}
                        </td>
                        <td className="px-4 py-3 font-mono">{log.current.toFixed(2)}</td>
                        <td className="px-4 py-3 font-mono">{log.temperature.toFixed(1)}</td>
                        <td className="px-4 py-3 font-mono">{log.vibration.toFixed(2)}</td>
                        <td className="px-4 py-3 font-mono">{log.noise.toFixed(1)}</td>
                        <td className="px-4 py-3 font-mono font-bold" style={{ color }}>{log.anomalyScore}</td>
                        <td className="px-4 py-3">
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold border"
                            style={{ color, background: RISK_BG[lvl], borderColor: RISK_BORDER[lvl] }}>
                            {t[lvl]}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {(log.llmAnalysisKo || log.llmAnalysisEn) ? (
                            <span title={(() => { try { const raw = lang === "ko" ? log.llmAnalysisKo : lang === "ja" ? log.llmAnalysisJa : log.llmAnalysisEn; const a = JSON.parse(raw ?? log.llmAnalysisKo ?? log.llmAnalysisEn ?? ""); return a.primaryCause; } catch { return ""; } })()}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border"
                              style={{ color: "oklch(0.75 0.18 200)", background: "oklch(0.75 0.18 200 / 0.10)", borderColor: "oklch(0.75 0.18 200 / 0.30)" }}>
                              🤖 AI
                            </span>
                          ) : (
                            <span className="text-[10px] text-muted-foreground opacity-40">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {/* ── 페이지네이션 ── */}
            {logs.length > LOG_PAGE_SIZE && (
              <div className="flex items-center justify-between px-5 py-3 border-t"
                style={{ borderColor: th.border, background: th.bgCard2 }}>
                <span className="text-[11px] text-muted-foreground">
                  {lang === "ko"
                    ? `총 ${filteredLogs.length}개 중 ${(logPage - 1) * LOG_PAGE_SIZE + 1}–${Math.min(logPage * LOG_PAGE_SIZE, filteredLogs.length)}개`
                    : `${(logPage - 1) * LOG_PAGE_SIZE + 1}–${Math.min(logPage * LOG_PAGE_SIZE, filteredLogs.length)} of ${filteredLogs.length}`}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setLogPage(p => Math.max(1, p - 1))}
                    disabled={logPage === 1}
                    className="px-2.5 py-1 rounded-lg text-xs border transition-all duration-150 disabled:opacity-30 hover:opacity-80 active:scale-95"
                    style={{ borderColor: "oklch(0.25 0.02 240)", color: "oklch(0.60 0.01 240)" }}>
                    ‹ {lang === "ko" ? "이전" : "Prev"}
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter(p => p === 1 || p === totalPages || Math.abs(p - logPage) <= 1)
                    .reduce<(number | "…")[]>((acc, p, idx, arr) => {
                      if (idx > 0 && typeof arr[idx - 1] === "number" && (p as number) - (arr[idx - 1] as number) > 1) acc.push("…");
                      acc.push(p);
                      return acc;
                    }, [])
                    .map((p, i) =>
                      p === "…"
                        ? <span key={`ell-${i}`} className="px-1 text-xs text-muted-foreground">…</span>
                        : <button key={p}
                            onClick={() => setLogPage(p as number)}
                            className="w-7 h-7 rounded-lg text-xs border transition-all duration-150 hover:opacity-80 active:scale-95"
                            style={{
                              borderColor: logPage === p ? "oklch(0.65 0.18 200 / 0.6)" : "oklch(0.25 0.02 240)",
                              color: logPage === p ? "oklch(0.65 0.18 200)" : "oklch(0.55 0.01 240)",
                              background: logPage === p ? "oklch(0.65 0.18 200 / 0.12)" : "transparent",
                              fontWeight: logPage === p ? 700 : 400,
                            }}>
                            {p}
                          </button>
                    )}
                  <button
                    onClick={() => setLogPage(p => Math.min(totalPages, p + 1))}
                    disabled={logPage === totalPages}
                    className="px-2.5 py-1 rounded-lg text-xs border transition-all duration-150 disabled:opacity-30 hover:opacity-80 active:scale-95"
                    style={{ borderColor: "oklch(0.25 0.02 240)", color: "oklch(0.60 0.01 240)" }}>
                    {lang === "ko" ? "다음" : "Next"} ›
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        @keyframes sensorBlink {
          0%, 100% { box-shadow: 0 0 0 0 rgba(0,0,0,0); opacity: 1; }
          50% { box-shadow: 0 0 12px 4px currentColor; opacity: 0.75; }
        }
        @keyframes dangerFlashAnim {
          0%   { opacity: 1; }
          30%  { opacity: 0.8; }
          60%  { opacity: 0.4; }
          100% { opacity: 0; }
        }
      `}</style>
    </div>
  );
}

export default DashboardContent;
```

---

## 파일: client/src/pages/NotFound.tsx

```
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle, Home } from "lucide-react";
import { useLocation } from "wouter";

export default function NotFound() {
  const [, setLocation] = useLocation();

  const handleGoHome = () => {
    setLocation("/");
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
      <Card className="w-full max-w-lg mx-4 shadow-lg border-0 bg-white/80 backdrop-blur-sm">
        <CardContent className="pt-8 pb-8 text-center">
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div className="absolute inset-0 bg-red-100 rounded-full animate-pulse" />
              <AlertCircle className="relative h-16 w-16 text-red-500" />
            </div>
          </div>

          <h1 className="text-4xl font-bold text-slate-900 mb-2">404</h1>

          <h2 className="text-xl font-semibold text-slate-700 mb-4">
            Page Not Found
          </h2>

          <p className="text-slate-600 mb-8 leading-relaxed">
            Sorry, the page you are looking for doesn't exist.
            <br />
            It may have been moved or deleted.
          </p>

          <div
            id="not-found-button-group"
            className="flex flex-col sm:flex-row gap-3 justify-center"
          >
            <Button
              onClick={handleGoHome}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg transition-all duration-200 shadow-md hover:shadow-lg"
            >
              <Home className="w-4 h-4 mr-2" />
              Go Home
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

---

## 파일: client/src/components/DashboardLayout.tsx

```
import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { startLogin } from "@/const";
import { useIsMobile } from "@/hooks/useMobile";
import { LayoutDashboard, LogOut, PanelLeft, Users } from "lucide-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from './DashboardLayoutSkeleton';
import { Button } from "./ui/button";

const menuItems = [
  { icon: LayoutDashboard, label: "Page 1", path: "/" },
  { icon: Users, label: "Page 2", path: "/some-path" },
];

const SIDEBAR_WIDTH_KEY = "sidebar-width";
const DEFAULT_WIDTH = 280;
const MIN_WIDTH = 200;
const MAX_WIDTH = 480;

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const { loading, user } = useAuth();

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  if (loading) {
    return <DashboardLayoutSkeleton />
  }

  if (!user) {
    const [, setLocation] = useLocation();
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-8 p-8 max-w-md w-full">
          <div className="flex flex-col items-center gap-6">
            <h1 className="text-2xl font-semibold tracking-tight text-center">
              Sign in to continue
            </h1>
            <p className="text-sm text-muted-foreground text-center max-w-sm">
              Access to this dashboard requires authentication. Continue to launch the login flow.
            </p>
          </div>
          <Button
            onClick={() => setLocation("/login")}
            size="lg"
            className="w-full shadow-lg hover:shadow-xl transition-all"
          >
            Sign in
          </Button>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": `${sidebarWidth}px`,
        } as CSSProperties
      }
    >
      <DashboardLayoutContent setSidebarWidth={setSidebarWidth}>
        {children}
      </DashboardLayoutContent>
    </SidebarProvider>
  );
}

type DashboardLayoutContentProps = {
  children: React.ReactNode;
  setSidebarWidth: (width: number) => void;
};

function DashboardLayoutContent({
  children,
  setSidebarWidth,
}: DashboardLayoutContentProps) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const activeMenuItem = menuItems.find(item => item.path === location);
  const isMobile = useIsMobile();

  useEffect(() => {
    if (isCollapsed) {
      setIsResizing(false);
    }
  }, [isCollapsed]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      const sidebarLeft = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const newWidth = e.clientX - sidebarLeft;
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) {
        setSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth]);

  return (
    <>
      <div className="relative" ref={sidebarRef}>
        <Sidebar
          collapsible="icon"
          className="border-r-0"
          disableTransition={isResizing}
        >
          <SidebarHeader className="h-16 justify-center">
            <div className="flex items-center gap-3 px-2 transition-all w-full">
              <button
                onClick={toggleSidebar}
                className="h-8 w-8 flex items-center justify-center hover:bg-accent rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring shrink-0"
                aria-label="Toggle navigation"
              >
                <PanelLeft className="h-4 w-4 text-muted-foreground" />
              </button>
              {!isCollapsed ? (
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-semibold tracking-tight truncate">
                    Navigation
                  </span>
                </div>
              ) : null}
            </div>
          </SidebarHeader>

          <SidebarContent className="gap-0">
            <SidebarMenu className="px-2 py-1">
              {menuItems.map(item => {
                const isActive = location === item.path;
                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      isActive={isActive}
                      onClick={() => setLocation(item.path)}
                      tooltip={item.label}
                      className={`h-10 transition-all font-normal`}
                    >
                      <item.icon
                        className={`h-4 w-4 ${isActive ? "text-primary" : ""}`}
                      />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarContent>

          <SidebarFooter className="p-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 rounded-lg px-1 py-1 hover:bg-accent/50 transition-colors w-full text-left group-data-[collapsible=icon]:justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <Avatar className="h-9 w-9 border shrink-0">
                    <AvatarFallback className="text-xs font-medium">
                      {user?.name?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
                    <p className="text-sm font-medium truncate leading-none">
                      {user?.name || "-"}
                    </p>
                    <p className="text-xs text-muted-foreground truncate mt-1.5">
                      {user?.email || "-"}
                    </p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem
                  onClick={logout}
                  className="cursor-pointer text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Sign out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>
        <div
          className={`absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary/20 transition-colors ${isCollapsed ? "hidden" : ""}`}
          onMouseDown={() => {
            if (isCollapsed) return;
            setIsResizing(true);
          }}
          style={{ zIndex: 50 }}
        />
      </div>

      <SidebarInset>
        {isMobile && (
          <div className="flex border-b h-14 items-center justify-between bg-background/95 px-2 backdrop-blur supports-[backdrop-filter]:backdrop-blur sticky top-0 z-40">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="h-9 w-9 rounded-lg bg-background" />
              <div className="flex items-center gap-3">
                <div className="flex flex-col gap-1">
                  <span className="tracking-tight text-foreground">
                    {activeMenuItem?.label ?? "Menu"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
        <main className="flex-1 p-4">{children}</main>
      </SidebarInset>
    </>
  );
}
```

---

## 파일: client/src/lib/trpc.ts

```
import { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "../../../server/routers";

export const trpc = createTRPCReact<AppRouter>();
```

---

## 파일: client/src/contexts/ThemeContext.tsx

```
import React, { createContext, useContext, useEffect, useState } from "react";

type Theme = "light" | "dark";

interface ThemeContextType {
  theme: Theme;
  toggleTheme?: () => void;
  switchable: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: Theme;
  switchable?: boolean;
}

export function ThemeProvider({
  children,
  defaultTheme = "light",
  switchable = false,
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(() => {
    if (switchable) {
      const stored = localStorage.getItem("theme");
      return (stored as Theme) || defaultTheme;
    }
    return defaultTheme;
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }

    if (switchable) {
      localStorage.setItem("theme", theme);
    }
  }, [theme, switchable]);

  const toggleTheme = switchable
    ? () => {
        setTheme(prev => (prev === "light" ? "dark" : "light"));
      }
    : undefined;

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, switchable }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
```

---

## 파일: client/index.html

```
<!doctype html>
<html lang="en">

  <head>
    <meta charset="UTF-8" />
    <meta
      name="viewport"
      content="width=device-width, initial-scale=1.0, maximum-scale=1" />
    <title>SemiGuard AI</title>    
    <!-- THIS IS THE START OF A COMMENT BLOCK, BLOCK TO BE DELETED: Google Fonts here, example:
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
    THIS IS THE END OF A COMMENT BLOCK, BLOCK TO BE DELETED -->
  </head>

  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
    <script
      defer
      src="%VITE_ANALYTICS_ENDPOINT%/umami"
      data-website-id="%VITE_ANALYTICS_WEBSITE_ID%"></script>
  </body>

</html>
```

---

## 파일: client/src/index.css

```
@import "tailwindcss";
@import "tw-animate-css";
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');

@custom-variant dark (&:is(.dark *));

@theme inline {
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --color-chart-1: var(--chart-1);
  --color-chart-2: var(--chart-2);
  --color-chart-3: var(--chart-3);
  --color-chart-4: var(--chart-4);
  --color-chart-5: var(--chart-5);
  --color-sidebar: var(--sidebar);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar-primary: var(--sidebar-primary);
  --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
  --color-sidebar-accent: var(--sidebar-accent);
  --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
  --color-sidebar-border: var(--sidebar-border);
  --color-sidebar-ring: var(--sidebar-ring);
  --font-sans: 'Inter', sans-serif;
  --font-mono: 'JetBrains Mono', monospace;
}

:root {
  /* 다크 산업용 테마 */
  --background: oklch(0.10 0.01 240);
  --foreground: oklch(0.95 0.01 240);
  --card: oklch(0.14 0.015 240);
  --card-foreground: oklch(0.95 0.01 240);
  --popover: oklch(0.14 0.015 240);
  --popover-foreground: oklch(0.95 0.01 240);
  --primary: oklch(0.65 0.18 200);
  --primary-foreground: oklch(0.10 0.01 240);
  --secondary: oklch(0.20 0.02 240);
  --secondary-foreground: oklch(0.85 0.01 240);
  --muted: oklch(0.18 0.015 240);
  --muted-foreground: oklch(0.55 0.01 240);
  --accent: oklch(0.65 0.18 200);
  --accent-foreground: oklch(0.10 0.01 240);
  --destructive: oklch(0.577 0.245 27.325);
  --destructive-foreground: oklch(0.985 0 0);
  --border: oklch(0.22 0.02 240);
  --input: oklch(0.20 0.02 240);
  --ring: oklch(0.65 0.18 200);
  --chart-1: oklch(0.65 0.18 200);
  --chart-2: oklch(0.65 0.15 145);
  --chart-3: oklch(0.75 0.17 85);
  --chart-4: oklch(0.70 0.20 50);
  --chart-5: oklch(0.65 0.22 25);
  --radius: 0.625rem;
  --sidebar: oklch(0.12 0.015 240);
  --sidebar-foreground: oklch(0.95 0.01 240);
  --sidebar-primary: oklch(0.65 0.18 200);
  --sidebar-primary-foreground: oklch(0.10 0.01 240);
  --sidebar-accent: oklch(0.18 0.02 240);
  --sidebar-accent-foreground: oklch(0.85 0.01 240);
  --sidebar-border: oklch(0.22 0.02 240);
  --sidebar-ring: oklch(0.65 0.18 200);
}

@layer base {
  * { @apply border-border; }
  body {
    @apply bg-background text-foreground;
    font-family: 'Inter', sans-serif;
  }
}

/* 스크롤바 */
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: oklch(0.14 0.015 240); }
::-webkit-scrollbar-thumb { background: oklch(0.30 0.02 240); border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: oklch(0.40 0.03 240); }

/* 위험도 색상 */
.risk-normal  { color: #22c55e; }
.risk-caution { color: #eab308; }
.risk-warning { color: #f97316; }
.risk-danger  { color: #ef4444; }

/* 경고 깜빡임 */
@keyframes blink-danger {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.25; }
}
.animate-blink { animation: blink-danger 0.7s ease-in-out infinite; }

/* Heartbeat 펄스 */
@keyframes pulse-green {
  0%, 100% { box-shadow: 0 0 0 0 #22c55e50; }
  50% { box-shadow: 0 0 0 7px #22c55e00; }
}
.animate-pulse-green { animation: pulse-green 1.5s ease-in-out infinite; }

/* 위험 펄스 */
@keyframes pulse-red {
  0%, 100% { box-shadow: 0 0 0 0 #ef444450; }
  50% { box-shadow: 0 0 0 9px #ef444400; }
}
.animate-pulse-red { animation: pulse-red 0.6s ease-in-out infinite; }

/* 글로우 효과 */
.glow-green { box-shadow: 0 0 12px #22c55e60, 0 0 24px #22c55e30; }
.glow-yellow { box-shadow: 0 0 12px #eab30860, 0 0 24px #eab30830; }
.glow-orange { box-shadow: 0 0 12px #f9731660, 0 0 24px #f9731630; }
.glow-red { box-shadow: 0 0 16px #ef444470, 0 0 32px #ef444440; }

/* 팝업 애니메이션 */
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(30px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
```
