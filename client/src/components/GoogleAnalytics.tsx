import React, { createContext, useCallback, useContext, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { useLocation } from "wouter";
import { analyticsCampaign, analyticsPage, GA_CONSENT_DAYS, GA_CONSENT_KEY, GA_ID, GA_ORIGIN, GoogleAnalyticsController, parseAnalyticsConsent, type AnalyticsConsent } from "../lib/googleAnalytics";
import { practiceMeasurementTransition } from "../../../shared/practiceMeasurement";
import { tr, useProductLanguage, type ProductLanguage } from "../lib/productLanguage";
import "./practice-measurement.css";

type GaWindow = Window & { semiguardGaLayer?: IArguments[]; "ga-disable-G-QRC8S79SK3"?: boolean };
function readConsent(): AnalyticsConsent {
  try { return parseAnalyticsConsent(localStorage.getItem(GA_CONSENT_KEY)); }
  catch { return parseAnalyticsConsent(null); }
}
function clearGaCookies() {
  try {
    for (const item of document.cookie.split(";")) {
      const name = item.split("=")[0].trim();
      if (name === "_ga" || name.startsWith("_ga_")) document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax; Secure`;
    }
  } catch { /* The disable flag remains on even if the browser blocks cookie access. */ }
}
type Controls = { enabled: boolean; qa: boolean; failed: boolean; setConsent: (enabled: boolean, qa?: boolean) => void;
  track: (kind: "practice_started" | "practice_completed") => void };
const Context = createContext<Controls | null>(null);

export function GoogleAnalyticsProvider({ children }: { children: ReactNode }) {
  const [path] = useLocation();
  const [consent, setState] = useState(readConsent);
  const [failed, setFailed] = useState(false);
  const controller = useRef<GoogleAnalyticsController | null>(null);
  if (controller.current === null && typeof window !== "undefined") {
    const w = window as GaWindow;
    controller.current = new GoogleAnalyticsController({
      isCanonical: () => window.location.origin === GA_ORIGIN,
      consent: readConsent,
      disable: value => { w[`ga-disable-${GA_ID}`] = value; },
      discardQueue: () => { if (w.semiguardGaLayer) w.semiguardGaLayer.length = 0; },
      clearCookies: clearGaCookies,
      send: function () { (w.semiguardGaLayer ??= []).push(arguments); },
      load: onError => {
        if (document.getElementById("semiguard-google-analytics")) return;
        const script = document.createElement("script");
        script.id = "semiguard-google-analytics";
        script.async = true;
        script.referrerPolicy = "no-referrer";
        script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}&l=semiguardGaLayer`;
        script.onerror = () => { script.remove(); onError(); setFailed(true); };
        document.head.append(script);
      },
    }, analyticsCampaign(window.location.search));
  }
  const setConsent = useCallback((enabled: boolean, qa = false) => {
    // Stop immediately before storage writes, including on storage failures.
    controller.current?.block();
    try {
      const next = { enabled, qa, expires: Date.now() + GA_CONSENT_DAYS * 86400000 };
      if (enabled) localStorage.setItem(GA_CONSENT_KEY, JSON.stringify(next));
      else localStorage.removeItem(GA_CONSENT_KEY);
      if (enabled) controller.current?.allow();
      setState(readConsent()); setFailed(false);
    } catch { setState(parseAnalyticsConsent(null)); setFailed(true); }
  }, []);
  useLayoutEffect(() => { controller.current?.sync(path); }, [path, consent]);
  useEffect(() => {
    const sync = () => { const next = readConsent(); if (!next.enabled) controller.current?.stop(true); setState(next); };
    const storage = (e: StorageEvent) => {
      if (e.key !== GA_CONSENT_KEY && e.key !== null) return;
      if (parseAnalyticsConsent(e.newValue).enabled) { controller.current?.allow(); setFailed(false); }
      sync();
    };
    const visible = () => { if (document.visibilityState === "visible") sync(); };
    window.addEventListener("storage", storage);
    document.addEventListener("visibilitychange", visible);
    const timeout = consent.enabled ? window.setTimeout(sync, Math.min(Math.max(0, consent.expires - Date.now()), 2147483647)) : undefined;
    return () => { window.removeEventListener("storage", storage); document.removeEventListener("visibilitychange", visible); window.clearTimeout(timeout); };
  }, [consent]);
  useEffect(() => () => controller.current?.stop(), []);
  const track = useCallback((kind: "practice_started" | "practice_completed") => controller.current?.track(kind), []);
  return <Context.Provider value={{ enabled: consent.enabled && !failed, qa: consent.qa, failed, setConsent, track }}>{children}</Context.Provider>;
}

/** Independent from the existing first-party measurement consent. */
export function useGoogleAnalyticsPractice(running: boolean, reviewed: boolean, cycle: string) {
  const controls = useContext(Context);
  const state = useRef({ cycle, started: false });
  useEffect(() => {
    if (state.current.cycle !== cycle) state.current = { cycle, started: false };
    const next = practiceMeasurementTransition(controls?.enabled === true, running, reviewed, state.current.started);
    state.current.started = next.started;
    if (next.event) controls?.track(next.event);
  }, [controls?.enabled, controls?.track, running, reviewed, cycle]);
}

export default function GoogleAnalyticsConsent() {
  const controls = useContext(Context);
  const [language] = useProductLanguage();
  const [path] = useLocation();
  if (!controls) return null;
  return <GoogleAnalyticsNotice controls={controls} language={language} path={path} />;
}

