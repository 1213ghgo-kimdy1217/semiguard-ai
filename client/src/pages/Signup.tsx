import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
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
    dateHint: "표시 형식은 브라우저 설정에 따라 달라질 수 있습니다. 날짜 선택기를 사용해 주세요.",
    password: "비밀번호",
    passwordPlaceholder: "6자 이상",
    passwordStrengthLabel: "비밀번호 강도",
    passwordStrength: { tooShort: "6자 이상 필요", weak: "낮음", fair: "보통", strong: "높음" },
    capsLockWarning: "Caps Lock이 켜져 있습니다.",
    showPassword: "비밀번호 표시",
    hidePassword: "비밀번호 숨기기",
    passwordConfirm: "비밀번호 확인",
    passwordConfirmPlaceholder: "비밀번호 재입력",
    submit: "회원가입",
    submitting: "처리 중...",
    accountPrompt: "이미 계정이 있으신가요?",
    login: "로그인",
    validation: {
      badgeNumber: "회사 명찰 번호를 입력해주세요.",
      badgeNumberExists: "이미 가입된 회사 명찰 번호입니다. 로그인하거나 다른 번호를 입력해주세요.",
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
    dateHint: "The displayed format may follow your browser settings. Use the date picker.",
    password: "Password",
    passwordPlaceholder: "At least 6 characters",
    passwordStrengthLabel: "Password strength",
    passwordStrength: { tooShort: "Use at least 6 characters", weak: "Weak", fair: "Fair", strong: "Strong" },
    capsLockWarning: "Caps Lock is on.",
    showPassword: "Show password",
    hidePassword: "Hide password",
    passwordConfirm: "Confirm password",
    passwordConfirmPlaceholder: "Re-enter your password",
    submit: "Create account",
    submitting: "Creating account...",
    accountPrompt: "Already have an account?",
    login: "Sign in",
    validation: {
      badgeNumber: "Enter your company badge number.",
      badgeNumberExists: "This company badge number is already registered. Sign in or enter another number.",
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
    dateHint: "表示形式はブラウザー設定により異なる場合があります。日付選択を使用してください。",
    password: "パスワード",
    passwordPlaceholder: "6文字以上",
    passwordStrengthLabel: "パスワードの強度",
    passwordStrength: { tooShort: "6文字以上必要", weak: "弱い", fair: "普通", strong: "強い" },
    capsLockWarning: "Caps Lockがオンになっています。",
    showPassword: "パスワードを表示",
    hidePassword: "パスワードを隠す",
    passwordConfirm: "パスワード確認",
    passwordConfirmPlaceholder: "パスワードを再入力",
    submit: "アカウント登録",
    submitting: "登録中...",
    accountPrompt: "すでにアカウントをお持ちですか？",
    login: "ログイン",
    validation: {
      badgeNumber: "社員証番号を入力してください。",
      badgeNumberExists: "この社員証番号はすでに登録されています。ログインするか、別の番号を入力してください。",
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

type PasswordStrengthLevel = "tooShort" | "weak" | "fair" | "strong";
type SignupField = "badgeNumber" | "name" | "dateOfBirth" | "password" | "passwordConfirm";
type SignupValidationKey = keyof typeof SIGNUP_COPY.ko.validation;

function getPasswordStrength(password: string): { level: PasswordStrengthLevel; score: number } {
  if (password.length < 6) return { level: "tooShort", score: 0 };

  const characterGroups = [/[a-z]/.test(password), /[A-Z]/.test(password), /\d/.test(password), /[^A-Za-z\d]/.test(password)].filter(Boolean).length;
  if (password.length >= 10 && characterGroups >= 3) return { level: "strong", score: 3 };
  if (characterGroups >= 2) return { level: "fair", score: 2 };
  return { level: "weak", score: 1 };
}

export function Signup() {
  const [, setLocation] = useLocation();
  const signupLanguageOptions: Language[] = ["ko", "en", "ja"];
  const signupLanguageButtonRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [language, setLanguage] = useState<Language>(() => {
    try {
      const saved = window.localStorage.getItem("semiguard_lang");
      return saved === "en" || saved === "ja" ? saved : "ko";
    } catch {
      return "ko";
    }
  });
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
  const [capsLockOn, setCapsLockOn] = useState(false);
  const [fieldError, setFieldError] = useState<SignupField | null>(null);
  const [fieldErrorKey, setFieldErrorKey] = useState<SignupValidationKey | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    badgeNumber: "",
    name: "",
    dateOfBirth: "",
    password: "",
    passwordConfirm: "",
  });
  const copy = SIGNUP_COPY[language];
  const passwordStrength = getPasswordStrength(formData.password);

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
  const handleSignupLanguageKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>, currentIndex: number) => {
    const lastIndex = signupLanguageOptions.length - 1;
    const nextIndex = event.key === "ArrowRight" || event.key === "ArrowDown"
      ? (currentIndex + 1) % signupLanguageOptions.length
      : event.key === "ArrowLeft" || event.key === "ArrowUp"
        ? (currentIndex - 1 + signupLanguageOptions.length) % signupLanguageOptions.length
        : event.key === "Home"
          ? 0
          : event.key === "End"
            ? lastIndex
            : null;

    if (nextIndex === null) return;
    event.preventDefault();
    selectLanguage(signupLanguageOptions[nextIndex]);
    window.requestAnimationFrame(() => signupLanguageButtonRefs.current[nextIndex]?.focus());
  };

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setFormData((previous) => ({ ...previous, [name]: value }));
    if (authError) setAuthError(null);
    if (fieldError === name || (name === "password" && fieldError === "passwordConfirm")) {
      setFieldError(null);
      setFieldErrorKey(null);
    }
  };
  const handleCapsLock = (event: React.KeyboardEvent<HTMLInputElement>) => {
    setCapsLockOn(event.getModifierState("CapsLock"));
  };
  const showFieldError = (field: SignupField, messageKey: SignupValidationKey) => {
    setFieldError(field);
    setFieldErrorKey(messageKey);
    toast.error(copy.validation[messageKey]);
    window.requestAnimationFrame(() => document.getElementById(field)?.focus());
  };

  const handleSignup = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!formData.badgeNumber.trim()) return void showFieldError("badgeNumber", "badgeNumber");
    if (!formData.name.trim()) return void showFieldError("name", "name");
    if (!formData.dateOfBirth) return void showFieldError("dateOfBirth", "dateOfBirth");
    if (!formData.password) return void showFieldError("password", "password");
    if (formData.password.length < 6) return void showFieldError("password", "passwordLength");
    if (formData.password !== formData.passwordConfirm) return void showFieldError("passwordConfirm", "passwordConfirm");

    setFieldError(null);
    setFieldErrorKey(null);
    setAuthError(null);

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
      const errorCode = payload?.error?.json?.data?.code ?? payload?.error?.data?.code;
      if (!response.ok || payload?.error) {
        if (errorCode === "CONFLICT") {
          showFieldError("badgeNumber", "badgeNumberExists");
          return;
        }
        throw new Error("signup_failed");
      }

      toast.success(copy.success);
      window.setTimeout(() => setLocation("/login"), 1500);
    } catch (error) {
      console.error("Signup error:", error);
      setAuthError(copy.error);
      toast.error(copy.error);
      window.requestAnimationFrame(() => document.getElementById("badgeNumber")?.focus());
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-slate-700 bg-slate-800 shadow-2xl">
        <div className="p-6 sm:p-8">
          <div className="mb-6 flex justify-end" role="group" aria-label={copy.languageLabel}>
            <div className="inline-flex rounded-lg border border-slate-700 bg-slate-900/60 p-1">
              {([
                ["ko", "한국어"],
                ["en", "EN"],
                ["ja", "日本語"],
              ] as const).map(([nextLanguage, label], index) => (
                <button
                  key={nextLanguage}
                  type="button"
                  onClick={() => selectLanguage(nextLanguage)}
                  onKeyDown={(event) => handleSignupLanguageKeyDown(event, index)}
                  ref={(element) => { signupLanguageButtonRefs.current[index] = element; }}
                  aria-pressed={language === nextLanguage}
                  className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-800 ${language === nextLanguage ? "bg-cyan-500 text-slate-950" : "text-slate-400 hover:bg-slate-700 hover:text-slate-100"}`}
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

          <form onSubmit={handleSignup} className="space-y-5" aria-busy={isLoading} noValidate>
            {isLoading && <p id="signup-submit-status" className="sr-only" role="status" aria-live="polite" aria-atomic="true">{copy.submitting}</p>}
            {authError && (
              <p id="signup-auth-error" role="alert" className="rounded-lg border border-rose-400/50 bg-rose-500/10 px-3 py-2 text-sm font-medium text-rose-200" tabIndex={-1}>
                {authError}
              </p>
            )}
            <div className="space-y-2">
              <Label htmlFor="badgeNumber" className="text-sm font-medium text-slate-300">{copy.badgeNumber}</Label>
              <Input id="badgeNumber" name="badgeNumber" type="text" placeholder={copy.badgePlaceholder} value={formData.badgeNumber} onChange={handleChange} inputMode="text" enterKeyHint="next" aria-invalid={fieldError === "badgeNumber" || Boolean(authError)} aria-describedby={[fieldError === "badgeNumber" ? "badgeNumber-error" : null, authError ? "signup-auth-error" : null].filter(Boolean).join(" ") || undefined} className="border-slate-600 bg-slate-700 text-white placeholder:text-slate-500 focus:border-cyan-400 focus:ring-cyan-400" disabled={isLoading} autoComplete="username" required />
              {fieldError === "badgeNumber" && <p id="badgeNumber-error" className="text-xs font-medium text-rose-300" role="alert">{fieldErrorKey ? copy.validation[fieldErrorKey] : copy.validation.badgeNumber}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm font-medium text-slate-300">{copy.name}</Label>
              <Input id="name" name="name" type="text" placeholder={copy.namePlaceholder} value={formData.name} onChange={handleChange} inputMode="text" enterKeyHint="next" aria-invalid={fieldError === "name"} aria-describedby={fieldError === "name" ? "name-error" : undefined} className="border-slate-600 bg-slate-700 text-white placeholder:text-slate-500 focus:border-cyan-400 focus:ring-cyan-400" disabled={isLoading} autoComplete="name" required />
              {fieldError === "name" && <p id="name-error" className="text-xs font-medium text-rose-300" role="alert">{fieldErrorKey ? copy.validation[fieldErrorKey] : copy.validation.name}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="dateOfBirth" className="text-sm font-medium text-slate-300">{copy.dateOfBirth}</Label>
              <Input id="dateOfBirth" name="dateOfBirth" type="date" lang={LANGUAGE_LOCALES[language]} value={formData.dateOfBirth} onChange={handleChange} enterKeyHint="next" aria-invalid={fieldError === "dateOfBirth"} aria-describedby={[fieldError === "dateOfBirth" ? "dateOfBirth-error" : null, "dateOfBirth-hint"].filter(Boolean).join(" ")} className="border-slate-600 bg-slate-700 text-white focus:border-cyan-400 focus:ring-cyan-400" disabled={isLoading} autoComplete="bday" required />
              <p id="dateOfBirth-hint" className="text-xs leading-relaxed text-slate-400">{copy.dateHint}</p>
              {fieldError === "dateOfBirth" && <p id="dateOfBirth-error" className="text-xs font-medium text-rose-300" role="alert">{fieldErrorKey ? copy.validation[fieldErrorKey] : copy.validation.dateOfBirth}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium text-slate-300">{copy.password}</Label>
              <div className="relative">
                <Input id="password" name="password" type={showPassword ? "text" : "password"} placeholder={copy.passwordPlaceholder} value={formData.password} onChange={handleChange} onKeyDown={handleCapsLock} onKeyUp={handleCapsLock} onBlur={() => setCapsLockOn(false)} enterKeyHint="next" aria-invalid={fieldError === "password"} aria-describedby={[fieldError === "password" ? "password-error" : null, "password-strength-status"].filter(Boolean).join(" ")} className="border-slate-600 bg-slate-700 pr-24 text-white placeholder:text-slate-500 focus:border-cyan-400 focus:ring-cyan-400" disabled={isLoading} autoComplete="new-password" required />
                <button type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? copy.hidePassword : copy.showPassword} aria-pressed={showPassword} disabled={isLoading} className="absolute inset-y-1 right-1 rounded px-3 text-xs font-semibold text-cyan-300 transition-colors hover:bg-slate-600 hover:text-cyan-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-inset disabled:opacity-50">
                  {showPassword ? copy.hidePassword : copy.showPassword}
                </button>
              </div>
              {fieldError === "password" && <p id="password-error" className="text-xs font-medium text-rose-300" role="alert">{fieldErrorKey ? copy.validation[fieldErrorKey] : (formData.password ? copy.validation.passwordLength : copy.validation.password)}</p>}
              <div className="space-y-1.5">
                <div className="flex gap-1" aria-hidden="true">
                  <span className={`h-1 flex-1 rounded-full ${passwordStrength.score >= 1 ? "bg-rose-400" : "bg-slate-600"}`} />
                  <span className={`h-1 flex-1 rounded-full ${passwordStrength.score >= 2 ? "bg-amber-400" : "bg-slate-600"}`} />
                  <span className={`h-1 flex-1 rounded-full ${passwordStrength.score >= 3 ? "bg-emerald-400" : "bg-slate-600"}`} />
                </div>
                <p id="password-strength-status" role="status" aria-live="polite" aria-atomic="true" className="text-xs text-slate-400">
                  {copy.passwordStrengthLabel}: <span className="font-semibold text-slate-200">{copy.passwordStrength[passwordStrength.level]}</span>
                </p>
              </div>
              {capsLockOn && <p className="text-xs font-medium text-amber-300" role="status" aria-live="polite" aria-atomic="true">{copy.capsLockWarning}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="passwordConfirm" className="text-sm font-medium text-slate-300">{copy.passwordConfirm}</Label>
              <div className="relative">
                <Input id="passwordConfirm" name="passwordConfirm" type={showPasswordConfirm ? "text" : "password"} placeholder={copy.passwordConfirmPlaceholder} value={formData.passwordConfirm} onChange={handleChange} onKeyDown={handleCapsLock} onKeyUp={handleCapsLock} onBlur={() => setCapsLockOn(false)} enterKeyHint="done" aria-invalid={fieldError === "passwordConfirm"} aria-describedby={fieldError === "passwordConfirm" ? "passwordConfirm-error" : undefined} className="border-slate-600 bg-slate-700 pr-24 text-white placeholder:text-slate-500 focus:border-cyan-400 focus:ring-cyan-400" disabled={isLoading} autoComplete="new-password" required />
                <button type="button" onClick={() => setShowPasswordConfirm((visible) => !visible)} aria-label={showPasswordConfirm ? copy.hidePassword : copy.showPassword} aria-pressed={showPasswordConfirm} disabled={isLoading} className="absolute inset-y-1 right-1 rounded px-3 text-xs font-semibold text-cyan-300 transition-colors hover:bg-slate-600 hover:text-cyan-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-inset disabled:opacity-50">
                  {showPasswordConfirm ? copy.hidePassword : copy.showPassword}
                </button>
              </div>
              {fieldError === "passwordConfirm" && <p id="passwordConfirm-error" className="text-xs font-medium text-rose-300" role="alert">{fieldErrorKey ? copy.validation[fieldErrorKey] : copy.validation.passwordConfirm}</p>}
              {capsLockOn && <p className="text-xs font-medium text-amber-300" role="status" aria-live="polite" aria-atomic="true">{copy.capsLockWarning}</p>}
            </div>
            <Button type="submit" disabled={isLoading} className="w-full rounded-lg bg-gradient-to-r from-cyan-500 to-blue-500 py-2 font-semibold text-white transition-all duration-200 hover:from-cyan-600 hover:to-blue-600 disabled:cursor-not-allowed disabled:opacity-50">
              {isLoading ? copy.submitting : copy.submit}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-slate-400">
              {copy.accountPrompt}{" "}
              <button type="button" onClick={() => setLocation("/login")} className="rounded font-semibold text-cyan-400 transition-colors hover:text-cyan-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-800">
                {copy.login}
              </button>
            </p>
          </div>
        </div>
      </Card>
    </main>
  );
}

export default Signup;
