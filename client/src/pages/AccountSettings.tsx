import React, { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { trpc } from "../lib/trpc";
import { tr, useProductLanguage, type ProductLanguage } from "../lib/productLanguage";
import AccountLogout, { useAccountSession } from "../components/AccountSession";
import ProductLanguageSelect from "../components/ProductLanguageSelect";
import { AlertDialog, AlertDialogContent, AlertDialogTitle, AlertDialogDescription, AlertDialogCancel } from "../components/ui/alert-dialog";
import "./account-settings.css";
import { WITHDRAWAL_COMPLETION_KEY, withdrawalWasConfirmed } from "../lib/withdrawalCleanup";

export function WithdrawalDisclosure({ language }: { language: ProductLanguage }) {
  const l = (ko: string, en: string, ja: string) => tr(language, ko, en, ja);
  return <>
    <h2>{l("탈퇴하면 삭제되는 자료", "What will be deleted", "退会で削除するデータ")}</h2>
    <ul><li>{l("이름·이메일·명찰 번호·생년월일·비밀번호 등 계정 정보", "Account profile, badge number, birth date and password hash", "氏名・メール・名札番号・生年月日・パスワードなどのアカウント情報")}</li>
      <li>{l("학습 결과·중간 저장·4센서 분석 기록·계정별 활동 기록", "Learning results, checkpoints, four-sensor records and account activity", "学習結果・中間保存・4センサー分析・アカウントの利用記録")}</li>
      <li>{l("상담 대화·답변 평가·등록한 텍스트 매뉴얼·데이터 공유 연결", "Consultation chats, answer feedback, text manuals and data-sharing connections", "相談履歴・回答評価・テキストマニュアル・データ共有の接続")}</li>
      <li>{l("SemiGuard의 Google·네이버·카카오 연결 정보 (각 서비스의 계정은 삭제하지 않습니다)", "SemiGuard's social-login links (not your Google, Naver or Kakao accounts)", "SemiGuard側のソーシャル連携情報（Google・Naver・Kakao自体のアカウントは削除しません）")}</li></ul>
    <h2>{l("삭제 범위에서 제외되는 자료", "Important limits", "削除範囲の制限")}</h2>
    <ul><li>{l("기존 익명 답안 공유 링크는 발급 후 최대 7일간 남을 수 있습니다. 이미 복사·다운로드된 자료는 회수할 수 없습니다.", "Existing anonymous choice-share links may remain valid for up to 7 days after issue. Copies or downloads cannot be recalled.", "既存の匿名回答リンクは発行後最大7日間残る場合があります。コピー・ダウンロード済みの資料は回収できません。")}</li>
      <li>{l("계정과 연결되지 않은 익명 이용 통계, 이미 외부 AI에 보낸 내용, 인프라 백업·로그의 즉시 삭제는 이 기능으로 보장하지 않습니다.", "This does not guarantee immediate erasure of unlinked anonymous metrics, content already sent to external AI, or infrastructure backups and logs.", "アカウントと紐づかない匿名統計、外部AIへ送信済みの内容、インフラのバックアップ・ログの即時削除は保証しません。")}</li>
      <li>{l("예전 로그인 차단을 위해 이름·이메일 대신 키로 해시한 인증 차단값과 처리 시각만 별도 보관합니다.", "A keyed authentication digest and processing time are retained to block old sign-ins, not your name or email.", "古いログインを遮断するため、氏名・メールではなく鍵付き認証ハッシュと処理時刻のみを別途保持します。")}</li>
      <li>{l("이 탭의 공정 연습 임시 저장은 정리합니다. 다른 기기·탭의 임시 자료와 내려받은 파일은 직접 지워주세요.", "This tab's process-practice drafts are cleared. Remove temporary copies on other tabs/devices and downloaded files yourself.", "このタブの工程練習の一時保存は整理します。別のタブ・端末の一時資料とダウンロード済みファイルはご自身で削除してください。")}</li></ul>
    <p className="sg-account-warning">{l("탈퇴는 복구할 수 없습니다. 다시 가입해도 이전 학습 기록은 돌아오지 않습니다.", "Deletion cannot be undone. Signing up again will not restore old records.", "退会は元に戻せません。再登録しても以前の記録は復元しません。")}</p>
  </>;
}

function withdrawalError(message: string, language: ProductLanguage) {
  const l = (ko: string, en: string, ja: string) => tr(language, ko, en, ja);
  if (message.includes("REAUTH")) return l("비밀번호를 확인해 주세요. 비밀번호가 없는 계정은 다시 로그인한 뒤 5분 안에 시도해 주세요.", "Check your password. Accounts without a password must sign in again and retry within 5 minutes.", "パスワードを確認してください。パスワードのないアカウントは再ログイン後5分以内にお試しください。");
  if (message.includes("ADMIN")) return l("관리자 계정은 운영 권한 이관 후 별도로 처리해야 합니다.", "Administrator accounts require an ownership handover first.", "管理者アカウントは先に運営権限の引き継ぎが必要です。");
  if (message.includes("FILES")) return l("별도 저장소의 업로드 파일이 있어 자동 탈퇴를 중단했습니다. 운영자의 파일 정리가 필요합니다. 계정은 삭제하지 않았습니다.", "Deletion was stopped because external uploaded files require operator cleanup. Your account was not deleted.", "別の保存先にアップロードファイルがあるため退会を中止しました。運営者による整理が必要です。アカウントは削除していません。");
  return l("탈퇴 완료를 확인하지 못했습니다. 연결과 로그인 상태를 확인해 주세요. 자동 재시도하지 않습니다.", "Deletion could not be confirmed. Check the connection and sign-in state. No automatic retry will occur.", "退会完了を確認できませんでした。接続とログイン状態を確認してください。自動再試行はしません。");
}

export default function AccountSettings() {
  const [language, setLanguage] = useProductLanguage();
  const l = (ko: string, en: string, ja: string) => tr(language, ko, en, ja);
  const session = useAccountSession();
  const auth = trpc.auth.me.useQuery();
  const status = trpc.auth.withdrawalStatus.useQuery(undefined, { retry: false });
  const withdrawal = trpc.auth.withdraw.useMutation({ retry: false });
  const [acknowledged, setAcknowledged] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [password, setPassword] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const opener = useRef<HTMLButtonElement>(null);
  const errorNotice = useRef<HTMLParagraphElement>(null);
  useEffect(() => { document.title = l("SemiGuard AI — 계정 관리", "SemiGuard AI — Account", "SemiGuard AI — アカウント管理"); }, [language]);
  useEffect(() => { if (error && !confirmOpen) errorNotice.current?.focus(); }, [error, confirmOpen]);
  const ready = Boolean(auth.data && session && status.data && !status.data.blocked && !status.isError);
  const allowed = ready && acknowledged && confirmation === "DELETE" && (!status.data?.passwordRequired || password.length > 0) && !busy;
  const remove = async () => {
    if (!allowed || lock.current || !auth.data || !session) return;
    lock.current = true; setBusy(true); setError("");
    try {
      const result = await withdrawal.mutateAsync({ confirmation: "DELETE", acknowledged: true, ...(status.data?.passwordRequired ? { password } : {}) });
      if (!result.success) throw new Error("Not confirmed");
      setPassword("");
      await session.completeWithdrawal(auth.data.id);
    } catch (failure) {
      setPassword(""); setError(withdrawalError(failure instanceof Error ? failure.message : "", language));
      setConfirmOpen(false); setBusy(false); lock.current = false;
    }
  };
  return <div className="sg-account-page"><header><Link href="/training">SemiGuard AI</Link><nav><ProductLanguageSelect language={language} onChange={setLanguage} /><AccountLogout language={language} /></nav></header>
    <main><p className="sg-account-eyebrow">ACCOUNT / PRIVACY</p><h1>{l("계정 관리", "Account settings", "アカウント管理")}</h1>
      <p>{l("학습 기록을 남겨두려면 로그아웃을, 계정과 연결된 자료를 지우려면 회원탈퇴를 선택하세요.", "Log out to keep your learning records. Delete your account to remove account-linked data.", "学習記録を残す場合はログアウト、アカウントに紐づく資料を削除する場合は退会を選んでください。")}</p>
      {auth.data?.name ? <p>{l("현재 로그인한 계정", "Currently signed in as", "現在ログイン中のアカウント")} · {auth.data.name}</p> : null}
      <section aria-labelledby="withdrawal-heading"><h2 id="withdrawal-heading">{l("회원탈퇴", "Delete account", "退会")}</h2><WithdrawalDisclosure language={language} />
        {status.isLoading ? <p role="status">{l("계정의 삭제 가능 상태를 확인하는 중…", "Checking account deletion availability…", "退会可能な状態か確認中…")}</p> : status.isError ? <div role="alert"><p>{l("상태를 불러오지 못했습니다. 삭제 요청은 보내지 않았습니다.", "Could not load the status. No deletion request was sent.", "状態を取得できませんでした。削除依頼は送信していません。")}</p><button onClick={() => { void status.refetch(); }}>{l("상태 다시 확인", "Check again", "再確認")}</button></div> : status.data?.blocked ? <p role="alert">{withdrawalError(status.data.blocked === "admin" ? "ADMIN" : "FILES", language)}</p> : null}
        <form onSubmit={event => { event.preventDefault(); if (allowed) setConfirmOpen(true); }}>
          <label className="sg-account-check"><input type="checkbox" checked={acknowledged} onChange={event => setAcknowledged(event.target.checked)} disabled={!ready || busy} />{l("삭제 범위와 남을 수 있는 자료를 읽었으며, 복구할 수 없음에 동의합니다.", "I understand the deletion scope, remaining data and irreversibility.", "削除範囲と残る可能性がある資料、復元できないことを確認しました。")}</label>
          {status.data?.passwordRequired ? <label>{l("현재 비밀번호", "Current password", "現在のパスワード")}<input type="password" autoComplete="current-password" value={password} maxLength={128} onChange={event => setPassword(event.target.value)} disabled={!ready || busy} required /></label> : ready ? <p>{l("비밀번호가 없는 계정은 다시 로그인한 뒤 5분 안에 탈퇴를 요청해야 합니다.", "Accounts without a password must sign in again and request deletion within 5 minutes.", "パスワードのないアカウントは再ログイン後5分以内に退会を依頼してください。")}</p> : null}
          <label>{l("확인을 위해 DELETE를 입력하세요.", "Type DELETE to confirm.", "確認のためDELETEと入力してください。")}<input value={confirmation} onChange={event => setConfirmation(event.target.value)} autoComplete="off" autoCapitalize="characters" spellCheck={false} disabled={!ready || busy} /></label>
          {error ? <p role="alert" tabIndex={-1} ref={errorNotice} className="sg-account-warning">{error}</p> : null}
          <div className="sg-account-actions"><Link href="/training">{l("학습으로 돌아가기", "Back to learning", "学習へ戻る")}</Link><button type="submit" className="sg-account-danger" ref={opener} disabled={!allowed}>{l("탈퇴 전 최종 확인", "Review deletion", "退会の最終確認")}</button></div>
        </form>
      </section>
      <AlertDialog open={confirmOpen} onOpenChange={open => { if (!busy) setConfirmOpen(open); }}><AlertDialogContent className="sg-account-confirm" onCloseAutoFocus={event => { event.preventDefault(); if (error) errorNotice.current?.focus(); else opener.current?.focus(); }}>
        <AlertDialogTitle>{l("계정과 연결된 자료를 정말 삭제할까요?", "Permanently delete account-linked data?", "アカウントと紐づく資料を削除しますか？")}</AlertDialogTitle>
        <AlertDialogDescription>{l("이 버튼을 누르면 되돌릴 수 없습니다. 삭제가 확인되면 로그아웃하며 다른 기기의 예전 로그인도 차단됩니다.", "This cannot be undone. Confirmed deletion signs you out and blocks old sign-ins on other devices.", "この操作は元に戻せません。削除を確認するとログアウトし、他の端末の古いログインも遮断します。")}</AlertDialogDescription>
        <div className="sg-account-actions"><AlertDialogCancel disabled={busy}>{l("취소 · 계정 유지", "Cancel · keep account", "キャンセル・アカウントを維持")}</AlertDialogCancel><button type="button" className="sg-account-danger" disabled={busy} aria-busy={busy || undefined} onClick={() => { void remove(); }}>{busy ? l("삭제 처리 중…", "Deleting…", "削除中…") : l("영구 탈퇴", "Delete permanently", "完全に退会")}</button></div>
      </AlertDialogContent></AlertDialog>
    </main></div>;
}

export function AccountClosed() {
  const [language] = useProductLanguage();
  const l = (ko: string, en: string, ja: string) => tr(language, ko, en, ja);
  const [confirmed] = useState(() => { try { return withdrawalWasConfirmed(sessionStorage.getItem(WITHDRAWAL_COMPLETION_KEY)); } catch { return false; } });
  useEffect(() => { try { sessionStorage.removeItem(WITHDRAWAL_COMPLETION_KEY); } catch { /* No identity or credential is stored in this one-time UI notice. */ } }, []);
  return <div className="sg-account-page"><main><p className="sg-account-eyebrow">ACCOUNT / PRIVACY</p><h1>{confirmed ? l("회원탈퇴가 완료되었습니다.", "Your account has been deleted.", "退会が完了しました。") : l("계정 처리 안내", "Account status", "アカウントの案内")}</h1><p>{confirmed ? l("계정과 연결된 자료를 삭제하고 로그인 정보를 차단했습니다. 이전 기록은 복구할 수 없습니다.", "Account-linked data was deleted and old sign-ins were blocked. Previous records cannot be restored.", "アカウントに紐づく資料を削除し、古いログインを遮断しました。以前の記録は復元できません。") : l("이 주소를 여는 것만으로는 탈퇴가 진행되지 않습니다. 계정 관리에서 상태와 처리 절차를 확인하세요.", "Opening this address does not delete an account. Use account settings to check the status and procedure.", "このURLを開くだけで退会は行われません。アカウント管理で状態と手順を確認してください。")}</p><Link href={confirmed ? "/" : "/account"}>{confirmed ? l("소개 화면으로", "Back to introduction", "紹介画面へ") : l("계정 관리로", "Account settings", "アカウント管理へ")}</Link></main></div>;
}
