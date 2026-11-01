import React, { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "wouter";
import ProductLanguageSelect from "../components/ProductLanguageSelect";
import { trpc } from "../lib/trpc";
import { tr, useProductLanguage } from "../lib/productLanguage";
import { recoveryFailure } from "../lib/recoveryMessages";
import "./account-recovery.css";

type RecoveryView = "request" | "verify" | "reset";

export default function AccountRecovery({ view = "request" }: { view?: RecoveryView }) {
  const [language, setLanguage] = useProductLanguage();
  const l = (ko: string, en: string, ja: string) => tr(language, ko, en, ja);
  const [purpose, setPurpose] = useState<"password" | "id">(() => typeof window !== "undefined" && new URLSearchParams(window.location.search).get("purpose") === "id" ? "id" : "password");
  const [method, setMethod] = useState<"id" | "email">("id");
  const [identifier, setIdentifier] = useState("");
  // Keep the credential only in this mounted page. It is never persisted or sent in a URL request.
  const [token, setToken] = useState(() => {
    const hash = typeof window === "undefined" ? "" : window.location.hash;
    if (hash.length > 96) return "";
    const candidate = new URLSearchParams(hash.slice(1)).get("token") ?? "";
    return /^[A-Za-z0-9_-]{43}$/.test(candidate) ? candidate : "";
  });
  useLayoutEffect(() => {
    if (window.location.hash) window.history.replaceState(window.history.state, "", window.location.pathname + window.location.search);
  }, []);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [fieldError, setFieldError] = useState<"identifier" | "confirmation" | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const notice = useRef<HTMLParagraphElement>(null);
  const availability = trpc.accountRecovery.availability.useQuery(undefined, { retry: false, refetchOnWindowFocus: false });
  const request = trpc.accountRecovery.request.useMutation({ retry: false, gcTime: 0 });
  const reset = trpc.accountRecovery.reset.useMutation({ retry: false, gcTime: 0 });
  const verify = trpc.accountRecovery.confirmEmail.useMutation({ retry: false, gcTime: 0 });
  const title = view === "verify" ? l("복구 이메일 인증", "Verify recovery email", "復旧メールの確認") : view === "reset" ? l("새 비밀번호 설정", "Set a new password", "新しいパスワードの設定") : purpose === "id" ? l("아이디 찾기", "Find your sign-in ID", "ログインIDを確認") : l("비밀번호 재설정", "Reset your password", "パスワードの再設定");
  const ready = availability.data?.available === true && !availability.isLoading && !availability.isError;
  const actualMethod = purpose === "id" ? "email" : method;
  useEffect(() => { document.title = `SemiGuard AI — ${title}`; }, [title]);
  useEffect(() => { if (error || done) notice.current?.focus(); }, [error, done]);
  const clear = () => { setError(""); setFieldError(null); setDone(false); };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!ready || lock.current) return;
    setError(""); setFieldError(null);
    if (view === "reset" && password !== confirmation) {
      setError(l("새 비밀번호가 서로 다릅니다. 다시 입력해 주세요.", "The new passwords do not match. Enter them again.", "新しいパスワードが一致しません。再入力してください。"));
      setFieldError("confirmation");
      return;
    }
    lock.current = true; setBusy(true);
    try {
      if (view === "request") await request.mutateAsync({ purpose, method: actualMethod, identifier: identifier.trim(), language });
      else if (view === "verify") await verify.mutateAsync({ token });
      else await reset.mutateAsync({ token, password, confirmation });
      setDone(true); setToken(""); setPassword(""); setConfirmation(""); setIdentifier("");
    } catch (failure) {
      const message = failure instanceof Error ? failure.message : "";
      setError(recoveryFailure(message, language));
      if (/RECOVERY_(?:EMAIL|ID)_INVALID/.test(message)) setFieldError("identifier");
      if (view !== "request") { setPassword(""); setConfirmation(""); }
    } finally { request.reset(); reset.reset(); verify.reset(); lock.current = false; setBusy(false); }
  };
  const success = view === "verify" ? l("복구 이메일 인증이 완료되었습니다. 이제 이 이메일로 아이디 찾기와 비밀번호 재설정을 요청할 수 있습니다.", "Your recovery email is verified. You can now use it to find your ID or reset your password.", "復旧メールを確認しました。今後このメールでIDの確認やパスワードの再設定をリクエストできます。") : view === "reset" ? l("비밀번호를 변경했습니다. 이전 로그인은 해제됩니다. 새 비밀번호로 다시 로그인해 주세요.", "Your password has changed and previous sign-ins are no longer valid. Sign in with your new password.", "パスワードを変更しました。以前のログインは無効になります。新しいパスワードでログインしてください。") : l("일치하는 계정에 인증된 복구 이메일이 있으면 안내를 보냅니다. 받은편지함과 스팸함을 확인해 주세요. 계정 정보는 이 화면에 표시하지 않습니다.", "If a matching account has a verified recovery email, instructions will be sent there. Check your inbox and spam folder. Account details are not displayed here.", "一致するアカウントに確認済みの復旧メールがある場合、案内を送信します。受信箱と迷惑メールをご確認ください。この画面にはアカウント情報を表示しません。");
  return <div className="sg-recovery-page"><header><Link href="/login">SemiGuard AI</Link><ProductLanguageSelect language={language} onChange={setLanguage} /></header>
    <main className="sg-recovery-card">
      <p className="sg-recovery-eyebrow">ACCOUNT RECOVERY</p><h1>{title}</h1>
      <p>{view === "request" ? l("미리 인증한 복구 이메일로 안내를 받아 계정을 다시 이용하세요.", "Use your previously verified recovery email to regain access.", "事前に確認した復旧メールで案内を受け取り、再びログインできます。") : view === "verify" ? l("아래 버튼으로 이 이메일의 소유를 확인해 주세요.", "Confirm that this email address belongs to you.", "下のボタンで、このメールがご自身のものであることを確認してください。") : l("새 비밀번호를 입력해 주세요.", "Enter your new password.", "新しいパスワードを入力してください。")}</p>
      {view === "request" && <div className="sg-recovery-options" role="group" aria-label={l("찾을 정보", "What do you need?", "確認する情報")}>
        <button type="button" aria-pressed={purpose === "id"} disabled={busy} onClick={() => { setPurpose("id"); setIdentifier(""); clear(); }}>{l("아이디 찾기", "Find ID", "IDを確認")}</button>
        <button type="button" aria-pressed={purpose === "password"} disabled={busy} onClick={() => { setPurpose("password"); setIdentifier(""); clear(); }}>{l("비밀번호 재설정", "Reset password", "パスワード再設定")}</button>
      </div>}
      {availability.isLoading ? <p role="status">{l("이메일 복구 이용 가능 여부를 확인하는 중…", "Checking email recovery availability…", "メール復旧の利用状況を確認中…")}</p> : availability.isError ? <div role="alert"><p>{l("복구 서비스 상태를 불러오지 못했습니다.", "Could not load the recovery service status.", "復旧サービスの状態を取得できませんでした。")}</p><button type="button" className="sg-recovery-secondary" onClick={() => { void availability.refetch(); }}>{l("다시 확인", "Check again", "再確認")}</button></div> : !ready ? <p className="sg-recovery-notice" role="status">{l("이메일 복구 준비 중입니다. 메일 발송 연결 후 이용할 수 있습니다. 연결해 둔 소셜 계정이 있다면 로그인 화면에서 이용해 주세요.", "Email recovery is being prepared. It will be available after email delivery is connected. If you have a linked social account, use it on the sign-in page.", "メールによる復旧は準備中です。メール送信の接続後にご利用いただけます。連携済みのソーシャルアカウントがあればログイン画面からご利用ください。")}</p> : null}
      {done ? <p ref={notice} tabIndex={-1} role="status" className="sg-recovery-success">{success}</p> : ready && view !== "request" && !token ? <p className="sg-recovery-error" role="alert">{l("메일에 포함된 링크로 다시 열어 주세요. 링크가 없거나 만료되었다면 새로 요청해 주세요.", "Open the link from your email. If it is missing or expired, request a new one.", "メールにあるリンクから開いてください。リンクがない場合や期限切れの場合は、新しくリクエストしてください。")}</p> : ready && <form onSubmit={event => { void submit(event); }}>
        {view === "request" ? <>
          {purpose === "password" && <fieldset disabled={busy}><legend>{l("찾는 방법", "Find by", "確認方法")}</legend><div className="sg-recovery-options">
            <label><input type="radio" name="method" value="id" checked={method === "id"} onChange={() => { setMethod("id"); setIdentifier(""); clear(); }} />{l("아이디로 찾기", "Sign-in ID", "ログインID")}</label>
            <label><input type="radio" name="method" value="email" checked={method === "email"} onChange={() => { setMethod("email"); setIdentifier(""); clear(); }} />{l("등록된 이메일로 찾기", "Registered email", "登録済みメール")}</label>
          </div></fieldset>}
          <label htmlFor="recovery-identifier">{actualMethod === "id" ? l("로그인 아이디", "Sign-in ID", "ログインID") : l("인증된 복구 이메일", "Verified recovery email", "確認済みの復旧メール")}</label>
          <input id="recovery-identifier" type={actualMethod === "email" ? "email" : "text"} autoComplete={actualMethod === "email" ? "email" : "username"} autoCapitalize="none" spellCheck={false} maxLength={actualMethod === "email" ? 320 : 64} value={identifier} onChange={event => { setIdentifier(event.target.value); clear(); }} required disabled={busy} aria-invalid={fieldError === "identifier" || undefined} aria-describedby={fieldError === "identifier" ? "recovery-request-help recovery-error" : "recovery-request-help"} />
          <p id="recovery-request-help" className="sg-recovery-help">{purpose === "id" ? l("인증한 이메일로 로그인 아이디를 보냅니다.", "Your sign-in ID will be sent to your verified email.", "確認済みメールにログインIDを送信します。") : l("입력 정보가 일치하면 인증한 이메일로 15분 동안 유효한 링크를 보냅니다.", "If the details match, a link valid for 15 minutes is sent to your verified email.", "入力情報が一致した場合、確認済みメールに15分間有効なリンクを送信します。")}</p>
        </> : view === "reset" ? <>
          <label htmlFor="recovery-password">{l("새 비밀번호", "New password", "新しいパスワード")}</label><input id="recovery-password" type="password" autoComplete="new-password" minLength={10} maxLength={128} value={password} onChange={event => { setPassword(event.target.value); clear(); }} required disabled={busy} aria-describedby="recovery-password-help" />
          <p id="recovery-password-help" className="sg-recovery-help">{l("10~128자. 다른 사이트와 겹치지 않는 긴 비밀번호를 권장합니다.", "10–128 characters. Use a long password unique to this site.", "10〜128文字。他のサイトと異なる長いパスワードを推奨します。")}</p>
          <label htmlFor="recovery-confirmation">{l("새 비밀번호 확인", "Confirm new password", "新しいパスワードの確認")}</label><input id="recovery-confirmation" type="password" autoComplete="new-password" minLength={10} maxLength={128} value={confirmation} onChange={event => { setConfirmation(event.target.value); clear(); }} required disabled={busy} aria-invalid={fieldError === "confirmation" || undefined} aria-describedby={fieldError === "confirmation" ? "recovery-error" : undefined} />
        </> : null}
        {error && <p id="recovery-error" ref={notice} tabIndex={-1} role="alert" className="sg-recovery-error">{error}</p>}
        <button className="sg-recovery-primary" type="submit" disabled={busy} aria-busy={busy || undefined}>{busy ? l("처리 중…", "Working…", "処理中…") : view === "verify" ? l("이메일 인증하기", "Verify email", "メールを確認") : view === "reset" ? l("비밀번호 변경", "Change password", "パスワードを変更") : l("이메일로 안내 받기", "Send email instructions", "メールで案内を受け取る")}</button>
      </form>}
      {view === "request" && <details className="sg-recovery-guidance"><summary>{l("복구 이메일을 등록하지 않았나요?", "No recovery email registered?", "復旧メールを登録していませんか？")}</summary><p>{l("기존 가입 때 입력한 이름·생년월일만으로는 계정을 복구할 수 없습니다. 로그인할 수 있을 때 계정 관리에서 복구 이메일을 등록하고 인증해 주세요. 연결한 소셜 계정이 있다면 그 계정으로 로그인할 수 있습니다.", "Your name and birth date alone cannot recover an account. While you can still sign in, register and verify a recovery email in account settings. You can also sign in with a previously linked social account.", "登録時の氏名・生年月日だけでは復旧できません。ログインできる間に、アカウント管理で復旧メールを登録・確認してください。事前に連携したソーシャルアカウントでもログインできます。")}</p></details>}
      <nav className="sg-recovery-footer"><Link href="/login">{l("로그인으로 돌아가기", "Back to sign in", "ログインへ戻る")}</Link>{view !== "request" && <Link href="/account/recovery">{l("새 복구 안내 요청", "Request a new link", "新しい案内をリクエスト")}</Link>}{view === "verify" && done && <Link href="/account">{l("계정 관리", "Account settings", "アカウント管理")}</Link>}</nav>
    </main>
  </div>;
}
