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
