import { AlertTriangle, LogIn, RotateCcw } from "lucide-react";
import { Component, ReactNode } from "react";

type ErrorLanguage = "ko" | "en" | "ja";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorId: string | null;
}

const errorCopy: Record<ErrorLanguage, {
  title: string;
  description: string;
  reference: string;
  retry: string;
  login: string;
  reload: string;
}> = {
  ko: {
    title: "화면을 준비하는 중 문제가 발생했습니다.",
    description: "저장된 상담과 안전 기록은 삭제되지 않았습니다. 다시 시도하거나 로그인 화면으로 이동해 주세요.",
    reference: "오류 식별자",
    retry: "다시 시도",
    login: "로그인으로 이동",
    reload: "페이지 새로고침",
  },
  en: {
    title: "We could not prepare this screen.",
    description: "Your saved consultations and safety records have not been deleted. Try again or return to sign in.",
    reference: "Error reference",
    retry: "Try again",
    login: "Go to sign in",
    reload: "Reload page",
  },
  ja: {
    title: "画面の準備中に問題が発生しました。",
    description: "保存済みの相談と安全記録は削除されていません。再試行するか、ログイン画面へ移動してください。",
    reference: "エラー識別子",
    retry: "再試行",
    login: "ログインへ移動",
    reload: "ページを再読み込み",
  },
};

function getStoredLanguage(): ErrorLanguage {
  try {
    const value = localStorage.getItem("semiguard_lang");
    return value === "en" || value === "ja" || value === "ko" ? value : "ko";
  } catch {
    return "ko";
  }
}

function createErrorId() {
  return `SG-${Date.now().toString(36).toUpperCase()}`;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorId: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorId: createErrorId() };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Keep diagnostic detail in the developer console without exposing stacks to end users.
    console.error(`[SemiGuard ${this.state.errorId ?? "unknown"}]`, error, info);
  }

  private retry = () => {
    this.setState({ hasError: false, error: null, errorId: null });
  };

  private goToLogin = () => {
    window.location.assign("/login");
  };

  render() {
    if (this.state.hasError) {
      const copy = errorCopy[getStoredLanguage()];
      return (
        <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 to-slate-800 p-6" role="alert" aria-live="assertive">
          <section className="w-full max-w-lg rounded-2xl border border-amber-300/25 bg-slate-900/85 p-6 text-center shadow-2xl sm:p-8">
            <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-amber-300/10 text-amber-300">
              <AlertTriangle size={25} aria-hidden="true" />
            </div>
            <h1 className="text-lg font-bold text-slate-50 sm:text-xl">{copy.title}</h1>
            <p className="mt-3 text-sm leading-relaxed text-slate-300">{copy.description}</p>
            <p className="mt-4 font-mono text-[11px] text-slate-500">{copy.reference}: {this.state.errorId}</p>
            <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
              <button type="button" onClick={this.retry} className="inline-flex items-center justify-center gap-2 rounded-lg bg-cyan-500 px-4 py-2.5 text-sm font-bold text-slate-950 transition-opacity hover:opacity-90">
                <RotateCcw size={16} aria-hidden="true" />
                {copy.retry}
              </button>
              <button type="button" onClick={this.goToLogin} className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-500 px-4 py-2.5 text-sm font-bold text-slate-100 transition-opacity hover:opacity-80">
                <LogIn size={16} aria-hidden="true" />
                {copy.login}
              </button>
              <button type="button" onClick={() => window.location.reload()} className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-600 px-4 py-2.5 text-sm font-semibold text-slate-300 transition-opacity hover:opacity-80">
                {copy.reload}
              </button>
            </div>
          </section>
        </main>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
