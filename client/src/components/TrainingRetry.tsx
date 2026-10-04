import React, { useEffect, useId, useRef, useState } from "react";
import { tr, type ProductLanguage } from "../lib/productLanguage";

type Props = {
  language: ProductLanguage;
  hasWork: boolean;
  disabled?: boolean;
  onPause: () => void;
  onRestart: () => void;
};

export function TrainingRetry({ language, hasWork, disabled = false, onPause, onRestart }: Props) {
  const [confirming, setConfirming] = useState(false);
  const id = useId();
  const opener = useRef<HTMLButtonElement>(null);
  const cancelButton = useRef<HTMLButtonElement>(null);
  const l = (ko: string, en: string, ja: string) => tr(language, ko, en, ja);
  useEffect(() => { if (confirming && hasWork) cancelButton.current?.focus(); }, [confirming, hasWork]);
  const cancel = () => { setConfirming(false); opener.current?.focus(); };
  if (!hasWork) return null;
  return <section className="et-panel">
    <button type="button" ref={opener} className="et-linkbutton" disabled={disabled} aria-expanded={confirming} aria-controls={confirming ? id : undefined}
      onClick={() => { if (disabled) return; onPause(); setConfirming(true); }}>
      {l("새 시도로 다시 연습", "Practice with a new attempt", "新しい試行で再練習")}
    </button>
    {confirming ? <div id={id} role="alertdialog" aria-modal={false} aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`}
      onKeyDown={event => { if (event.key === "Escape") { event.preventDefault(); cancel(); } }}>
      <h2 id={`${id}-title`}>{l("현재 탭 답안을 비우고 다시 시작할까요?", "Clear this tab's answer and restart?", "このタブの回答を消して再開しますか？")}</h2>
      <div id={`${id}-description`}>
        <p>{l("재생을 일시 정지했습니다. 확인하면 이 탭의 재생 시점·선택 답안·서술형 답안을 비우고, 처음부터 일시 정지 상태로 시작합니다. 필요한 내용은 먼저 저장하거나 복사하세요.", "Playback is paused. Confirming clears this tab's playback position, choices and written answers, then starts from the beginning while paused. Save or copy anything you need first.", "再生を一時停止しました。確認すると、このタブの再生位置・選択回答・記述回答を消し、最初から一時停止状態で開始します。必要な内容は先に保存またはコピーしてください。")}</p>
        <p>{l("계정에 저장한 완료 기록과 중간 저장본은 그대로 유지됩니다. 새 시도는 자동 제출하거나 계정에 저장하지 않습니다.", "Completed records and checkpoints saved to your account remain unchanged. A new attempt is not automatically submitted or saved to your account.", "アカウントに保存した完了記録と中間保存は変わりません。新しい試行は自動提出せず、アカウントにも自動保存しません。")}</p>
      </div>
      <div className="et-actions">
        <button type="button" ref={cancelButton} className="et-linkbutton" onClick={cancel}>{l("취소", "Cancel", "キャンセル")}</button>
        <button type="button" className="et-linkbutton" disabled={disabled} onClick={() => {
          if (disabled || !hasWork || !confirming) return;
          onRestart(); setConfirming(false);
        }}>{l("현재 탭 답안을 비우고 시작", "Clear this tab's answer and start", "このタブの回答を消して開始")}</button>
      </div>
    </div> : null}
  </section>;
}
