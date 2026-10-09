import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useLocation } from "wouter";
import { trpc } from "../lib/trpc";
import { tr, useProductLanguage } from "../lib/productLanguage";
import { practiceMeasurementTransition, type MeasurementEvent } from "../../../shared/practiceMeasurement";
import "./practice-measurement.css";

const syncKey = "semiguard:measurement-consent:v1";
type Controls = { consented: boolean; qa: boolean; busy: boolean; failed: boolean;
  setConsent: (enabled: boolean, qa?: boolean) => Promise<void>; track: (event: MeasurementEvent) => void };
const Context = createContext<Controls | null>(null);

export function PracticeMeasurementProvider({ children }: { children: ReactNode }) {
  const [path] = useLocation();
  const status = trpc.practiceMeasurement.status.useQuery(undefined, { retry: false, refetchOnWindowFocus: true });
  const consent = trpc.practiceMeasurement.consent.useMutation({ retry: false });
  const event = trpc.practiceMeasurement.track.useMutation({ retry: false });
  const [blocked, setBlocked] = useState(false);
  const [failed, setFailed] = useState(false);
  const allowed = !blocked && !status.isError && status.data?.consented === true;
  const allowedRef = useRef(allowed);
  allowedRef.current = allowed;
  const queue = useRef(Promise.resolve());
  const trackMutation = useRef(event.mutateAsync);
  trackMutation.current = event.mutateAsync;
  const refetch = useRef(status.refetch);
  refetch.current = status.refetch;
  const track = useCallback((kind: MeasurementEvent) => {
    if (!allowedRef.current) return;
    // Serialise this tab's start/completion, with no automatic repeat requests.
    queue.current = queue.current.then(async () => {
      if (!allowedRef.current) return;
      try {
        const result = await trackMutation.current({ event: kind });
        if (!result.accepted) { allowedRef.current = false; setBlocked(true); }
      } catch { setFailed(true); }
    });
  }, []);
  const setConsent = async (enabled: boolean, qa = false) => {
    // Stop new/queued events immediately, even if clearing the cookie fails.
    allowedRef.current = false;
    setBlocked(true); setFailed(false);
    if (!enabled) {
      try { localStorage.setItem(syncKey, JSON.stringify({ enabled: false, revision: Date.now() })); }
      catch { /* No local identifiers are stored. */ }
    }
    try {
      await consent.mutateAsync({ enabled, qa });
      try { localStorage.setItem(syncKey, JSON.stringify({ enabled, revision: Date.now() })); }
      catch { /* Cookie consent still works when localStorage is unavailable. */ }
      await status.refetch();
      setBlocked(!enabled);
    } catch { setFailed(true); }
  };
  useEffect(() => {
    const sync = (e: StorageEvent) => {
      if (e.key !== syncKey || !e.newValue) return;
      try {
        const value = JSON.parse(e.newValue);
        if (typeof value.enabled !== "boolean") return;
        allowedRef.current = false;
        setBlocked(!value.enabled);
        void refetch.current();
      } catch { /* Invalid optional sync messages cannot enable collection. */ }
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);
  useEffect(() => {
    const entry = ["/", "/welcome", "/login", "/preview", "/training", "/training/etch"].includes(path)
      || path.startsWith("/training/process/");
    if (allowed && entry) track("visit");
  }, [allowed, path, track]);
  return <Context.Provider value={{ consented: allowed, qa: status.data?.qa === true, busy: consent.isPending || status.isLoading,
    failed, setConsent, track }}>{children}</Context.Provider>;
}

export function usePracticeMeasurementTracking(running: boolean, reviewed: boolean, cycle: string) {
  const controls = useContext(Context);
  const state = useRef({ cycle, started: false });
  useEffect(() => {
    if (state.current.cycle !== cycle) state.current = { cycle, started: false };
    const next = practiceMeasurementTransition(controls?.consented === true, running, reviewed, state.current.started);
    state.current.started = next.started;
    if (next.event) controls?.track(next.event);
  }, [controls?.consented, controls?.track, running, reviewed, cycle]);
}

/** Optional measurement only; never gates samples, sign-in, answers or account saving. */
export default function PracticeMeasurementConsent() {
  const controls = useContext(Context);
  const [language] = useProductLanguage();
  const [checked, setChecked] = useState(false);
  const [qa, setQa] = useState(false);
  const id = useId();
  if (!controls) return null;
  const l = (ko: string, en: string, ja: string) => tr(language, ko, en, ja);
  return <details className="sg-measurement">
    <summary>{l("선택 · 사용성 개선을 위한 방문·연습 측정", "Optional · visit and practice measurement", "任意 · 訪問・練習の計測")}
      <span>{controls.consented ? controls.qa ? "QA ON" : "ON" : "OFF"}</span></summary>
    <div className="sg-measurement-body">
      <p>{l("동의한 브라우저의 임의 참여번호·방문/연습 시작/제출 후 복기 표시 시각만 기록합니다. 이름·연락처·답안은 이 측정에 포함하지 않습니다. 동의하지 않아도 동일하게 이용할 수 있습니다.",
        "We record an opaque browser identifier and visit, practice-start and post-submission review times only. No names, contacts or answers enter this measurement. Declining does not limit the service.",
        "同意したブラウザーのランダム識別番号と訪問・練習開始・提出後の振り返り表示時刻だけを記録します。名前・連絡先・回答は計測に含めません。同意しなくても同じように利用できます。")}</p>
      <p>{l("같은 브라우저를 구분하는 30일 쿠키를 사용합니다. 실제 사람 수와 같지 않으며 다른 기기·쿠키 삭제·재동의는 중복될 수 있습니다. 철회하면 새 수집을 중단하며 이미 수집한 이벤트는 집계용으로 남습니다.",
        "A 30-day cookie identifies a browser, not a person. Devices, cleared cookies and renewed consent can be counted again. Withdrawal stops new collection; existing events remain for aggregation.",
        "30日間のCookieで人ではなくブラウザーを識別します。別端末・Cookie削除・再同意で重複する場合があります。撤回後は新規収集を停止し、収集済みイベントは集計用に残ります。")}</p>
      {controls.consented ? <div className="sg-measurement-actions"><p>{controls.qa ? l("팀·테스트 모드: 공개 참여 지표에서 제외", "Team/test mode: excluded from participant metrics", "チーム・テストモード：参加指標から除外") : l("측정에 동의한 상태입니다.", "Measurement is enabled.", "計測に同意済みです。")}</p>
        <button type="button" disabled={controls.busy} onClick={() => void controls.setConsent(false)}>{l("측정 동의 철회", "Withdraw measurement consent", "計測への同意を撤回")}</button></div>
        : <div className="sg-measurement-actions">
          <label htmlFor={`${id}-consent`}><input id={`${id}-consent`} type="checkbox" checked={checked} onChange={e => setChecked(e.target.checked)} />{l("위 범위의 측정에 동의합니다 (선택)", "I agree to this measurement (optional)", "上記の範囲の計測に同意します（任意）")}</label>
          <label htmlFor={`${id}-qa`}><input id={`${id}-qa`} type="checkbox" checked={qa} onChange={e => setQa(e.target.checked)} />{l("저는 팀원·테스트 참여자입니다 (지표 제외)", "I am a team member/tester (exclude from metrics)", "チームメンバー・テスト参加者です（指標から除外）")}</label>
          <button type="button" disabled={!checked || controls.busy} onClick={() => void controls.setConsent(true, qa)}>{l("선택한 측정 시작", "Enable selected measurement", "選択した計測を開始")}</button>
        </div>}
      {controls.failed ? <p role="status">{l("측정 요청을 확인하지 못했습니다. 연습·계정 저장은 별개로 계속 사용할 수 있습니다. 철회 요청이 실패했다면 다시 철회해 주세요.", "Measurement could not be confirmed. Practice and account saving remain separate and usable. If withdrawal failed, try withdrawing again.", "計測の要求を確認できませんでした。練習・アカウント保存は別機能として利用できます。撤回に失敗した場合は再度撤回してください。")}</p> : null}
      {controls.failed && !controls.consented ? <button type="button" disabled={controls.busy} onClick={() => void controls.setConsent(false)}>{l("측정 철회 다시 시도", "Retry withdrawal", "計測の撤回を再試行")}</button> : null}
      {controls.consented && controls.qa ? <PracticeMeasurementQaStatus /> : null}
    </div>
  </details>;
}

/** Mounted only for an opted-in QA browser; sample rendering needs no tRPC context. */
function PracticeMeasurementQaStatus() {
  const [language] = useProductLanguage();
  const qaStatus = trpc.practiceMeasurement.qaStatus.useQuery(undefined, { retry: false, refetchOnWindowFocus: false });
  const l = (ko: string, en: string, ja: string) => tr(language, ko, en, ja);
  return <div className="sg-measurement-qa">
        <button type="button" disabled={qaStatus.isFetching} onClick={() => void qaStatus.refetch()}>{l("이 브라우저의 테스트 기록 확인", "Check this browser's test events", "このブラウザーのテスト記録を確認")}</button>
        <p role="status">{qaStatus.data ? l(`오늘 이 QA 브라우저 · 방문 ${qaStatus.data.visited ? "확인" : "없음"} / 시작 ${qaStatus.data.started ? "확인" : "없음"} / 제출·복기 ${qaStatus.data.completed ? "확인" : "없음"}`,
          `Today, this QA browser · visit ${qaStatus.data.visited ? "verified" : "not recorded"} / start ${qaStatus.data.started ? "verified" : "not recorded"} / submitted review ${qaStatus.data.completed ? "verified" : "not recorded"}`,
          `本日のこのQAブラウザー · 訪問 ${qaStatus.data.visited ? "確認" : "なし"} / 開始 ${qaStatus.data.started ? "確認" : "なし"} / 提出・振り返り ${qaStatus.data.completed ? "確認" : "なし"}`)
          : l("아직 기록을 확인하지 못했습니다. 로그인한 테스트 계정에서 확인해 주세요. 전체 참여 지표는 운영자만 볼 수 있습니다.", "Events are not confirmed yet. Check from a signed-in test account. Only admins can see overall participant metrics.", "記録をまだ確認できませんでした。ログイン済みのテストアカウントで確認してください。全体の参加指標は管理者のみ確認できます。")}</p>
    </div>;
}
