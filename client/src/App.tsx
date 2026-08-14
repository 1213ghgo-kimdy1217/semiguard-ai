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

function DashboardModuleLoading() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-gradient-to-br from-slate-950 to-slate-800 px-6 text-center" role="status" aria-live="polite">
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-cyan-300 border-t-transparent" />
      <p className="text-sm font-semibold text-slate-100">SemiGuard AI 대시보드를 준비하고 있습니다.</p>
      <p className="text-xs text-slate-400">Preparing the SemiGuard AI dashboard…</p>
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();
  const [isInitialized, setIsInitialized] = useState(false);

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

  // 로딩 중이거나 초기화 중
  if (loading || !isInitialized) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 to-slate-800">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
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
