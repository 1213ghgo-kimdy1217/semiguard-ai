import React, { useEffect, useRef, useState, type FormEvent } from "react";
import { trpc } from "../lib/trpc";
import { tr, type ProductLanguage } from "../lib/productLanguage";
import { recoveryFailure } from "../lib/recoveryMessages";
import "../pages/account-recovery.css";

export default function RecoveryEmailSettings({ language }: { language: ProductLanguage }) {
  const l = (ko: string, en: string, ja: string) => tr(language, ko, en, ja);
  const status = trpc.accountRecovery.status.useQuery(undefined, { retry: false, refetchOnWindowFocus: true });
  const enroll = trpc.accountRecovery.enroll.useMutation({ retry: false, gcTime: 0 });
  const [email, setEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [error, setError] = useState("");
  const [passwordError, setPasswordError] = useState(false);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const notice = useRef<HTMLParagraphElement>(null);
  useEffect(() => { if (error || sent) notice.current?.focus(); }, [error, sent]);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!status.data?.available || status.isLoading || status.isError || lock.current) return;
    lock.current = true; setBusy(true); setError(""); setPasswordError(false); setSent(false);
    try {
      await enroll.mutateAsync({ email: email.trim(), currentPassword, language });
      setSent(true); setCurrentPassword("");
    } catch (failure) {
      const message = failure instanceof Error ? failure.message : "";
      setError(recoveryFailure(message, language)); setPasswordError(/REAUTH/.test(message));
      setCurrentPassword("");
    } finally { enroll.reset(); setBusy(false); lock.current = false; }
  };
  return <section className="sg-recovery-settings" aria-labelledby="recovery-email-heading"><h2 id="recovery-email-heading">{l("복구 이메일", "Recovery email", "復旧メール")}</h2>
    <p>{l("아이디나 비밀번호를 잊었을 때 사용할 이메일을 미리 등록하고 인증해 두세요.", "Register and verify an email in advance in case you forget your ID or password.", "IDやパスワードを忘れたときのために、メールを事前に登録・確認してください。")}</p>
    {status.isLoading ? <p role="status">{l("등록 상태 확인 중…", "Checking registration…", "登録状態を確認中…")}</p> : status.isError ? <div role="alert"><p>{l("복구 이메일 상태를 불러오지 못했습니다.", "Could not load your recovery email status.", "復旧メールの状態を取得できませんでした。")}</p><button type="button" className="sg-recovery-secondary" onClick={() => { void status.refetch(); }}>{l("다시 확인", "Check again", "再確認")}</button></div> : !status.data?.available ? <p role="status" className="sg-recovery-notice">{l("이메일 발송 연결 준비 중입니다. 연결 후 복구 이메일을 등록할 수 있습니다.", "Email delivery is being prepared. You can register a recovery email after it is connected.", "メール送信の接続を準備中です。接続後に復旧メールを登録できます。")}</p> : !status.data.loginId ? <p>{l("이 계정은 연결된 소셜 로그인으로 이용해 주세요. 비밀번호 계정만 복구 이메일을 등록할 수 있습니다.", "Use the linked social sign-in for this account. Recovery email registration is available for password accounts.", "このアカウントは連携済みのソーシャルログインをご利用ください。復旧メールはパスワードのあるアカウントで登録できます。")}</p> : <>
      <p>{status.data.verifiedEmail ? <>{l("인증된 이메일", "Verified email", "確認済みメール")} · <strong>{status.data.verifiedEmail}</strong></> : l("아직 인증된 복구 이메일이 없습니다.", "No recovery email has been verified yet.", "確認済みの復旧メールはまだありません。")}</p>
      <form onSubmit={event => { void submit(event); }}>
        <label htmlFor="recovery-enroll-email">{l("복구에 사용할 이메일", "Email for account recovery", "復旧に使うメール")}</label><input id="recovery-enroll-email" type="email" autoComplete="email" autoCapitalize="none" maxLength={320} spellCheck={false} value={email} onChange={event => { setEmail(event.target.value); setError(""); setSent(false); }} required disabled={busy} />
        <label htmlFor="recovery-current-password">{l("현재 비밀번호", "Current password", "現在のパスワード")}</label><input id="recovery-current-password" type="password" autoComplete="current-password" maxLength={128} value={currentPassword} onChange={event => { setCurrentPassword(event.target.value); setError(""); setPasswordError(false); setSent(false); }} required disabled={busy} aria-invalid={passwordError || undefined} aria-describedby={passwordError ? "recovery-enroll-error" : undefined} />
        <p>{l("인증 전에는 기존 복구 이메일이 유지됩니다. 받은 메일의 링크는 15분 동안 유효합니다.", "Your current recovery email stays active until the new one is verified. The emailed link is valid for 15 minutes.", "新しいメールを確認するまでは、現在の復旧メールが有効です。メールのリンクは15分間有効です。")}</p>
        <p className="sg-recovery-help">{l("인증한 이메일 주소와 인증 시각을 계정에 보관합니다. 메일 발송을 위해 복구 이메일 주소와 아이디 또는 일회용 링크를 Brevo에 전달하며, 비밀번호는 전달하지 않습니다. 탈퇴 후에도 받은 메일과 메일 서비스 로그는 남을 수 있습니다.", "Your verified email address and verification time are saved with your account. For delivery, Brevo receives the recovery email address and your sign-in ID or a one-time link, never your password. Received emails and the provider's logs may remain after account deletion.", "確認済みのメールアドレスと確認日時をアカウントに保存します。メール送信のため、復旧用メールアドレスとログインIDまたは使い捨てリンクをBrevoに渡します。パスワードは渡しません。退会後も受信済みメールや送信サービスのログが残る場合があります。")}</p>
        {error && <p id="recovery-enroll-error" ref={notice} tabIndex={-1} role="alert" className="sg-recovery-error">{error}</p>}
        {sent && <p ref={notice} tabIndex={-1} role="status" className="sg-recovery-success">{l("인증 안내를 요청했습니다. 받은편지함과 스팸함을 확인해 주세요. 인증을 마친 뒤 이 화면에서 상태를 다시 확인하세요.", "Verification instructions were requested. Check your inbox and spam folder. After verifying, check the status again here.", "確認案内をリクエストしました。受信箱と迷惑メールをご確認ください。確認後、この画面で状態を再確認してください。")}</p>}
        <button type="submit" className="sg-recovery-primary" disabled={busy} aria-busy={busy || undefined}>{busy ? l("요청 중…", "Requesting…", "送信中…") : l("인증 이메일 받기", "Send verification email", "確認メールを受け取る")}</button>
        {sent && <button type="button" className="sg-recovery-secondary" onClick={() => { void status.refetch(); }}>{l("인증 상태 다시 확인", "Check verification status", "確認状態を再取得")}</button>}
      </form>
    </>}
  </section>;
}
