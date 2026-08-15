import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";

type Language = "ko" | "en" | "ja";

const SIGNUP_COPY = {
  ko: {
    pageTitle: "SemiGuard AI | 반도체 장비 예지안전 회원가입",
    pageDescription: "SemiGuard AI 예지안전 시스템의 새 운영자 계정을 등록합니다. 회사 명찰 번호와 비밀번호로 안전하게 시작하세요.",
    pageKeywords: "SemiGuard AI, 반도체 예지보전, 회원가입, 장비 안전, 이상탐지",
    languageLabel: "표시 언어",
    subtitle: "반도체 장비 예지안전 시스템",
    badgeNumber: "회사 명찰 번호",
    badgePlaceholder: "예: EMP-2024-001",
    name: "이름",
    namePlaceholder: "예: 홍길동",
    dateOfBirth: "생년월일",
    password: "비밀번호",
    passwordPlaceholder: "6자 이상",
    passwordConfirm: "비밀번호 확인",
    passwordConfirmPlaceholder: "비밀번호 재입력",
    submit: "회원가입",
    submitting: "처리 중...",
    accountPrompt: "이미 계정이 있으신가요?",
    login: "로그인",
    validation: {
      badgeNumber: "회사 명찰 번호를 입력해주세요.",
      name: "이름을 입력해주세요.",
      dateOfBirth: "생년월일을 입력해주세요.",
      password: "비밀번호를 입력해주세요.",
      passwordLength: "비밀번호는 최소 6자 이상이어야 합니다.",
      passwordConfirm: "비밀번호가 일치하지 않습니다.",
    },
    success: "회원가입이 완료되었습니다. 로그인 페이지로 이동합니다.",
    error: "회원가입 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.",
  },
  en: {
    pageTitle: "SemiGuard AI | Semiconductor Safety Account Sign Up",
    pageDescription: "Create a new SemiGuard AI predictive-safety account. Start securely with your company badge number and password.",
    pageKeywords: "SemiGuard AI, semiconductor predictive maintenance, sign up, equipment safety, anomaly detection",
    languageLabel: "Display language",
    subtitle: "Semiconductor Equipment Predictive Safety System",
    badgeNumber: "Company badge number",
    badgePlaceholder: "e.g., EMP-2024-001",
    name: "Name",
    namePlaceholder: "e.g., Hong Gildong",
    dateOfBirth: "Date of birth",
    password: "Password",
    passwordPlaceholder: "At least 6 characters",
    passwordConfirm: "Confirm password",
    passwordConfirmPlaceholder: "Re-enter your password",
    submit: "Create account",
    submitting: "Creating account...",
    accountPrompt: "Already have an account?",
    login: "Sign in",
    validation: {
      badgeNumber: "Enter your company badge number.",
      name: "Enter your name.",
      dateOfBirth: "Enter your date of birth.",
      password: "Enter a password.",
      passwordLength: "Your password must be at least 6 characters.",
      passwordConfirm: "The passwords do not match.",
    },
    success: "Your account has been created. Moving to sign in.",
    error: "We could not create your account. Please try again shortly.",
  },
  ja: {
    pageTitle: "SemiGuard AI | 半導体装置予知安全アカウント登録",
    pageDescription: "SemiGuard AI予知安全システムの新しい運用者アカウントを登録します。社員証番号とパスワードで安全に始められます。",
    pageKeywords: "SemiGuard AI, 半導体予知保全, アカウント登録, 装置安全, 異常検知",
    languageLabel: "表示言語",
    subtitle: "半導体装置予知安全システム",
    badgeNumber: "社員証番号",
    badgePlaceholder: "例: EMP-2024-001",
    name: "氏名",
    namePlaceholder: "例: ホン・ギルドン",
    dateOfBirth: "生年月日",
    password: "パスワード",
    passwordPlaceholder: "6文字以上",
    passwordConfirm: "パスワード確認",
    passwordConfirmPlaceholder: "パスワードを再入力",
    submit: "アカウント登録",
    submitting: "登録中...",
    accountPrompt: "すでにアカウントをお持ちですか？",
    login: "ログイン",
    validation: {
      badgeNumber: "社員証番号を入力してください。",
      name: "氏名を入力してください。",
      dateOfBirth: "生年月日を入力してください。",
      password: "パスワードを入力してください。",
      passwordLength: "パスワードは6文字以上で入力してください。",
      passwordConfirm: "パスワードが一致しません。",
    },
    success: "アカウント登録が完了しました。ログイン画面に移動します。",
    error: "アカウントを登録できませんでした。しばらくしてからもう一度お試しください。",
  },
} as const;

const LANGUAGE_LOCALES: Record<Language, string> = {
  ko: "ko-KR",
  en: "en-US",
  ja: "ja-JP",
};

