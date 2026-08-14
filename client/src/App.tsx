import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, useLocation } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { Login } from "./pages/Login";
import Signup from "./pages/Signup";
import { useAuth } from "./_core/hooks/useAuth";
import { lazy, Suspense, useEffect, useState } from "react";

const Dashboard = lazy(() => import("./pages/Dashboard"));

type LoadingLanguage = "ko" | "en" | "ja";

const dashboardLoadingCopy: Record<LoadingLanguage, { title: string; description: string; slowDescription: string; retry: string }> = {
  ko: { title: "SemiGuard AI 대시보드를 준비하고 있습니다.", description: "대시보드 데이터를 불러오는 중입니다…", slowDescription: "로딩이 평소보다 오래 걸리고 있습니다. 계속되면 새로고침해 주세요.", retry: "지금 새로고침" },
  en: { title: "Preparing the SemiGuard AI dashboard…", description: "Loading dashboard data…", slowDescription: "Loading is taking longer than usual. Refresh if it continues.", retry: "Refresh now" },
  ja: { title: "SemiGuard AIダッシュボードを準備しています。", description: "ダッシュボードのデータを読み込み中です…", slowDescription: "読み込みに通常より時間がかかっています。続く場合は更新してください。", retry: "今すぐ更新" },
};

const authLoadingCopy: Record<LoadingLanguage, { title: string; description: string; slowDescription: string; retry: string }> = {
  ko: { title: "보안 로그인 상태를 확인하고 있습니다.", description: "세션 정보를 안전하게 불러오는 중입니다…", slowDescription: "확인이 평소보다 오래 걸리고 있습니다. 계속되면 새로고침해 주세요.", retry: "지금 새로고침" },
  en: { title: "Verifying your secure sign-in…", description: "Loading your session safely…", slowDescription: "Verification is taking longer than usual. Refresh if it continues.", retry: "Refresh now" },
  ja: { title: "安全なログイン状態を確認しています。", description: "セッション情報を安全に読み込み中です…", slowDescription: "確認に通常より時間がかかっています。続く場合は更新してください。", retry: "今すぐ更新" },
};

function getDashboardLoadingLanguage(): LoadingLanguage {
  try {
    const value = localStorage.getItem("semiguard_lang");
    return value === "en" || value === "ja" || value === "ko" ? value : "ko";
  } catch {
    return "ko";
  }
}

function DashboardModuleLoading() {
  const copy = dashboardLoadingCopy[getDashboardLoadingLanguage()];
  const [isSlowLoading, setIsSlowLoading] = useState(false);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setIsSlowLoading(true), 8000);
    return () => window.clearTimeout(timeoutId);
  }, []);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-gradient-to-br from-slate-950 to-slate-800 px-6 text-center" role="status" aria-live="polite">
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-cyan-300 border-t-transparent" />
      <p className="text-sm font-semibold text-slate-100">{copy.title}</p>
      <p className="text-xs text-slate-400">{copy.description}</p>
      {isSlowLoading && (
        <div className="mt-2 flex flex-col items-center gap-3">
          <p className="max-w-sm text-xs text-slate-300">{copy.slowDescription}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-lg border border-cyan-300/60 bg-cyan-300/10 px-3 py-2 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-300/20 focus:outline-none focus:ring-2 focus:ring-cyan-200 focus:ring-offset-2 focus:ring-offset-slate-900">
            {copy.retry}
          </button>
        </div>
      )}
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();
  const [isInitialized, setIsInitialized] = useState(false);
  const [isSlowLoading, setIsSlowLoading] = useState(false);
  const authCopy = authLoadingCopy[getDashboardLoadingLanguage()];

  useEffect(() => {
    // loading이 false가 되면 초기화 완료
    if (!loading) {
      setIsInitialized(true);
    }
  }, [loading]);

  // 초기화 완료 후 user 없으면 로그인 페이지로
  useEffect(() => {
    if (isInitialized && !user) {
      setLocation("/login");
    }
  }, [isInitialized, user, setLocation]);

  useEffect(() => {
    if (!loading && isInitialized) {
      setIsSlowLoading(false);
      return;
    }
    const timeoutId = window.setTimeout(() => setIsSlowLoading(true), 8000);
    return () => window.clearTimeout(timeoutId);
  }, [loading, isInitialized]);

  // 로딩 중이거나 초기화 중
  if (loading || !isInitialized) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-gradient-to-br from-slate-950 to-slate-800 px-6 text-center" role="status" aria-live="polite">
        <div aria-hidden="true" className="h-10 w-10 animate-spin rounded-full border-2 border-cyan-300 border-t-transparent" />
        <p className="text-sm font-semibold text-slate-100">{authCopy.title}</p>
        <p className="text-xs text-slate-400">{authCopy.description}</p>
        {isSlowLoading && (
          <div className="mt-2 flex flex-col items-center gap-3">
            <p className="max-w-sm text-xs text-slate-300">{authCopy.slowDescription}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-lg border border-cyan-300/60 bg-cyan-300/10 px-3 py-2 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-300/20 focus:outline-none focus:ring-2 focus:ring-cyan-200 focus:ring-offset-2 focus:ring-offset-slate-900">
              {authCopy.retry}
            </button>
          </div>
        )}
      </div>
    );
  }

  // user가 없으면 null 반환 (로그인 페이지로 이동 중)
  if (!user) {
    return null;
  }

  return <>{children}</>;
}

function Router() {
  return (
    <Switch>
      <Route path={"/signup"} component={Signup} />
      <Route path={"/login"} component={Login} />
      <Route path={"/"}>
        <ProtectedRoute>
          <Suspense fallback={<DashboardModuleLoading />}>
            <Dashboard />
          </Suspense>
        </ProtectedRoute>
      </Route>
      <Route path={"/404"} component={NotFound} />
      <Route component={Signup} />
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
