import React, { useEffect, useId, useState } from "react";
import { useLocation } from "wouter";
import { GA_CONSENT_KEY } from "../lib/googleAnalytics";
import { hasLegacyMeasurementChoice, hasRecentMeasurementChoice, MEASUREMENT_CHOICE_KEY } from "../lib/measurementChoice";
import { tr, useProductLanguage, type ProductLanguage } from "../lib/productLanguage";
import { useGoogleAnalyticsControls } from "./GoogleAnalytics";
import { usePracticeMeasurementControls } from "./PracticeMeasurement";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "./ui/dialog";
import "./measurement-preferences.css";

function readChoice() {
  try {
    return hasRecentMeasurementChoice(localStorage.getItem(MEASUREMENT_CHOICE_KEY))
      || hasLegacyMeasurementChoice(localStorage.getItem("semiguard:measurement-consent:v1"), localStorage.getItem(GA_CONSENT_KEY));
  } catch { return false; }
}

export default function MeasurementPreferences() {
  const practice = usePracticeMeasurementControls(), google = useGoogleAnalyticsControls();
  const [language] = useProductLanguage();
  const [path] = useLocation();
  const [decided, setDecided] = useState(readChoice);
  const [dismissed, setDismissed] = useState(false), [requested, setRequested] = useState(false);
  const [saving, setSaving] = useState(false), [failed, setFailed] = useState(false);
  const l = (ko: string, en: string, ja: string) => tr(language, ko, en, ja);
  useEffect(() => {
    const sync = () => setDecided(readChoice());
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);
  if (!practice || !google) return null;
  const entry = ["/", "/welcome", "/login", "/signup", "/preview", "/training", "/training/etch"].includes(path)
    || /^\/training\/process\/(wafer|oxidation|photo|deposition|metal|eds|packaging)$/.test(path);
  const open = requested || (entry && !practice.busy && !decided && !dismissed && !practice.consented && !google.enabled);
  const close = () => { if (!saving) { setRequested(false); setDismissed(true); setFailed(false); } };
  const save = async (own: boolean, ga: boolean, qa: boolean) => {
    if (saving) return;
    setRequested(true); setSaving(true); setFailed(false);
    const gaSaved = google.setConsent(ga, qa);
    const ownSaved = await practice.setConsent(own, qa);
    setSaving(false);
    if (!gaSaved || !ownSaved) { setFailed(true); return; }
    try { localStorage.setItem(MEASUREMENT_CHOICE_KEY, JSON.stringify({ expires: Date.now() + 30 * 86400000 })); }
    catch { /* The choice still applies for this session; do not gate the service. */ }
    setDecided(true); setRequested(false); setDismissed(true);
  };
  return <>
    <section className="sg-measurement-entry" aria-label={l("이용 통계 설정", "Usage statistics settings", "利用統計の設定")}>
      <p>{l("이용 통계 수집은 선택입니다. 동의한 경우에만 방문·연습 이벤트를 자체 측정 또는 Google Analytics로 전송하며, 언제든 설정을 바꿀 수 있습니다.",
        "Usage statistics are optional. Only with consent are visit and practice events sent to our measurement service or Google Analytics. You can change your choices at any time.",
        "利用統計は任意です。同意した場合のみ訪問・練習イベントを独自計測またはGoogle Analyticsへ送信します。設定はいつでも変更できます。")}</p>
      <button type="button" onClick={() => { setRequested(true); setFailed(false); }}>{l("이용 통계 설정", "Usage statistics settings", "利用統計の設定")}</button>
    </section>
    <Dialog open={open} onOpenChange={next => { if (!next) close(); }}>
      <DialogContent className="sg-measurement-dialog" showCloseButton={false} onEscapeKeyDown={e => { if (saving) e.preventDefault(); }} onInteractOutside={e => { if (saving) e.preventDefault(); }}>
        <DialogTitle>{l("더 나은 연습을 위한 이용 통계", "Help us improve practice", "より良い練習のための利用統計")}</DialogTitle>
        <DialogDescription>{l("어디서 연습을 시작하고 마치는지 확인해 서비스를 개선하려고 해요. 참여 여부는 자유이며, 동의하지 않아도 모든 이용 조건은 같습니다.",
          "We use statistics about practice starts and completions to improve the service. Participation is optional; declining does not change access.",
          "練習の開始・完了状況を確認してサービスを改善します。参加は任意で、同意しなくても利用条件は変わりません。")}</DialogDescription>
        <MeasurementChoiceForm language={language} own={practice.consented} google={google.enabled} qa={practice.qa || google.qa} saving={saving} onSave={save} />
        {failed ? <p role="alert">{l("일부 설정을 저장하지 못했습니다. 저장된 선택은 적용되었습니다. 다시 시도하거나 ‘닫기’로 이용을 계속할 수 있습니다.", "Some settings could not be saved. Successfully saved choices still apply. Retry, or close this notice and keep using the service.", "一部の設定を保存できませんでした。保存できた選択は適用されています。再試行するか、閉じて利用を続けられます。")}</p> : null}
        <details className="sg-measurement-more"><summary>{l("수집 정보·보관·철회 자세히 보기", "Details: collection, retention and withdrawal", "収集情報・保持・撤回の詳細")}</summary>
          <p>{l("자체 측정은 30일 쿠키로 브라우저를 구분하며 실제 사람 수와 같지 않습니다. 철회하면 새 수집을 중단하고 기존 이벤트는 집계용으로 남습니다. Google 측정의 동의와 쿠키도 최대 30일 유지하며, 사용자·이벤트 원본 보관은 2개월이고 새 활동으로 연장하지 않습니다. 합산 보고서는 별개입니다. 철회 전 Google에 전송된 자료는 소급 삭제되지 않습니다.",
            "Our 30-day cookie distinguishes browsers, not people. Withdrawal stops new collection; existing events remain for aggregation. Google consent/cookies last up to 30 days. User/event data is retained for two months without renewal on activity; aggregated reports are separate. Previously sent Google data is not retroactively deleted.",
            "独自の30日Cookieで人ではなくブラウザーを区別します。撤回後は新規収集を停止し、既存イベントは集計用に残ります。Googleの同意・Cookieも最長30日、ユーザー・イベントデータは2か月保持し活動で延長しません。集計報告は別です。送信済みGoogleデータは遡って削除されません。")}</p>
          <a href="https://policies.google.com/technologies/partner-sites" target="_blank" rel="noreferrer">{l("Google의 정보 처리 안내", "How Google processes information", "Googleの情報処理について")}</a>
        </details>
        <DialogClose asChild><button type="button" className="sg-measurement-dismiss" disabled={saving}>{l("닫기 (선택은 변경하지 않음)", "Close without changing choices", "閉じる（選択は変更しません）")}</button></DialogClose>
      </DialogContent>
    </Dialog>
  </>;
}

export function MeasurementChoiceForm({ language, own, google, qa: initialQa, saving, onSave }: {
  language: ProductLanguage; own: boolean; google: boolean; qa: boolean; saving: boolean;
  onSave: (own: boolean, google: boolean, qa: boolean) => Promise<void>;
}) {
  const [ownChecked, setOwn] = useState(own), [googleChecked, setGoogle] = useState(google), [qa, setQa] = useState(initialQa);
  const id = useId();
  const l = (ko: string, en: string, ja: string) => tr(language, ko, en, ja);
  return <form className="sg-measurement-choice" onSubmit={e => { e.preventDefault(); void onSave(ownChecked, googleChecked, qa); }}>
    <fieldset disabled={saving}>
      <legend className="sr-only">{l("수집 항목을 각각 선택하세요", "Choose each measurement separately", "計測をそれぞれ選択")}</legend>
      <label htmlFor={`${id}-own`}><input id={`${id}-own`} type="checkbox" checked={ownChecked} onChange={e => setOwn(e.target.checked)} /><span><strong>{l("방문·연습 통계에 참여 (선택)", "Share visit and practice statistics (optional)", "訪問・練習統計に参加（任意）")}</strong><small>{l("임의 브라우저 번호와 방문·연습 시작·제출 후 복기 시각을 자체 저장합니다.", "We store an opaque browser number and visit, start and submitted-review times.", "独自計測にランダムなブラウザー番号と訪問・開始・提出後の振り返り時刻を保存します。")}</small></span></label>
      <label htmlFor={`${id}-google`}><input id={`${id}-google`} type="checkbox" checked={googleChecked} onChange={e => setGoogle(e.target.checked)} /><span><strong>{l("Google Analytics 전송에 동의 (선택)", "Allow Google Analytics (optional)", "Google Analyticsへの送信に同意（任意）")}</strong><small>{l("미국 Google LLC에 방문·연습 이벤트, 쿠키 식별자·접속 정보를 전송합니다. 완전 익명 통계는 아닙니다.", "Visit/practice events, cookie identifiers and connection information go to Google LLC in the US, not fully anonymously.", "米国Google LLCに訪問・練習イベント、Cookie識別子・接続情報を送信します。完全匿名ではありません。")}</small></span></label>
      <p className="sg-measurement-boundary">{l("두 측정 모두 이름·이메일·답안·AI 대화·개인 기록 링크는 보내지 않으며 광고에 사용하지 않습니다.", "Neither measurement sends names, emails, answers, AI chats or personal record links, or uses advertising features.", "どちらの計測も名前・メール・回答・AI会話・個人記録リンクを送信せず、広告機能は使いません。")}</p>
      <details><summary>{l("팀원·테스트 참여자 설정", "Team and test participant setting", "チーム・テスト参加者の設定")}</summary><label htmlFor={`${id}-qa`}><input id={`${id}-qa`} type="checkbox" checked={qa} onChange={e => setQa(e.target.checked)} /><span>{l("팀원·테스트용 이용입니다 (실제 참여 지표와 구분)", "This is team/test use (separate from real participation)", "チーム・テスト用の利用です（実参加指標と区別）")}</span></label></details>
      <div className="sg-measurement-choice-actions"><button type="submit">{saving ? l("저장 중…", "Saving…", "保存中…") : l("선택 저장하고 계속", "Save choices and continue", "選択を保存して続ける")}</button><button type="button" onClick={() => void onSave(false, false, false)}>{l("동의 없이 계속", "Continue without consenting", "同意せずに続ける")}</button></div>
    </fieldset>
  </form>;
}
