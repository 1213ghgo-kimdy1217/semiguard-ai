import { z } from "zod";
import { recoveryQaMailAvailable, reserveRecoveryQaMail } from "./recoveryQa";

type Language = "ko" | "en" | "ja";
export type RecoveryMail = {
  to: string;
  language: Language;
  kind: "verify" | "password" | "id" | "changed";
  token?: string;
  loginId?: string;
};

// Server-only Brevo transactional API adapter. Account onboarding alone does not
// enable it: the recovery flag, verified sender, API key and public origin are required.
function configuration() {
  const apiKey = process.env.RECOVERY_MAIL_API_KEY;
  const from = process.env.RECOVERY_MAIL_FROM;
  const configuredOrigin = process.env.RECOVERY_PUBLIC_ORIGIN;
  if (!recoveryQaMailAvailable()) return null;
  if (process.env.SEMIGUARD_ACCOUNT_RECOVERY_ENABLED !== "1" || !apiKey || !from || !configuredOrigin) return null;
  if (!z.email().safeParse(from).success || /[\r\n]/.test(apiKey)) return null;
  try {
    const origin = new URL(configuredOrigin);
    if (origin.protocol !== "https:" || origin.username || origin.password || origin.pathname !== "/" || origin.search || origin.hash) return null;
    return { apiKey, from, origin: origin.origin };
  } catch { return null; }
}

export function recoveryMailAvailable() { return configuration() !== null; }

export function recoveryMailContent(input: RecoveryMail, origin: string) {
  const copy = {
    ko: {
      verify: "복구 이메일 인증", password: "비밀번호 재설정", id: "로그인 아이디 안내", changed: "비밀번호 변경 알림",
      verifyBody: "로그인한 SemiGuard 계정의 복구 이메일을 인증하려면 아래 링크를 여세요.",
      passwordBody: "SemiGuard 비밀번호를 재설정하려면 아래 링크를 여세요.",
      idBody: "이 이메일로 인증한 SemiGuard 계정의 로그인 아이디:",
      changedBody: "SemiGuard 계정의 비밀번호가 변경되어 기존 로그인 세션이 종료되었습니다. 새 비밀번호로 다시 로그인하세요.",
      expiry: "이 링크는 15분 동안 한 번만 사용할 수 있습니다. 원래 비밀번호는 알려드리거나 전송하지 않습니다.",
      ignore: "본인이 요청하지 않았다면 링크를 열지 마세요. 예상하지 못한 비밀번호 변경이라면 연결된 소셜 로그인으로 계정을 확인하고 운영자에게 문의하세요.",
    },
    en: {
      verify: "Verify recovery email", password: "Reset password", id: "Your sign-in ID", changed: "Password changed",
      verifyBody: "Open this link to verify the recovery email for your signed-in SemiGuard account.",
      passwordBody: "Open this link to reset your SemiGuard password.",
      idBody: "The sign-in ID for the SemiGuard account verified with this email:",
      changedBody: "Your SemiGuard password was changed and previous sign-in sessions were ended. Sign in again with your new password.",
      expiry: "This link expires in 15 minutes and can be used once. We never reveal or send your original password.",
      ignore: "If you did not request this, do not open the link. For an unexpected password change, check your account using linked social sign-in and contact the operator.",
    },
    ja: {
      verify: "復旧用メールの確認", password: "パスワードの再設定", id: "ログインIDのご案内", changed: "パスワード変更のお知らせ",
      verifyBody: "ログイン中のSemiGuardアカウントの復旧用メールを確認するには、以下のリンクを開いてください。",
      passwordBody: "SemiGuardのパスワードを再設定するには、以下のリンクを開いてください。",
      idBody: "このメールで確認したSemiGuardアカウントのログインID：",
      changedBody: "SemiGuardのパスワードが変更され、以前のログインセッションが終了しました。新しいパスワードで再ログインしてください。",
      expiry: "リンクの有効期間は15分で、1回のみ使用できます。元のパスワードを開示・送信することはありません。",
      ignore: "ご自身で要求していない場合、リンクを開かないでください。予期しないパスワード変更の場合は、連携済みのソーシャルログインで確認し、運営者へお問い合わせください。",
    },
  }[input.language];
  let body: string;
  if (input.kind === "id") {
    if (!input.loginId || input.loginId.length > 64 || /[\r\n]/.test(input.loginId)) throw new Error("RECOVERY_MAIL_INVALID");
    body = `${copy.idBody}\n${input.loginId}`;
  } else if (input.kind === "changed") {
    body = copy.changedBody;
  } else {
    if (!input.token || !/^[A-Za-z0-9_-]{43}$/.test(input.token)) throw new Error("RECOVERY_MAIL_INVALID");
    const path = input.kind === "verify" ? "verify" : "reset";
    const url = new URL(`/account/recovery/${path}`, origin);
    url.hash = `token=${input.token}`;
    body = `${input.kind === "verify" ? copy.verifyBody : copy.passwordBody}\n\n${url.href}\n\n${copy.expiry}`;
  }
  return { subject: `SemiGuard AI · ${copy[input.kind]}`, text: `${body}\n\n${copy.ignore}` };
}

export async function sendRecoveryMail(input: RecoveryMail) {
  const config = configuration();
  if (!config) throw new Error("RECOVERY_MAIL_UNAVAILABLE");
  if (!z.email().safeParse(input.to).success) throw new Error("RECOVERY_MAIL_INVALID");
  const content = recoveryMailContent(input, config.origin);
  await reserveRecoveryQaMail(input.to);
  // Fixed HTTPS destination, bounded timeout, no logging of recipients, tokens,
  // authorization headers, response bodies or provider errors.
  try {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": config.apiKey, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        sender: { name: "SemiGuard AI", email: config.from },
        to: [{ email: input.to }],
        subject: content.subject,
        textContent: content.text,
      }),
      signal: AbortSignal.timeout(8000),
      redirect: "error",
    });
    if (!response.ok) throw new Error("RECOVERY_MAIL_FAILED");
    await response.body?.cancel();
  } catch { throw new Error("RECOVERY_MAIL_FAILED"); }
}
