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

  useEffect(() => {
    document.title = "SemiGuard AI - 반도체 장비 실시간 AI 예지보전 및 이상탐지 시스템";

    let metaDesc = document.querySelector('meta[name="description"]');
    if (!metaDesc) {
      metaDesc = document.createElement('meta');
      metaDesc.setAttribute('name', 'description');
      document.head.appendChild(metaDesc);
    }
    metaDesc.setAttribute('content', 'SemiGuard AI는 반도체 제조 장비의 전류, 온도, 진동, 소음 센서 데이터를 Isolation Forest AI로 실시간 분석하여 고장 징후를 조기에 탐지하고 LLM으로 원인을 진단하는 스마트 예지안전 솔루션입니다.');

    let metaKw = document.querySelector('meta[name="keywords"]');
    if (!metaKw) {
      metaKw = document.createElement('meta');
      metaKw.setAttribute('name', 'keywords');
      document.head.appendChild(metaKw);
    }
    metaKw.setAttribute('content', 'SemiGuard AI, 반도체 예지보전, 이상탐지, 센서 모니터링, 예지안전 시스템');
  }, []);
  const [badgeNumber, setBadgeNumber] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const oauthError = new URLSearchParams(window.location.search).get("oauth_error");
  const oauthParts = oauthError?.split("_") ?? [];
  const oauthProvider = oauthParts[0];
  const oauthReason = oauthParts.slice(1).join("_");
  const oauthProviderLabel = oauthProvider === "google" ? "Google" : oauthProvider === "naver" ? "Naver" : oauthProvider === "kakao" ? "Kakao" : "소셜 로그인";
  const oauthPolicyMessage = oauthReason === "unlinked"
    ? `${oauthProviderLabel} 계정이 아직 연결되지 않았습니다. 먼저 회사 명찰 번호와 비밀번호로 회원가입·로그인한 뒤 대시보드 메뉴에서 연결해주세요.`
    : oauthReason === "link_required"
      ? "소셜 계정을 연결하려면 먼저 회사 명찰 번호와 비밀번호로 로그인해주세요."
      : oauthReason === "already_linked"
        ? "이 소셜 계정은 이미 다른 SemiGuard 계정에 연결되어 있습니다."
        : oauthProvider === "kakao"
          ? "Kakao 로그인에 실패했습니다. 카카오 디벨로퍼스에서 카카오 로그인 활성화, 리다이렉트 URI, 프로필 닉네임 동의항목을 확인한 뒤 잠시 후 다시 시도해주세요."
          : `${oauthProviderLabel} 로그인에 실패했습니다. 제공자의 앱 설정 또는 등록된 로그인 계정을 확인한 뒤 다시 시도해주세요.`;
  const isOauthEnabled = !import.meta.env.DEV;
  const handleSocialLogin = (start: () => void) => {
    if (!isOauthEnabled) {
      toast.info("개발 미리보기에서는 소셜 로그인을 사용할 수 없습니다. 배포된 사이트에서 이용해주세요.");
      return;
    }
    start();
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!badgeNumber.trim()) {
      toast.error("회사 명찰 번호를 입력해주세요.");
      return;
    }
    if (!password) {
      toast.error("비밀번호를 입력해주세요.");
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
        throw new Error(message || "로그인 실패");
      }

      toast.success("로그인이 완료되었습니다!");
      // 캐시를 무효화하고 대시보드로 이동
      await utils.auth.me.invalidate();
      window.location.href = "/";
    } catch (error) {
      console.error("Login error:", error);
      toast.error("로그인 실패: 명찰 번호 또는 비밀번호를 확인해주세요.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-4">
      <Card className="w-full max-w-md p-8 bg-slate-800 border-slate-700">
        <div className="space-y-6">
          {/* Header */}
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold text-white">SemiGuard AI</h1>
            <h2 className="text-slate-300 text-sm font-normal m-0">반도체 장비 예지안전 시스템</h2>
          </div>

          {oauthError && (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200" role="alert">
              {oauthPolicyMessage}
            </div>
          )}

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-600"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-slate-800 text-slate-400">로그인</span>
            </div>
          </div>

          {/* Login Form */}
          <form onSubmit={handleLogin} className="space-y-4">
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
                className="bg-slate-700 border-slate-600 text-white placeholder-slate-500"
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
                className="bg-slate-700 border-slate-600 text-white placeholder-slate-500"
                disabled={isLoading}
              />
            </div>

            {/* Login Button */}
            <Button
              type="submit"
              disabled={isLoading}
              className="w-full bg-cyan-500 hover:bg-cyan-600 text-white font-semibold py-2 h-auto"
            >
              {isLoading ? "로그인 중..." : "로그인"}
            </Button>
          </form>

          {/* Signup Link */}
          <div className="text-center">
            <p className="text-slate-400 text-sm">
              계정이 없으신가요?{" "}
              <button
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
              <span className="px-2 bg-slate-800 text-slate-400">소셜 로그인</span>
            </div>
          </div>

          {!isOauthEnabled && (
            <div className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-4 py-3 text-xs leading-relaxed text-cyan-100" role="status">
              개발 미리보기에서는 OAuth 제공자의 등록된 콜백 주소와 달라 소셜 로그인을 잠시 비활성화했습니다. 실제 소셜 로그인은 배포된 사이트에서 이용해주세요.
            </div>
          )}

          {/* Social Login Buttons */}
          <div className="space-y-3">
            {/* Google Login */}
            <Button
              onClick={() => handleSocialLogin(startGoogleLogin)}
              disabled={!isOauthEnabled}
              title={!isOauthEnabled ? "배포된 사이트에서 소셜 로그인을 이용해주세요." : undefined}
              className={`w-full bg-white hover:bg-slate-100 text-slate-900 font-semibold py-2 h-auto disabled:cursor-not-allowed disabled:opacity-50${!isOauthEnabled ? " opacity-50 grayscale cursor-not-allowed" : ""}`}
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
              onClick={() => handleSocialLogin(startNaverLogin)}
              disabled={!isOauthEnabled}
              title={!isOauthEnabled ? "배포된 사이트에서 소셜 로그인을 이용해주세요." : undefined}
              className={`w-full bg-[#00C73C] hover:bg-[#00B833] text-white font-semibold py-2 h-auto disabled:cursor-not-allowed disabled:opacity-50${!isOauthEnabled ? " opacity-50 grayscale cursor-not-allowed" : ""}`}
            >
              <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.37 0 0 5.37 0 12s5.37 12 12 12 12-5.37 12-12S18.63 0 12 0zm0 22c-5.52 0-10-4.48-10-10S6.48 2 12 2s10 4.48 10 10-4.48 10-10 10z" />
                <path d="M12 4c-4.42 0-8 3.58-8 8s3.58 8 8 8 8-3.58 8-8-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6s2.69-6 6-6 6 2.69 6 6-2.69 6-6 6z" />
              </svg>
              Naver로 로그인
            </Button>

            {/* Kakao Login */}
            <Button
              onClick={() => handleSocialLogin(startKakaoLogin)}
              disabled={!isOauthEnabled}
              title={!isOauthEnabled ? "배포된 사이트에서 소셜 로그인을 이용해주세요." : undefined}
              className={`w-full bg-[#FFE812] hover:bg-[#F0D800] text-slate-900 font-semibold py-2 h-auto disabled:cursor-not-allowed disabled:opacity-50${!isOauthEnabled ? " opacity-50 grayscale cursor-not-allowed" : ""}`}
            >
              <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 5.58 2 10c0 2.54 1.19 4.85 3.1 6.4.38.34.6.84.5 1.32-.08.37-.31.68-.62.85-.31.17-.68.17-.99 0-.76-.42-1.44-.95-2.03-1.56C2.46 14.76 1 12.54 1 10c0-5.52 4.48-10 10-10s10 4.48 10 10-4.48 10-10 10c-.55 0-1 .45-1 1s.45 1 1 1c5.52 0 10-4.48 10-10S17.52 2 12 2z" />
              </svg>
              Kakao로 로그인
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
