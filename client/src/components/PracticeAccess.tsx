import React, { type ReactNode } from "react";
import { Link } from "wouter";
import { useAuth } from "../_core/hooks/useAuth";
import { tr, useProductLanguage } from "../lib/productLanguage";
import TrainingPreview from "../pages/TrainingPreview";

/** Product access boundary. Personal data remains protected by server procedures. */
export default function PracticeAccess({ children }: { children: ReactNode }) {
  const { user, loading, error, refresh } = useAuth();
  const [language] = useProductLanguage();
  const l = (ko: string, en: string, ja: string) => tr(language, ko, en, ja);

  // Never mount a full workspace while identity is unresolved.
  if (loading) return <div className="et-app"><main className="et-main" role="status" aria-live="polite" aria-busy="true">
    <p className="et-eyebrow">SEMIGUARD / SESSION CHECK</p>
    <p>{l("로그인 상태를 확인하고 있습니다.", "Checking your sign-in status.", "ログイン状態を確認しています。")}</p>
    <Link className="et-linkbutton" href="/preview">{l("샘플 먼저 보기", "View the sample", "サンプルを見る")}</Link>
  </main></div>;

  if (error) return <div className="et-app"><main className="et-main">
    <h1>{l("로그인 상태를 확인하지 못했어요.", "We could not check your sign-in status.", "ログイン状態を確認できませんでした。")}</h1>
    <p role="alert">{l("연결을 확인하고 다시 시도하세요. 계정 기록은 변경하지 않았습니다.", "Check your connection and try again. Your account records have not been changed.", "接続を確認して再試行してください。アカウントの記録は変更していません。")}</p>
    <div className="et-actions">
      <button className="et-linkbutton" type="button" onClick={() => { void refresh(); }}>{l("다시 확인", "Try again", "再確認")}</button>
      <Link className="et-linkbutton" href="/preview">{l("샘플 먼저 보기", "View the sample", "サンプルを見る")}</Link>
      <Link href="/login">{l("로그인 화면", "Sign-in page", "ログイン画面")}</Link>
    </div>
  </main></div>;

  if (!user) return <TrainingPreview />;
  return <>{children}</>;
}
