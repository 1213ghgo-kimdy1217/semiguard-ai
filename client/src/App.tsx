import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, useLocation } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Dashboard from "./pages/Dashboard";
import { Login } from "./pages/Login";
import Signup from "./pages/Signup";
import { useAuth } from "./_core/hooks/useAuth";
import { useEffect, useState } from "react";

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
          <Dashboard />
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
