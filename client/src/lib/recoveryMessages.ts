import { tr, type ProductLanguage } from "./productLanguage";

export function recoveryFailure(message: string, language: ProductLanguage) {
  const l = (ko: string, en: string, ja: string) => tr(language, ko, en, ja);
  if (/RECOVERY_(?:EMAIL|ID)_INVALID/.test(message)) return l("입력한 아이디 또는 이메일 형식을 확인해 주세요.", "Check the format of your sign-in ID or email.", "入力したログインIDまたはメールの形式を確認してください。");
  if (/UNAVAILABLE|SERVICE_UNAVAILABLE/.test(message)) return l("이메일 복구를 아직 사용할 수 없습니다. 잠시 후 다시 확인해 주세요.", "Email recovery is not available yet. Please check again later.", "メールによる復旧はまだ利用できません。後ほど再度ご確認ください。");
  if (/RATE|TOO_MANY/.test(message)) return l("요청이 많습니다. 잠시 기다렸다가 다시 시도해 주세요.", "Too many requests. Wait a while before trying again.", "リクエストが多すぎます。しばらく待ってからお試しください。");
  if (/TOKEN|EXPIRED|INVALID/.test(message)) return l("이 링크는 만료되었거나 사용할 수 없습니다. 새 링크를 요청해 주세요.", "This link has expired or cannot be used. Request a new link.", "このリンクは期限切れか、利用できません。新しいリンクをリクエストしてください。");
  if (/PASSWORD|REAUTH/.test(message)) return l("현재 비밀번호를 확인하고 다시 시도해 주세요.", "Check your current password and try again.", "現在のパスワードを確認して、もう一度お試しください。");
  return l("요청을 완료하지 못했습니다. 연결 상태를 확인하고 다시 시도해 주세요.", "The request could not be completed. Check your connection and try again.", "リクエストを完了できませんでした。接続を確認して、もう一度お試しください。");
}
