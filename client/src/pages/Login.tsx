import { startGoogleLogin, startNaverLogin, startKakaoLogin } from "@/const";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLocation } from "wouter";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useEffect } from "react";

export function Login() {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();

  const [loginLanguage, setLoginLanguage] = useState<"ko" | "en" | "ja">(() => {
    try {
      const saved = window.localStorage.getItem("semiguard_lang");
      return saved === "en" || saved === "ja" ? saved : "ko";
    } catch {
      return "ko";
    }
  });
  const selectLoginLanguage = (nextLanguage: "ko" | "en" | "ja") => {
    setLoginLanguage(nextLanguage);
    try {
      window.localStorage.setItem("semiguard_lang", nextLanguage);
    } catch {
      // 저장소가 제한된 환경에서는 현재 로그인 화면에서만 언어 선택을 적용한다.
    }
  };

  useEffect(() => {
    const metadata = loginLanguage === "ja"
      ? {
          locale: "ja-JP",
          title: "SemiGuard AI | 半導体装置の予知安全モニタリング",
          description: "SemiGuard AIは、半導体装置の電流・温度・振動・騒音の偏差をz-scoreベースの危険信号として整理し、読み取り専用でLLM補助の点検説明を提供します。",
          keywords: "SemiGuard AI, 半導体予知保全, 異常検知, センサーモニタリング, 予知安全システム",
        }
      : loginLanguage === "en"
        ? {
            locale: "en-US",
            title: "SemiGuard AI | Semiconductor Predictive Safety Monitoring",
            description: "SemiGuard AI organizes current, temperature, vibration, and noise deviations into z-score risk signals, with LLM-assisted inspection explanations in a read-only workflow.",
            keywords: "SemiGuard AI, semiconductor predictive maintenance, anomaly detection, sensor monitoring, predictive safety",
          }
        : {
            locale: "ko-KR",
            title: "SemiGuard AI - 반도체 장비 실시간 AI 예지보전 및 이상탐지 시스템",
            description: "SemiGuard AI는 반도체 장비의 전류·온도·진동·소음 편차를 z-score 기반 위험 신호로 정리하고, 읽기 전용 환경에서 LLM 보조 점검 설명을 제공하는 예지안전 시스템입니다.",
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
  const [fieldError, setFieldError] = useState<"badge" | "password" | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [capsLockOn, setCapsLockOn] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const oauthError = new URLSearchParams(window.location.search).get("oauth_error");
  const oauthParts = oauthError?.split("_") ?? [];
  const oauthProvider = oauthParts[0];
  const oauthReason = oauthParts.slice(1).join("_");
  const oauthProviderLabel = oauthProvider === "google" ? "Google" : oauthProvider === "naver" ? "Naver" : oauthProvider === "kakao" ? "Kakao" : loginLanguage === "ja" ? "ソーシャルログイン" : loginLanguage === "en" ? "Social login" : "소셜 로그인";
  const [showOauthError, setShowOauthError] = useState(() => Boolean(oauthError));
  const oauthErrorPreviousFocusRef = useRef<HTMLElement | null>(null);
  const oauthErrorCloseButtonRef = useRef<HTMLButtonElement | null>(null);
  const oauthErrorRetryButtonRef = useRef<HTMLButtonElement | null>(null);
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
  const loginUi = loginLanguage === "ja"
    ? {
        subtitle: "半導体装置予知安全システム",
        employeeLogin: "社員証番号ログイン",
        badgeLabel: "社員証番号",
        badgePlaceholder: "例: EMP-2024-001",
        passwordLabel: "パスワード",
        passwordPlaceholder: "パスワードを入力",
        showPassword: "パスワードを表示",
        hidePassword: "パスワードを隠す",
        capsLockWarning: "Caps Lockがオンになっています。",
        signingIn: "ログイン中…",
        signIn: "ログイン",
        noAccount: "アカウントをお持ちでないですか?",
        signUp: "新規登録",
        linkedSocialLogin: "連携済みソーシャルアカウントでログイン",
        previewSocialNotice: "開発プレビューでは、OAuth提供元に登録されたコールバックURLと異なるためソーシャルログインを一時的に無効化しています。実際のソーシャルログインは公開サイトで利用してください。",
        publishedSiteOnly: "公開サイトでソーシャルログインを利用してください。",
        googleLogin: "Googleでログイン",
        naverLogin: "Naverでログイン",
        kakaoLogin: "Kakaoでログイン",
        socialLinkHint: "ソーシャルログインは、新規登録後にダッシュボードメニューからアカウントを連携して利用できます。",
        judgeDemo: "審査用デモを見る",
        judgeDemoHint: "ログイン不要・読み取り専用・サンプルデータ",
        terms: "ログインすると利用規約に同意したものとみなされます。",
      }
    : loginLanguage === "en"
      ? {
          subtitle: "Semiconductor Predictive Safety System",
          employeeLogin: "Badge number sign-in",
          badgeLabel: "Company badge number",
          badgePlaceholder: "e.g. EMP-2024-001",
          passwordLabel: "Password",
          passwordPlaceholder: "Enter password",
          showPassword: "Show password",
          hidePassword: "Hide password",
          capsLockWarning: "Caps Lock is on.",
          signingIn: "Signing in…",
          signIn: "Sign in",
          noAccount: "Don't have an account?",
          signUp: "Sign up",
          linkedSocialLogin: "Sign in with a linked social account",
          previewSocialNotice: "Social login is temporarily disabled in the development preview because its callback URL differs from the registered OAuth provider URL. Please use the published site.",
          publishedSiteOnly: "Use the published site for social login.",
          googleLogin: "Continue with Google",
          naverLogin: "Continue with Naver",
          kakaoLogin: "Continue with Kakao",
          socialLinkHint: "After signing up, link a social account from the dashboard menu to use social login.",
          judgeDemo: "View judge demo",
          judgeDemoHint: "No sign-in · Read-only · Sample data",
          terms: "By signing in, you agree to the Terms of Service.",
        }
      : {
          subtitle: "반도체 장비 예지안전 시스템",
          employeeLogin: "사번 로그인",
          badgeLabel: "회사 명찰 번호",
          badgePlaceholder: "예: EMP-2024-001",
          passwordLabel: "비밀번호",
          passwordPlaceholder: "비밀번호 입력",
          showPassword: "비밀번호 표시",
          hidePassword: "비밀번호 숨기기",
          capsLockWarning: "Caps Lock이 켜져 있습니다.",
          signingIn: "로그인 중...",
          signIn: "로그인",
          noAccount: "계정이 없으신가요?",
          signUp: "회원가입",
          linkedSocialLogin: "연결된 소셜 계정으로 로그인",
          previewSocialNotice: "개발 미리보기에서는 OAuth 제공자의 등록된 콜백 주소와 달라 소셜 로그인을 잠시 비활성화했습니다. 실제 소셜 로그인은 배포된 사이트에서 이용해주세요.",
          publishedSiteOnly: "배포된 사이트에서 소셜 로그인을 이용해주세요.",
          googleLogin: "Google로 로그인",
          naverLogin: "네이버로 로그인",
          kakaoLogin: "카카오로 로그인",
          socialLinkHint: "소셜 로그인은 회원가입 후 대시보드 메뉴에서 계정을 연결한 뒤 사용할 수 있습니다.",
          judgeDemo: "심사위원 데모 바로가기",
          judgeDemoHint: "로그인 없이 · 읽기 전용 · 가상 데이터",
          terms: "로그인하면 서비스 이용약관에 동의하는 것입니다.",
        };
  const isOauthEnabled = !import.meta.env.DEV;
  const handleSocialLogin = (start: () => void) => {
    if (!isOauthEnabled) {
      toast.info(loginMessages.previewSocialDisabled);
      return;
    }
    start();
  };
  const dismissOauthError = () => {
    setShowOauthError(false);
    const nextUrl = new URL(window.location.href);
    nextUrl.searchParams.delete("oauth_error");
    window.history.replaceState({}, document.title, `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`);
  };
  const retryOauthLogin = () => {
    dismissOauthError();
    if (oauthProvider === "google") handleSocialLogin(startGoogleLogin);
    if (oauthProvider === "naver") handleSocialLogin(startNaverLogin);
    if (oauthProvider === "kakao") handleSocialLogin(startKakaoLogin);
  };
  useEffect(() => {
    if (!showOauthError || !oauthError) return;
    oauthErrorPreviousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusFrame = window.requestAnimationFrame(() => {
      const retryButton = oauthErrorRetryButtonRef.current;
      (retryButton && !retryButton.disabled ? retryButton : oauthErrorCloseButtonRef.current)?.focus();
    });

    return () => {
      window.cancelAnimationFrame(focusFrame);
      const previousFocus = oauthErrorPreviousFocusRef.current;
      if (previousFocus && document.contains(previousFocus)) previousFocus.focus();
    };
  }, [oauthError, showOauthError]);
  const oauthDialogUi = loginLanguage === "ja"
    ? { title: "ソーシャルログインを完了できませんでした", retry: "もう一度試す", close: "閉じる", hint: "アカウント連携と提供元の設定を確認した後、もう一度安全に接続できます。" }
    : loginLanguage === "en"
      ? { title: "Social sign-in could not be completed", retry: "Try again", close: "Close", hint: "After checking the linked account and provider settings, you can reconnect safely." }
      : { title: "소셜 로그인을 완료하지 못했습니다", retry: "다시 시도", close: "닫기", hint: "연결된 계정과 제공자 설정을 확인한 뒤 안전하게 다시 연결할 수 있습니다." };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);

    if (!badgeNumber.trim()) {
      setFieldError("badge");
      toast.error(loginMessages.badgeRequired);
      window.requestAnimationFrame(() => document.getElementById("badgeNumber")?.focus());
      return;
    }
    if (!password) {
      setFieldError("password");
      toast.error(loginMessages.passwordRequired);
      window.requestAnimationFrame(() => document.getElementById("password")?.focus());
      return;
    }

    setFieldError(null);

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
      setAuthError(loginMessages.failed);
      toast.error(loginMessages.failed);
      window.requestAnimationFrame(() => document.getElementById("password")?.focus());
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 px-4 py-8 sm:py-12">
      <Card className="w-full max-w-md p-6 sm:p-8 bg-slate-800/90 border-slate-700 shadow-2xl">
        <div className="space-y-6">
          <div className="flex justify-end" role="group" aria-label={loginLanguage === "ja" ? "表示言語" : loginLanguage === "en" ? "Display language" : "표시 언어"}>
            <div className="inline-flex rounded-lg border border-slate-700 bg-slate-900/60 p-1">
              {([
                ["ko", "한국어"],
                ["en", "EN"],
                ["ja", "日本語"],
              ] as const).map(([language, label]) => (
                <button
                  key={language}
                  type="button"
                  onClick={() => selectLoginLanguage(language)}
                  aria-pressed={loginLanguage === language}
                  className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-800 ${loginLanguage === language ? "bg-cyan-500 text-slate-950" : "text-slate-400 hover:bg-slate-800 hover:text-slate-100"}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Header */}
          <div className="text-center space-y-3">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-600 text-2xl shadow-lg">
              🛡️
            </div>
            <div className="space-y-1">
              <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">SemiGuard AI</h1>
              <h2 className="text-slate-400 text-xs sm:text-sm font-normal m-0">{loginUi.subtitle}</h2>
            </div>
          </div>

          {showOauthError && oauthError && (
            <div className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/70 p-4 backdrop-blur-sm sm:items-center" role="presentation">
              <section className="w-full max-w-md rounded-2xl border border-amber-400/45 bg-slate-900 p-5 text-slate-100 shadow-2xl shadow-black/50 motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95" role="alertdialog" aria-modal="true" aria-labelledby="oauth-error-title" aria-describedby="oauth-error-message" onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); dismissOauthError(); } }}>
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-400/40 bg-amber-400/10 text-lg" aria-hidden="true">!</span>
                  <div className="min-w-0 space-y-1">
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-amber-300">{oauthProviderLabel}</p>
                    <h3 id="oauth-error-title" className="text-base font-bold">{oauthDialogUi.title}</h3>
                  </div>
                </div>
                <p id="oauth-error-message" className="mt-4 text-sm leading-6 text-slate-300">{oauthPolicyMessage}</p>
                <p className="mt-3 rounded-lg border border-slate-700 bg-slate-950/55 px-3 py-2 text-xs leading-5 text-slate-400">{oauthDialogUi.hint}</p>
                <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <Button type="button" ref={oauthErrorCloseButtonRef} variant="outline" onClick={dismissOauthError} className="border-slate-600 text-slate-200 hover:bg-slate-800">{oauthDialogUi.close}</Button>
                  <Button type="button" ref={oauthErrorRetryButtonRef} onClick={retryOauthLogin} disabled={!isOauthEnabled || !["google", "naver", "kakao"].includes(oauthProvider)} className="bg-amber-400 font-bold text-slate-950 hover:bg-amber-300 disabled:opacity-50">{oauthDialogUi.retry}</Button>
                </div>
              </section>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleLogin} className="space-y-4" aria-busy={isLoading}>
            {authError && <p id="login-auth-error" className="rounded-lg border border-rose-400/45 bg-rose-500/10 px-3 py-2 text-sm font-medium text-rose-200" role="alert">{authError}</p>}
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{loginUi.employeeLogin}</p>
            {/* Badge Number */}
            <div className="space-y-2">
              <Label htmlFor="badgeNumber" className="text-slate-300 text-sm font-medium">
                {loginUi.badgeLabel}
              </Label>
              <Input
                id="badgeNumber"
                type="text"
                placeholder={loginUi.badgePlaceholder}
                value={badgeNumber}
                onChange={(e) => {
                  setBadgeNumber(e.target.value);
                  if (fieldError === "badge") setFieldError(null);
                  if (authError) setAuthError(null);
                }}
                autoComplete="username"
                inputMode="text"
                aria-invalid={fieldError === "badge" || Boolean(authError)}
                aria-describedby={fieldError === "badge" ? "badgeNumber-error" : authError ? "login-auth-error" : undefined}
                className="h-12 bg-slate-700/70 border-slate-600 text-white placeholder-slate-500 text-base"
                disabled={isLoading}
              />
              {fieldError === "badge" && <p id="badgeNumber-error" className="text-xs font-medium text-rose-300" role="alert">{loginMessages.badgeRequired}</p>}
            </div>

            {/* Password */}
            <div className="space-y-2">
              <Label htmlFor="password" className="text-slate-300 text-sm font-medium">
                {loginUi.passwordLabel}
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder={loginUi.passwordPlaceholder}
                  value={password}
                  onChange={(e) => {
                  setPassword(e.target.value);
                  if (fieldError === "password") setFieldError(null);
                  if (authError) setAuthError(null);
                }}
                  onKeyDown={(event) => setCapsLockOn(event.getModifierState("CapsLock"))}
                  onKeyUp={(event) => setCapsLockOn(event.getModifierState("CapsLock"))}
                  onBlur={() => setCapsLockOn(false)}
                  autoComplete="current-password"
                  aria-invalid={fieldError === "password" || Boolean(authError)}
                  aria-describedby={fieldError === "password" ? "password-error" : authError ? "login-auth-error" : undefined}
                  className="h-12 bg-slate-700/70 border-slate-600 pr-24 text-white placeholder-slate-500 text-base"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((visible) => !visible)}
                  aria-label={showPassword ? loginUi.hidePassword : loginUi.showPassword}
                  aria-pressed={showPassword}
                  disabled={isLoading}
                  className="absolute inset-y-1 right-1 rounded px-3 text-xs font-semibold text-cyan-300 transition-colors hover:bg-slate-600 hover:text-cyan-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-inset disabled:opacity-50"
                >
                  {showPassword ? loginUi.hidePassword : loginUi.showPassword}
                </button>
              </div>
              {fieldError === "password" && <p id="password-error" className="text-xs font-medium text-rose-300" role="alert">{loginMessages.passwordRequired}</p>}
              {capsLockOn && <p className="text-xs font-medium text-amber-300" role="status">{loginUi.capsLockWarning}</p>}
            </div>

            {/* Login Button */}
            <Button
              type="submit"
              disabled={isLoading}
              className="w-full h-12 bg-cyan-500 hover:bg-cyan-600 text-white font-bold text-base transition-transform duration-150 active:scale-[0.98]"
            >
              {isLoading ? loginUi.signingIn : loginUi.signIn}
            </Button>
          </form>

          {/* Signup Link */}
          <div className="text-center">
            <p className="text-slate-400 text-sm">
              {loginUi.noAccount}{" "}
              <button
                type="button"
                onClick={() => setLocation("/signup")}
                className="text-cyan-400 hover:text-cyan-300 font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-800 rounded"
              >
                {loginUi.signUp}
              </button>
            </p>
            <button
              type="button"
              onClick={() => setLocation("/demo")}
              className="mt-3 inline-flex items-center gap-2 rounded-full border border-cyan-400/45 bg-cyan-400/10 px-3 py-1.5 text-xs font-bold text-cyan-200 transition-colors hover:bg-cyan-400/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-800"
            >
              <span aria-hidden="true">▸</span>
              {loginUi.judgeDemo}
              <span className="font-medium text-cyan-100/70">{loginUi.judgeDemoHint}</span>
            </button>
          </div>

          {/* Divider - Social Login */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-600"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-3 bg-slate-800 text-slate-400 text-xs">{loginUi.linkedSocialLogin}</span>
            </div>
          </div>

          {!isOauthEnabled && (
            <div id="preview-social-login-notice" className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-4 py-3 text-xs leading-relaxed text-cyan-100" role="status">
              {loginUi.previewSocialNotice}
            </div>
          )}

          {/* Social Login Buttons */}
          <div className="space-y-2.5" aria-label={loginUi.linkedSocialLogin}>
            {/* Google Login */}
            <Button
              type="button"
              onClick={() => handleSocialLogin(startGoogleLogin)}
              disabled={!isOauthEnabled}
              aria-describedby={!isOauthEnabled ? "preview-social-login-notice" : undefined}
              title={!isOauthEnabled ? loginUi.publishedSiteOnly : undefined}
              className={`group h-[3.25rem] w-full justify-start gap-3 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-900 shadow-sm transition-[transform,box-shadow,background-color] duration-200 hover:-translate-y-0.5 hover:bg-slate-50 hover:shadow-lg hover:shadow-slate-950/20 focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-800 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50${!isOauthEnabled ? " opacity-50 grayscale cursor-not-allowed" : ""}`}
            >
              <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              <span className="flex-1 text-left">{loginUi.googleLogin}</span><span className="text-[10px] font-semibold text-slate-400">OAuth</span>
            </Button>

            {/* Naver Login */}
            <Button
              type="button"
              onClick={() => handleSocialLogin(startNaverLogin)}
              disabled={!isOauthEnabled}
              aria-describedby={!isOauthEnabled ? "preview-social-login-notice" : undefined}
              title={!isOauthEnabled ? loginUi.publishedSiteOnly : undefined}
              className={`group h-[3.25rem] w-full justify-start gap-3 rounded-xl border border-emerald-300/50 bg-[#03C75A] px-4 text-sm font-bold text-white shadow-sm shadow-emerald-950/20 transition-[transform,box-shadow,background-color] duration-200 hover:-translate-y-0.5 hover:bg-[#02B350] hover:shadow-lg hover:shadow-emerald-950/30 focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-800 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50${!isOauthEnabled ? " opacity-50 grayscale cursor-not-allowed" : ""}`}
            >
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-sm bg-white text-[13px] font-black leading-none text-[#03C75A]" aria-hidden="true">
                N
              </span>
              <span className="flex-1 text-left">{loginUi.naverLogin}</span><span className="text-[10px] font-semibold text-white/70">OAuth</span>
            </Button>

            {/* Kakao Login */}
            <Button
              type="button"
              onClick={() => handleSocialLogin(startKakaoLogin)}
              disabled={!isOauthEnabled}
              aria-describedby={!isOauthEnabled ? "preview-social-login-notice" : undefined}
              title={!isOauthEnabled ? loginUi.publishedSiteOnly : undefined}
              className={`group h-[3.25rem] w-full justify-start gap-3 rounded-xl border border-[#ffe95c] bg-[#FEE500] px-4 text-sm font-bold text-[#191600] shadow-sm shadow-amber-950/20 transition-[transform,box-shadow,background-color] duration-200 hover:-translate-y-0.5 hover:bg-[#F2DA00] hover:shadow-lg hover:shadow-amber-950/30 focus-visible:ring-2 focus-visible:ring-yellow-200 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-800 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50${!isOauthEnabled ? " opacity-50 grayscale cursor-not-allowed" : ""}`}
            >
              <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 3C6.9 3 2.8 6.2 2.8 10.2c0 2.5 1.7 4.7 4.2 6L6.1 20c-.1.4.3.7.6.5l4.2-2.8c.4 0 .7.1 1.1.1 5.1 0 9.2-3.2 9.2-7.6C21.2 6.2 17.1 3 12 3z" />
              </svg>
              <span className="flex-1 text-left">{loginUi.kakaoLogin}</span><span className="text-[10px] font-semibold text-[#191600]/60">OAuth</span>
            </Button>
          </div>

          <p className="text-center text-[11px] leading-relaxed text-slate-500">
            {loginUi.socialLinkHint}
          </p>

          {/* Footer */}
          <p className="text-center text-xs text-slate-500">
            {loginUi.terms}
          </p>
        </div>
      </Card>
    </div>
  );
}
