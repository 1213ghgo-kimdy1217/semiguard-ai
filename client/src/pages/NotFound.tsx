import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle, Home } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";

type NotFoundLanguage = "ko" | "en" | "ja";

const NOT_FOUND_COPY: Record<NotFoundLanguage, { title: string; description: string; moved: string; goHome: string; goLogin: string }> = {
  ko: {
    title: "페이지를 찾을 수 없습니다",
    description: "요청하신 페이지가 존재하지 않습니다.",
    moved: "주소가 변경되었거나 삭제되었을 수 있습니다.",
    goHome: "대시보드로 이동",
    goLogin: "로그인으로 이동",
  },
  en: {
    title: "Page Not Found",
    description: "Sorry, the page you are looking for doesn't exist.",
    moved: "It may have been moved or deleted.",
    goHome: "Go Home",
    goLogin: "Go to Login",
  },
  ja: {
    title: "ページが見つかりません",
    description: "お探しのページは存在しません。",
    moved: "ページのアドレスが変更または削除された可能性があります。",
    goHome: "ダッシュボードへ移動",
    goLogin: "ログインへ移動",
  },
};

export default function NotFound() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const [language] = useState<NotFoundLanguage>(() => {
    try {
      const saved = window.localStorage.getItem("semiguard_lang");
      return saved === "en" || saved === "ja" ? saved : "ko";
    } catch {
      return "ko";
    }
  });
  const copy = NOT_FOUND_COPY[language];

  useEffect(() => {
    document.documentElement.lang = language === "ko" ? "ko-KR" : language === "ja" ? "ja-JP" : "en-US";
  }, [language]);

  const handleGoHome = () => {
    setLocation(user ? "/" : "/login");
  };

  return (
    <main className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100" aria-labelledby="not-found-title">
      <Card className="w-full max-w-lg mx-4 shadow-lg border-0 bg-white/80 backdrop-blur-sm">
        <CardContent className="pt-8 pb-8 text-center">
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div className="absolute inset-0 bg-red-100 rounded-full animate-pulse" />
              <AlertCircle className="relative h-16 w-16 text-red-500" />
            </div>
          </div>

          <h1 className="text-4xl font-bold text-slate-900 mb-2">404</h1>

          <h2 id="not-found-title" className="text-xl font-semibold text-slate-700 mb-4">{copy.title}</h2>

          <p className="text-slate-600 mb-8 leading-relaxed">
            {copy.description}
            <br />
            {copy.moved}
          </p>

          <div
            id="not-found-button-group"
            className="flex flex-col sm:flex-row gap-3 justify-center"
          >
            <Button
              type="button"
              onClick={handleGoHome}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg transition-all duration-200 shadow-md hover:shadow-lg"
            >
              <Home className="w-4 h-4 mr-2" />
              {user ? copy.goHome : copy.goLogin}
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
