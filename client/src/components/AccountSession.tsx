import React, { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut } from "lucide-react";
import { trpc } from "../lib/trpc";
import { tr, type ProductLanguage } from "../lib/productLanguage";
import { finishLocalLogout, isLogoutSignal, LOGOUT_SIGNAL_KEY, requestLogout } from "../lib/logoutSession";
import "./account-session.css";

type SessionControls = { signedIn: boolean; pending: boolean; failed: boolean; logout: () => Promise<void> };
const SessionContext = createContext<SessionControls | null>(null);

export function AccountSessionProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const auth = trpc.auth.me.useQuery(undefined, { retry: false, refetchOnWindowFocus: false });
  const mutation = trpc.auth.logout.useMutation({ retry: false });
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const busy = useRef(false);
  const channel = useRef<BroadcastChannel | null>(null);
  const signedIn = Boolean(auth.data);
  const localPorts = useCallback(() => ({
    cancelQueries: () => queryClient.cancelQueries(),
    clearFallback: () => {
      try { sessionStorage.removeItem("manus-cookie"); } catch { /* Restricted storage. */ }
      try { localStorage.removeItem("manus-runtime-user-info"); } catch { /* Restricted storage. */ }
    },
    clearCache: () => queryClient.clear(),
    // A full navigation also unmounts personal screens and in-memory AI chats.
    navigate: () => window.location.replace("/login"),
  }), [queryClient]);

  useEffect(() => {
    const receive = () => {
      if (busy.current) return;
      busy.current = true;
      setPending(true);
      void finishLocalLogout(localPorts());
    };
    const storage = (event: StorageEvent) => {
      if (event.key === LOGOUT_SIGNAL_KEY && isLogoutSignal(event.newValue)) receive();
    };
    window.addEventListener("storage", storage);
    try {
      channel.current = new BroadcastChannel(LOGOUT_SIGNAL_KEY);
      channel.current.onmessage = event => { if (event.data === "logout") receive(); };
    } catch { /* Storage events remain available when BroadcastChannel is absent. */ }
    return () => {
      window.removeEventListener("storage", storage);
      channel.current?.close();
      channel.current = null;
    };
  }, [localPorts]);

  const logout = async () => {
    if (busy.current || !signedIn) return;
    busy.current = true;
    setPending(true);
    setFailed(false);
    try {
      await requestLogout({
        ...localPorts(),
        request: () => mutation.mutateAsync(),
        notify: () => {
          // No account identifier, answers or credentials are shared between tabs.
          try { localStorage.setItem(LOGOUT_SIGNAL_KEY, JSON.stringify({ type: "logout", at: Date.now() })); } catch { /* Broadcast fallback. */ }
          try { channel.current?.postMessage("logout"); } catch { /* Storage fallback. */ }
        },
      });
    } catch {
      setFailed(true);
      setPending(false);
      busy.current = false;
    }
  };

  return <SessionContext.Provider value={{ signedIn, pending, failed, logout }}>{children}</SessionContext.Provider>;
}

export function AccountLogoutView({ language, signedIn, pending, failed, onLogout }: {
  language: ProductLanguage; signedIn: boolean; pending: boolean; failed: boolean; onLogout: () => void;
}) {
  if (!signedIn) return null;
  const l = (ko: string, en: string, ja: string) => tr(language, ko, en, ja);
  return <div className="sg-account-session">
    <button type="button" className="sg-account-logout" onClick={onLogout} disabled={pending}
      aria-busy={pending || undefined} title={l("저장된 학습 기록은 유지됩니다.", "Saved learning records are kept.", "保存済みの学習記録は残ります。")}
    ><LogOut size={16} aria-hidden="true" />{pending ? l("로그아웃 중…", "Logging out…", "ログアウト中…") : l("로그아웃", "Log out", "ログアウト")}</button>
    {failed ? <span role="alert">{l("로그아웃을 확인하지 못했습니다. 연결을 확인하고 다시 눌러주세요.", "Logout was not confirmed. Check your connection and try again.", "ログアウトを確認できませんでした。接続を確認して再試行してください。")}</span> : null}
  </div>;
}

export default function AccountLogout({ language }: { language: ProductLanguage }) {
  const session = useContext(SessionContext);
  return session ? <AccountLogoutView language={language} {...session} onLogout={() => { void session.logout(); }} /> : null;
}