export function GoogleAnalyticsNotice({ controls, language, path }: { controls: Controls; language: ProductLanguage; path: string }) {
  const [checked, setChecked] = useState(false), [qa, setQa] = useState(false);
  const id = useId();
  const l = (ko: string, en: string, ja: string) => tr(language, ko, en, ja);
  return <div className="sg-ga-footer"><details className="sg-measurement">
    <summary>{l("선택 · Google Analytics 측정 설정", "Optional · Google Analytics settings", "任意 · Google Analyticsの設定")}<span>{controls.enabled ? controls.qa ? "QA ON" : "ON" : "OFF"}</span></summary>
    <div className="sg-measurement-body">
      <p>{l("동의한 경우에만 Google Analytics로 방문·연습 시작·제출 후 복기 이벤트를 보냅니다. Google의 기본 세션 이벤트와 쿠키 식별자·접속 기술 정보도 처리될 수 있습니다. 이름·이메일·답안·AI 대화·개인 기록 링크는 보내지 않습니다.",
        "Only with your consent, Google Analytics receives page visits, practice starts and submitted reviews. Google also processes basic session events, cookie identifiers and technical connection information. We do not send names, emails, answers, AI chats or personal record links.",
        "同意した場合のみGoogle Analyticsに訪問・練習開始・提出後の振り返りイベントを送信します。基本セッションイベント、Cookie識別子、接続技術情報も処理される場合があります。名前・メール・回答・AI会話・個人記録リンクは送信しません。")}</p>
      <p>{l("미국의 Google LLC가 처리하는 외부 측정이며 완전 익명 통계가 아닙니다. 광고 기능은 사용하지 않고, 동의 선택과 브라우저 구분 쿠키는 최대 30일 유지합니다. 기존 자체 이용 측정과 별개의 선택이며 거절해도 모든 이용 조건은 동일합니다. 이 화면에서 언제든 철회할 수 있고, 철회 전 전송된 자료는 소급 삭제되지 않습니다.",
        "This is separate external measurement processed by Google LLC in the US, not fully anonymous statistics. Advertising is disabled. Consent and browser cookies last up to 30 days. This is independent of our own usage measurement; declining does not restrict access. Withdraw here at any time; already transmitted data is not retroactively deleted.",
        "米国Google LLCによる外部計測で、完全に匿名の統計ではありません。広告機能は使用せず、同意とブラウザーCookieは最長30日間保持します。独自利用計測とは別の任意選択で、拒否しても利用条件は変わりません。ここでいつでも撤回できますが、送信済みデータは遡って削除されません。")}</p>
      <p><a href="https://policies.google.com/technologies/partner-sites" target="_blank" rel="noreferrer">{l("Google의 정보 처리 안내", "How Google processes information", "Googleの情報処理について")}</a></p>
      <p>{l("이 GA4 속성의 사용자·이벤트 원본 보관은 2개월이며 새 활동에 따른 자동 연장을 껐습니다. 합산 집계 보고서는 이 보관 기간과 별개입니다.",
        "This GA4 property retains user/event-level data for two months without renewal on new activity. Aggregated reports are separate from this retention setting.",
        "このGA4プロパティのユーザー・イベント単位データは2か月保持し、新規活動による自動延長を無効にしています。集計レポートはこの保持設定とは別です。")}</p>
      <div className="sg-measurement-actions">
      {controls.enabled ? <>
        <p>{analyticsPage(path) === null ? l("동의 상태지만 개인 기록·공유·운영 화면에서는 측정하지 않습니다.", "Consent is on, but personal records, shared links and admin pages are not measured.", "同意済みですが、個人記録・共有リンク・管理画面は計測しません。") : controls.qa ? l("테스트 표시로 전송합니다. 실제 사용자 성과에 포함하지 마세요.", "Sent with test flags. Exclude it from real participant results.", "テスト印付きで送信します。実参加者の成果には含めないでください。") : l("Google Analytics 측정을 선택했습니다.", "You opted in to Google Analytics.", "Google Analyticsの計測を選択しました。")}</p>
        <button type="button" onClick={() => controls.setConsent(false)}>{l("Google 측정 동의 철회", "Withdraw Google measurement consent", "Google計測への同意を撤回")}</button>
      </> : <>
        <label htmlFor={`${id}-ga`}><input id={`${id}-ga`} type="checkbox" checked={checked} onChange={e => setChecked(e.target.checked)} />{l("위 Google 전송에 동의합니다 (선택)", "I consent to this Google transfer (optional)", "上記のGoogle送信に同意します（任意）")}</label>
        <label htmlFor={`${id}-test`}><input id={`${id}-test`} type="checkbox" checked={qa} onChange={e => setQa(e.target.checked)} />{l("팀원·테스트 참여자입니다", "I am a team member or tester", "チームメンバー・テスト参加者です")}</label>
        <button type="button" disabled={!checked} onClick={() => controls.setConsent(true, qa)}>{l("Google 측정 켜기", "Enable Google measurement", "Google計測を有効化")}</button>
        <button type="button" onClick={() => { setChecked(false); controls.setConsent(false); }}>{l("동의하지 않고 이용", "Continue without consenting", "同意せずに利用")}</button>
      </>}
      </div>
      {controls.failed ? <p role="status">{l("설정 저장 또는 측정 연결에 실패해 현재 창의 Google 측정을 중단했습니다. 연습·로그인·저장은 이용할 수 있습니다. 새로고침·다음 방문 때 동의 상태를 다시 확인해 주세요.", "Settings or measurement failed; Google measurement is stopped in this tab. Practice, sign-in and saving remain available. Recheck your choice after refresh or your next visit.", "設定保存または計測接続に失敗し、このタブのGoogle計測を停止しました。練習・ログイン・保存は利用できます。更新時や次回訪問時に同意状態を確認してください。")}</p> : null}
    </div>
  </details></div>;
}
