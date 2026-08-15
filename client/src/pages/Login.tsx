import { startGoogleLogin, startNaverLogin, startKakaoLogin } from "@/const";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLocation } from "wouter";
import { useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useEffect } from "react";

export function Login() {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();

  const loginLanguage = (() => {
    try {
      const saved = window.localStorage.getItem("semiguard_lang");
      return saved === "en" || saved === "ja" ? saved : "ko";
    } catch {
      return "ko";
    }
  })();

  useEffect(() => {
    const metadata = loginLanguage === "ja"
      ? {
          locale: "ja-JP",
          title: "SemiGuard AI | 半導体装置の予知安全モニタリング",
          description: "SemiGuard AIは、半導体製造装置の電流・温度・振動・騒音センサーデータをリアルタイム分析し、故障の兆候を早期に検知してLLMで原因を診断する予知安全ソリューションです。",
          keywords: "SemiGuard AI, 半導体予知保全, 異常検知, センサーモニタリング, 予知安全システム",
        }
      : loginLanguage === "en"
        ? {
            locale: "en-US",
            title: "SemiGuard AI | Semiconductor Predictive Safety Monitoring",
            description: "SemiGuard AI analyzes current, temperature, vibration, and noise sensor data from semiconductor equipment in real time to detect early fault signals and diagnose causes with LLM assistance.",
            keywords: "SemiGuard AI, semiconductor predictive maintenance, anomaly detection, sensor monitoring, predictive safety",
          }
        : {
            locale: "ko-KR",
            title: "SemiGuard AI - 반도체 장비 실시간 AI 예지보전 및 이상탐지 시스템",
            description: "SemiGuard AI는 반도체 제조 장비의 전류, 온도, 진동, 소음 센서 데이터를 Isolation Forest AI로 실시간 분석하여 고장 징후를 조기에 탐지하고 LLM으로 원인을 진단하는 스마트 예지안전 솔루션입니다.",
            keywords: "SemiGuard AI, 반도체 예지보전, 이상탐지, 센서 모니터링, 예지안전 시스템",
          };

    document.documentElement.lang = metadata.locale;
    document.title = metadata.title;

    let metaDesc = document.querySelector('meta[name="description"]');
    if (!metaDesc) {
      metaDesc = document.createElement('meta');
      metaDesc.setAttribute('name', 'description');
      document.head.appendChild(metaDesc);
    }
    metaDesc.setAttribute('content', metadata.description);

    let metaKw = document.querySelector('meta[name="keywords"]');
    if (!metaKw) {
      metaKw = document.createElement('meta');
      metaKw.setAttribute('name', 'keywords');
      document.head.appendChild(metaKw);
    }
    metaKw.setAttribute('content', metadata.keywords);
  }, [loginLanguage]);
  const [badgeNumber, setBadgeNumber] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const oauthError = new URLSearchParams(window.location.search).get("oauth_error");
  const oauthParts = oauthError?.split("_") ?? [];
  const oauthProvider = oauthParts[0];
  const oauthReason = oauthParts.slice(1).join("_");
  const oauthProviderLabel = oauthProvider === "google" ? "Google" : oauthProvider === "naver" ? "Naver" : oauthProvider === "kakao" ? "Kakao" : loginLanguage === "ja" ? "ソーシャルログイン" : loginLanguage === "en" ? "Social login" : "소셜 로그인";
  const oauthPolicyMessage = (() => {
    if (oauthReason === "unlinked") {
      if (loginLanguage === "ja") return `${oauthProviderLabel}アカウントはまだ連携されていません。先に社員証番号とパスワードで登録・ログインし、ダッシュボードメニューから連携してください。`;
      if (loginLanguage === "en") return `Your ${oauthProviderLabel} account is not linked yet. Sign up or sign in with your badge number and password, then link it from the dashboard menu.`;
      return `${oauthProviderLabel} 계정이 아직 연결되지 않았습니다. 먼저 회사 명찰 번호와 비밀번호로 회원가입·로그인한 뒤 대시보드 메뉴에서 연결해주세요.`;
    }
    if (oauthReason === "link_required") {
      if (loginLanguage === "ja") return "ソーシャルアカウントを連携するには、先に社員証番号とパスワードでログインしてください。";
      if (loginLanguage === "en") return "Sign in with your badge number and password before linking a social account.";
      return "소셜 계정을 연결하려면 먼저 회사 명찰 번호와 비밀번호로 로그인해주세요.";
    }
    if (oauthReason === "already_linked") {
      if (loginLanguage === "ja") return "このソーシャルアカウントはすでに別のSemiGuardアカウントに連携されています。";
      if (loginLanguage === "en") return "This social account is already linked to another SemiGuard account.";
      return "이 소셜 계정은 이미 다른 SemiGuard 계정에 연결되어 있습니다.";
    }
    if (oauthProvider === "kakao") {
      if (loginLanguage === "ja") return "Kakaoログインに失敗しました。カカオデベロッパーでKakaoログイン、リダイレクトURI、プロフィールの同意項目を確認してから、しばらくして再試行してください。";
      if (loginLanguage === "en") return "Kakao login failed. Check Kakao Login activation, the redirect URI, and profile-consent settings in Kakao Developers, then try again.";
      return "Kakao 로그인에 실패했습니다. 카카오 디벨로퍼스에서 카카오 로그인 활성화, 리다이렉트 URI, 프로필 닉네임 동의항목을 확인한 뒤 잠시 후 다시 시도해주세요.";
    }
    if (loginLanguage === "ja") return `${oauthProviderLabel}ログインに失敗しました。提供元のアプリ設定または登録済みのログインアカウントを確認してから再試行してください。`;
    if (loginLanguage === "en") return `${oauthProviderLabel} login failed. Check the provider app settings or registered login account, then try again.`;
    return `${oauthProviderLabel} 로그인에 실패했습니다. 제공자의 앱 설정 또는 등록된 로그인 계정을 확인한 뒤 다시 시도해주세요.`;
  })();
  const loginMessages = loginLanguage === "ja"
    ? {
        previewSocialDisabled: "開発プレビューではソーシャルログインを利用できません。公開サイトで利用してください。",
        badgeRequired: "社員証番号を入力してください。",
        passwordRequired: "パスワードを入力してください。",
        failed: "ログインに失敗しました。社員証番号またはパスワードを確認してください。",
        succeeded: "ログインが完了しました。",
      }
    : loginLanguage === "en"
      ? {
          previewSocialDisabled: "Social login is unavailable in the development preview. Please use the published site.",
          badgeRequired: "Enter your badge number.",
          passwordRequired: "Enter your password.",
          failed: "Login failed. Check your badge number or password.",
          succeeded: "Login successful.",
        }
      : {
          previewSocialDisabled: "개발 미리보기에서는 소셜 로그인을 사용할 수 없습니다. 배포된 사이트에서 이용해주세요.",
          badgeRequired: "회사 명찰 번호를 입력해주세요.",
          passwordRequired: "비밀번호를 입력해주세요.",
          failed: "로그인 실패: 명찰 번호 또는 비밀번호를 확인해주세요.",
          succeeded: "로그인이 완료되었습니다!",
        };
  const isOauthEnabled = !import.meta.env.DEV;
  const handleSocialLogin = (start: () => void) => {
    if (!isOauthEnabled) {
      toast.info(loginMessages.previewSocialDisabled);
      return;
    }
    start();
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!badgeNumber.trim()) {
      toast.error(loginMessages.badgeRequired);
      return;
    }
    if (!password) {
      toast.error(loginMessages.passwordRequired);
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch("/api/trpc/auth.login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          json: {
            badgeNumber: badgeNumber.trim(),
            password,
          },
        }),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok || payload?.error) {
        const message = payload?.error?.json?.message ?? payload?.error?.message;
        throw new Error(message || loginMessages.failed);
      }

      toast.success(loginMessages.succeeded);
      // 캐시를 무효화하고 대시보드로 이동
      await utils.auth.me.invalidate();
      window.location.href = "/";
    } catch (error) {
      console.error("Login error:", error);
      toast.error(loginMessages.failed);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 px-4 py-8 sm:py-12">
      <Card className="w-full max-w-md p-6 sm:p-8 bg-slate-800/90 border-slate-700 shadow-2xl">
        <div className="space-y-6">
          {/* Header */}
          <div className="text-center space-y-3">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-600 text-2xl shadow-lg">
              🛡️
            </div>
            <div className="space-y-1">
              <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">SemiGuard AI</h1>
              <h2 className="text-slate-400 text-xs sm:text-sm font-normal m-0">반도체 장비 예지안전 시스템</h2>
            </div>
          </div>

          {oauthError && (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200" role="alert">
              {oauthPolicyMessage}
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleLogin} className="space-y-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">사번 로그인</p>
            {/* Badge Number */}
            <div className="space-y-2">
              <Label htmlFor="badgeNumber" className="text-slate-300 text-sm font-medium">
                회사 명찰 번호
              </Label>
              <Input
                id="badgeNumber"
                type="text"
                placeholder="예: EMP-2024-001"
                value={badgeNumber}
                onChange={(e) => setBadgeNumber(e.target.value)}
                autoComplete="username"
                inputMode="text"
                className="h-12 bg-slate-700/70 border-slate-600 text-white placeholder-slate-500 text-base"
                disabled={isLoading}
              />
            </div>

            {/* Password */}
            <div className="space-y-2">
              <Label htmlFor="password" className="text-slate-300 text-sm font-medium">
                비밀번호
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="비밀번호 입력"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                className="h-12 bg-slate-700/70 border-slate-600 text-white placeholder-slate-500 text-base"
                disabled={isLoading}
              />
            </div>

            {/* Login Button */}
            <Button
              type="submit"
              disabled={isLoading}
              className="w-full h-12 bg-cyan-500 hover:bg-cyan-600 text-white font-bold text-base transition-transform duration-150 active:scale-[0.98]"
            >
              {isLoading ? "로그인 중..." : "로그인"}
            </Button>
          </form>

          {/* Signup Link */}
          <div className="text-center">
            <p className="text-slate-400 text-sm">
              계정이 없으신가요?{" "}
              <button
                type="button"
                onClick={() => setLocation("/signup")}
                className="text-cyan-400 hover:text-cyan-300 font-semibold transition-colors"
              >
                회원가입
              </button>
            </p>
          </div>

          {/* Divider - Social Login */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-600"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-3 bg-slate-800 text-slate-400 text-xs">연결된 소셜 계정으로 로그인</span>
            </div>
          </div>

          {!isOauthEnabled && (
            <div className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-4 py-3 text-xs leading-relaxed text-cyan-100" role="status">
              개발 미리보기에서는 OAuth 제공자의 등록된 콜백 주소와 달라 소셜 로그인을 잠시 비활성화했습니다. 실제 소셜 로그인은 배포된 사이트에서 이용해주세요.
            </div>
          )}

          {/* Social Login Buttons */}
          <div className="space-y-2.5">
            {/* Google Login */}
            <Button
              type="button"
              onClick={() => handleSocialLogin(startGoogleLogin)}
              disabled={!isOauthEnabled}
              title={!isOauthEnabled ? "배포된 사이트에서 소셜 로그인을 이용해주세요." : undefined}
              className={`w-full h-12 justify-start gap-3 px-4 bg-white hover:bg-slate-100 text-slate-900 font-semibold text-sm transition-transform duration-150 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50${!isOauthEnabled ? " opacity-50 grayscale cursor-not-allowed" : ""}`}
            >
              <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              <span className="flex-1 text-left">Google로 로그인</span>
            </Button>

            {/* Naver Login */}
            <Button
              type="button"
              onClick={() => handleSocialLogin(startNaverLogin)}
              disabled={!isOauthEnabled}
              title={!isOauthEnabled ? "배포된 사이트에서 소셜 로그인을 이용해주세요." : undefined}
              className={`w-full h-12 justify-start gap-3 px-4 bg-[#03C75A] hover:bg-[#02B350] text-white font-semibold text-sm transition-transform duration-150 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50${!isOauthEnabled ? " opacity-50 grayscale cursor-not-allowed" : ""}`}
            >
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-sm bg-white text-[13px] font-black leading-none text-[#03C75A]" aria-hidden="true">
                N
              </span>
              <span className="flex-1 text-left">네이버로 로그인</span>
            </Button>

            {/* Kakao Login */}
            <Button
              type="button"
              onClick={() => handleSocialLogin(startKakaoLogin)}
              disabled={!isOauthEnabled}
              title={!isOauthEnabled ? "배포된 사이트에서 소셜 로그인을 이용해주세요." : undefined}
              className={`w-full h-12 justify-start gap-3 px-4 bg-[#FEE500] hover:bg-[#F2DA00] text-[#191600] font-semibold text-sm transition-transform duration-150 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50${!isOauthEnabled ? " opacity-50 grayscale cursor-not-allowed" : ""}`}
            >
              <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 3C6.9 3 2.8 6.2 2.8 10.2c0 2.5 1.7 4.7 4.2 6L6.1 20c-.1.4.3.7.6.5l4.2-2.8c.4 0 .7.1 1.1.1 5.1 0 9.2-3.2 9.2-7.6C21.2 6.2 17.1 3 12 3z" />
              </svg>
              <span className="flex-1 text-left">카카오로 로그인</span>
            </Button>
          </div>

          <p className="text-center text-[11px] leading-relaxed text-slate-500">
            소셜 로그인은 회원가입 후 대시보드 메뉴에서 계정을 연결한 뒤 사용할 수 있습니다.
          </p>

          {/* Footer */}
          <p className="text-center text-xs text-slate-500">
            로그인하면 서비스 이용약관에 동의하는 것입니다.
          </p>
        </div>
      </Card>
    </div>
  );
}
