import React, { useEffect, useState, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "../_core/hooks/useAuth";
import { tr, useProductLanguage } from "../lib/productLanguage";
import { consumeSharedTrainingReturn, rememberSharedTrainingReturn } from "../lib/sharedTrainingReturn";

/** All learning workspaces mount only after the existing session is resolved. */
export default function PracticeAccess({ children, fullNavigation = false }: { children: ReactNode; fullNavigation?: boolean }) {
  const { user, loading, error, refresh } = useAuth();
  const [path] = useLocation();
  const pathname = path.split(/[?#]/, 1)[0];
  const sharing = pathname === "/training/shared";
  const keepShareForSignIn = sharing
    ? () => rememberSharedTrainingReturn(window.location.hash)
    : undefined;
  const NavigationLink = fullNavigation ? "a" : Link;
  const [language] = useProductLanguage();
  const [isSlowLoading, setIsSlowLoading] = useState(false);
  const l = (ko: string, en: string, ja: string) => tr(language, ko, en, ja);
  useEffect(() => {
    setIsSlowLoading(false);
    if (!loading) return;
    const timer = window.setTimeout(() => setIsSlowLoading(true), 8000);
    return () => window.clearTimeout(timer);
  }, [loading]);
  useEffect(() => {
    if (loading || error || !user) return;
    if (pathname === "/training") {
      const target = consumeSharedTrainingReturn();
      if (target) window.location.replace(target);
    } else if (sharing) {
      // This link is already open with a session, so no return is needed.
      consumeSharedTrainingReturn();
    }
  }, [loading, error, user, pathname, sharing]);

  // Never mount a full workspace while identity is unresolved.
  if (loading) return <div className="et-app" aria-busy="true"><main className="et-main">
    <div role="status" aria-live="polite" aria-atomic="true">
      <p className="et-eyebrow">SEMIGUARD / SESSION CHECK</p>
      <p><strong>SemiGuard AI</strong><br /><span>{l("반도체 장비 센서 판단 교육·점검 보조", "Semiconductor sensor reasoning and inspection aid", "半導体装置の信号判断学習・点検支援")}</span></p>
      <div aria-hidden="true" className="h-7 w-7 animate-spin motion-reduce:animate-none rounded-full border-2 border-amber-300 border-t-transparent" />
      <p>{l("보안 로그인 상태를 확인하고 있습니다.", "Verifying your secure sign-in…", "安全なログイン状態を確認しています。")}</p>
    </div>
    {isSlowLoading ? <div>
      <p>{l("확인이 평소보다 오래 걸리고 있습니다. 연결을 확인하고 다시 시도하세요.", "Verification is taking longer than usual. Check your connection and try again.", "確認に通常より時間がかかっています。接続を確認して再試行してください。")}</p>
      <button className="et-linkbutton" type="button" onClick={() => { void refresh(); }}>{l("다시 확인", "Try again", "再確認")}</button>
      <NavigationLink href="/login" onClick={keepShareForSignIn}>{l("로그인 화면으로 이동", "Go to sign in", "ログイン画面へ")}</NavigationLink>
    </div> : null}
  </main></div>;

  if (error) return <div className="et-app"><main className="et-main">
    <h1>{l("로그인 상태를 확인하지 못했어요.", "We could not check your sign-in status.", "ログイン状態を確認できませんでした。")}</h1>
    <p role="alert">{l("연결을 확인하고 다시 시도하세요. 계정 기록은 변경하지 않았습니다.", "Check your connection and try again. Your account records have not been changed.", "接続を確認して再試行してください。アカウントの記録は変更していません。")}</p>
    <div className="et-actions">
      <button className="et-linkbutton" type="button" onClick={() => { void refresh(); }}>{l("다시 확인", "Try again", "再確認")}</button>
      <NavigationLink href="/login" onClick={keepShareForSignIn}>{l("로그인 화면", "Sign-in page", "ログイン画面")}</NavigationLink>
      <NavigationLink href="/welcome">{l("서비스 소개", "About SemiGuard", "サービス紹介")}</NavigationLink>
    </div>
  </main></div>;

  if (!user) return <div className="et-app"><main className="et-main">
    <p className="et-eyebrow">SIGN IN / YOUR LEARNING SPACE</p>
    <h1>{l("로그인 후 학습 공간을 이용할 수 있어요.", "Sign in to enter your learning space.", "ログインして学習スペースをご利用ください。")}</h1>
    <p>{l("공정 학습·판단 연습·장비 모형 실습과 공유 기록 열람은 로그인 후 이용합니다.", "Process learning, judgment practice, equipment labs and shared records require sign-in.", "工程学習・判断練習・装置模型の実習・共有記録の閲覧にはログインが必要です。")}</p>
    {sharing ? <p>{l("로그인하면 이 공유 기록으로 돌아갑니다. 기록이 열리지 않으면 받은 링크를 다시 열어주세요.", "Sign in to return to this shared record. If it doesn’t open, reopen the link you received.", "ログインすると、この共有記録に戻ります。開かない場合は、受け取ったリンクをもう一度開いてください。")}</p> : null}
    <div className="et-actions">
      <NavigationLink className="et-linkbutton" href="/login" onClick={keepShareForSignIn}>{l("로그인하고 시작하기", "Sign in to start", "ログインして始める")}</NavigationLink>
      <NavigationLink href="/signup" onClick={keepShareForSignIn}>{l("회원가입", "Create an account", "アカウント作成")}</NavigationLink>
      <NavigationLink href="/welcome">{l("서비스 소개로", "Back to the introduction", "サービス紹介へ")}</NavigationLink>
    </div>
  </main></div>;
  return <>{children}</>;
}