export function Signup() {
  const [, setLocation] = useLocation();
  const [language, setLanguage] = useState<Language>(() => {
    try {
      const saved = window.localStorage.getItem("semiguard_lang");
      return saved === "en" || saved === "ja" ? saved : "ko";
    } catch {
      return "ko";
    }
  });
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    badgeNumber: "",
    name: "",
    dateOfBirth: "",
    password: "",
    passwordConfirm: "",
  });
  const copy = SIGNUP_COPY[language];

  useEffect(() => {
    document.documentElement.lang = LANGUAGE_LOCALES[language];
    document.title = copy.pageTitle;

    let metaDescription = document.querySelector('meta[name="description"]');
    if (!metaDescription) {
      metaDescription = document.createElement("meta");
      metaDescription.setAttribute("name", "description");
      document.head.appendChild(metaDescription);
    }
    metaDescription.setAttribute("content", copy.pageDescription);

    let metaKeywords = document.querySelector('meta[name="keywords"]');
    if (!metaKeywords) {
      metaKeywords = document.createElement("meta");
      metaKeywords.setAttribute("name", "keywords");
      document.head.appendChild(metaKeywords);
    }
    metaKeywords.setAttribute("content", copy.pageKeywords);
  }, [copy, language]);

  const selectLanguage = (nextLanguage: Language) => {
    setLanguage(nextLanguage);
    try {
      window.localStorage.setItem("semiguard_lang", nextLanguage);
    } catch {
      // 브라우저 저장소가 제한돼도 현재 회원가입 화면의 표시 언어는 바꾼다.
    }
  };

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setFormData((previous) => ({ ...previous, [name]: value }));
  };

  const handleSignup = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!formData.badgeNumber.trim()) return void toast.error(copy.validation.badgeNumber);
    if (!formData.name.trim()) return void toast.error(copy.validation.name);
    if (!formData.dateOfBirth) return void toast.error(copy.validation.dateOfBirth);
    if (!formData.password) return void toast.error(copy.validation.password);
    if (formData.password.length < 6) return void toast.error(copy.validation.passwordLength);
    if (formData.password !== formData.passwordConfirm) return void toast.error(copy.validation.passwordConfirm);

    setIsLoading(true);
    try {
      const response = await fetch("/api/trpc/auth.signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          json: {
            badgeNumber: formData.badgeNumber.trim(),
            name: formData.name.trim(),
            dateOfBirth: formData.dateOfBirth,
            password: formData.password,
          },
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || payload?.error) throw new Error("signup_failed");

      toast.success(copy.success);
      window.setTimeout(() => setLocation("/login"), 1500);
    } catch (error) {
      console.error("Signup error:", error);
      toast.error(copy.error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-slate-700 bg-slate-800 shadow-2xl">
        <div className="p-6 sm:p-8">
          <div className="mb-6 flex justify-end" role="group" aria-label={copy.languageLabel}>
            <div className="inline-flex rounded-lg border border-slate-700 bg-slate-900/60 p-1">
              {([
                ["ko", "한국어"],
                ["en", "EN"],
                ["ja", "日本語"],
              ] as const).map(([nextLanguage, label]) => (
                <button
                  key={nextLanguage}
                  type="button"
                  onClick={() => selectLanguage(nextLanguage)}
                  aria-pressed={language === nextLanguage}
                  className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${language === nextLanguage ? "bg-cyan-500 text-slate-950" : "text-slate-400 hover:bg-slate-700 hover:text-slate-100"}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="mb-8 text-center">
            <div className="mb-4 flex items-center justify-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-400 to-blue-500">
                <span className="text-lg font-bold text-white" aria-hidden="true">⚙️</span>
              </div>
              <h1 className="text-2xl font-bold text-white">SemiGuard AI</h1>
            </div>
            <p className="text-sm text-slate-400">{copy.subtitle}</p>
          </div>

          <form onSubmit={handleSignup} className="space-y-5" aria-busy={isLoading}>
            <div className="space-y-2">
              <Label htmlFor="badgeNumber" className="text-sm font-medium text-slate-300">{copy.badgeNumber}</Label>
              <Input id="badgeNumber" name="badgeNumber" type="text" placeholder={copy.badgePlaceholder} value={formData.badgeNumber} onChange={handleChange} className="border-slate-600 bg-slate-700 text-white placeholder:text-slate-500 focus:border-cyan-400 focus:ring-cyan-400" disabled={isLoading} autoComplete="username" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm font-medium text-slate-300">{copy.name}</Label>
              <Input id="name" name="name" type="text" placeholder={copy.namePlaceholder} value={formData.name} onChange={handleChange} className="border-slate-600 bg-slate-700 text-white placeholder:text-slate-500 focus:border-cyan-400 focus:ring-cyan-400" disabled={isLoading} autoComplete="name" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dateOfBirth" className="text-sm font-medium text-slate-300">{copy.dateOfBirth}</Label>
              <Input id="dateOfBirth" name="dateOfBirth" type="date" value={formData.dateOfBirth} onChange={handleChange} className="border-slate-600 bg-slate-700 text-white focus:border-cyan-400 focus:ring-cyan-400" disabled={isLoading} autoComplete="bday" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium text-slate-300">{copy.password}</Label>
              <Input id="password" name="password" type="password" placeholder={copy.passwordPlaceholder} value={formData.password} onChange={handleChange} className="border-slate-600 bg-slate-700 text-white placeholder:text-slate-500 focus:border-cyan-400 focus:ring-cyan-400" disabled={isLoading} autoComplete="new-password" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="passwordConfirm" className="text-sm font-medium text-slate-300">{copy.passwordConfirm}</Label>
              <Input id="passwordConfirm" name="passwordConfirm" type="password" placeholder={copy.passwordConfirmPlaceholder} value={formData.passwordConfirm} onChange={handleChange} className="border-slate-600 bg-slate-700 text-white placeholder:text-slate-500 focus:border-cyan-400 focus:ring-cyan-400" disabled={isLoading} autoComplete="new-password" required />
            </div>
            <Button type="submit" disabled={isLoading} className="w-full rounded-lg bg-gradient-to-r from-cyan-500 to-blue-500 py-2 font-semibold text-white transition-all duration-200 hover:from-cyan-600 hover:to-blue-600 disabled:cursor-not-allowed disabled:opacity-50">
              {isLoading ? copy.submitting : copy.submit}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-slate-400">
              {copy.accountPrompt}{" "}
              <button type="button" onClick={() => setLocation("/login")} className="font-semibold text-cyan-400 transition-colors hover:text-cyan-300">
                {copy.login}
              </button>
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}

export default Signup;
