import React, { useEffect, useId, useRef, useState } from "react";
import { Link } from "wouter";
import { tr, type ProductLanguage } from "../lib/productLanguage";
import { trpc } from "../lib/trpc";
import { trainingDraftSchema, type TrainingDraft } from "../../../shared/trainingDraft";
import { getProcessScenario, scenarioHref } from "../../../shared/processScenarios";
import "./training-checkpoint.css";

export function AccountPracticeBenefits({ language }: { language: ProductLanguage }) {
  const l = (ko: string, en: string, ja: string) => tr(language, ko, en, ja);
  return <section className="et-panel et-account-benefits"><p className="et-eyebrow">PERSONAL WORKSPACE / SAVE AND REVIEW</p>
    <h2>{l("기록을 남기고, 다음 연습으로 이어가세요.", "Save your reasoning. Build on it next time.", "判断を記録し、次の練習につなげましょう。")}</h2>
    <p>{l("제출한 선택형 결과와 타임라인은 아래 ‘내 학습 기록’에서 다시 볼 수 있습니다. 직접 중간 저장한 재생 시점·선택 답안부터 다른 기기에서 이어가거나, 원하는 완료 결과만 읽기 전용 링크로 공유할 수 있습니다.", "Revisit submitted choices and timelines in My practice history below. Resume an explicitly saved position and choices on another device, or share a selected completed result through a read-only link.", "提出した選択結果とタイムラインは下の「自分の練習記録」で見直せます。自分で保存した再生時点・選択回答から別の端末で再開し、選んだ完了結果だけを閲覧専用リンクで共有できます。")}</p>
    <p className="et-caption">{l("계정 중간 저장은 저장소 준비 확인 후, 버튼을 누를 때만 이뤄집니다. 서술형 원문은 계정에 저장하지 않으며, 다른 기기에서는 다시 작성해야 합니다.", "Account checkpoints require available storage and are saved only when requested. Written answers are not stored in your account; re-enter them on a different device.", "アカウントの中間保存は保存先を確認してから、ボタンを押したときだけ行います。記述回答は保存しないため、別の端末では再入力が必要です。")}</p>
  </section>;
}

export function TrainingCheckpoint({ userId, language, scenarioId, capture, restore, resumeOnly = false, disabled = false }: {
  userId: number | null; language: ProductLanguage; scenarioId: string;
  capture: () => TrainingDraft; restore: (draft: TrainingDraft) => void;
  resumeOnly?: boolean; disabled?: boolean;
}) {
  const l = (ko: string, en: string, ja: string) => tr(language, ko, en, ja);
  const readiness = trpc.training.draftStorage.useQuery(undefined, { enabled: Boolean(userId), retry: false });
  const query = trpc.training.drafts.useQuery(undefined, { enabled: Boolean(userId) && readiness.data?.ready === true, retry: false });
  const saved = query.data?.userId === userId ? query.data.drafts.find(d => d.scenarioId === scenarioId) : undefined;
  const mutation = trpc.training.saveDraft.useMutation();
  const [notice, setNotice] = useState("");
  const [replace, setReplace] = useState(false);
  const owner = useRef(userId); owner.current = userId;
  const opener = useRef<HTMLButtonElement>(null);
  const cancelButton = useRef<HTMLButtonElement>(null);
  const confirmationId = useId();
  useEffect(() => { if (replace && saved) cancelButton.current?.focus(); }, [replace, saved]);
  const closeConfirmation = () => { setReplace(false); opener.current?.focus(); };
  const busy = mutation.isPending || disabled;
  const save = async () => {
    if (resumeOnly || busy || !userId || readiness.data?.ready !== true) return;
    const currentOwner = userId;
    try {
      const snapshot = capture();
      await mutation.mutateAsync(snapshot);
      if (owner.current !== currentOwner) return;
      setNotice(l("지금까지 관찰한 범위와 선택 답안을 저장했습니다. 관찰을 이어갈 수 있습니다.", "Your observation progress and choices are saved. You can continue observing.", "観察の進み具合と選択回答を保存しました。観察を続けられます。"));
      void query.refetch();
    } catch { if (owner.current === currentOwner) setNotice(l("중간 저장에 실패했습니다. 현재 탭의 답안은 유지됩니다.", "Checkpoint saving failed. Your answers remain in this tab.", "中間保存に失敗しました。このタブの回答は保持されます。")); }
  };
  if (resumeOnly && !userId) return null;
  return <details className="et-panel et-checkpoint"><summary>{resumeOnly ? l("저장한 연습 이어하기", "Resume a saved exercise", "保存した練習を再開") : l("중간 저장 · 이어하기", "Save · resume a checkpoint", "中間保存・再開")}{saved ? <span>{l("저장본 있음", "Checkpoint available", "保存内容あり")} · {saved.elapsed}{l("초", "s", "秒")}</span> : null}</summary><div className="et-checkpoint-content">
    {resumeOnly ? <p>{l("중간 저장본을 불러와 연습을 이어갈 수 있습니다. 계정에 저장된 제출 기록은 바뀌지 않습니다. 아직 계정에 저장하지 않은 완료 답안은 이 탭에서 교체됩니다. 필요하다면 완료 기록을 먼저 저장하세요.", "Load a checkpoint to resume the exercise. Submitted records saved to your account remain unchanged. Loading replaces any completed answer you have not saved to your account. Save it first if you want to keep it.", "中間保存した内容を読み込んで練習を続けられます。アカウントに保存した提出記録は変わりません。まだアカウントに保存していない完了回答は、このタブで置き換わります。残したい場合は先に保存してください。")}</p> : null}
    <p className="et-caption">{l("관찰한 마지막 시점, 마지막으로 남긴 표시 한 개, 선택 답안을 저장합니다. 불러오면 저장한 시점에서 일시정지된 상태로 열립니다. 이 탭의 기존 답안은 교체되며 서술형은 다시 작성해야 합니다.", "The checkpoint saves how far you observed, your most recent marker, and your choices. It opens paused at that saved point. Loading replaces the answers in this tab, so you will need to re-enter written answers.", "どこまで観察したか、最後に付けた印1件、選択回答を保存します。読み込むと保存した時点で一時停止した状態になります。このタブの回答は置き換わり、記述回答は入力し直す必要があります。")}</p>
    {!userId ? <Link className="et-linkbutton" href="/login">{l("로그인하고 계정에 저장", "Sign in for account checkpoints", "ログインして保存")}</Link>
      : readiness.isLoading ? <p role="status">{l("저장소 확인 중…", "Checking storage…", "保存先を確認中…")}</p>
      : !readiness.data?.ready ? <p role="status">{l("계정 중간 저장소를 사용할 수 없습니다. 현재 탭의 임시 저장은 유지됩니다.", "Account checkpoint storage is unavailable. Temporary tab storage remains available.", "アカウントの中間保存先を利用できません。このタブの一時保存は継続します。")}</p>
      : <><div className="et-actions">{!resumeOnly ? <button className="et-linkbutton" type="button" disabled={busy} onClick={() => void save()}>{mutation.isPending ? l("저장 중…", "Saving…", "保存中…") : l("현재 지점 저장", "Save current point", "現在の時点を保存")}</button> : null}
        {saved ? <button ref={opener} className="et-linkbutton" type="button" disabled={busy} aria-expanded={replace} aria-controls={replace ? confirmationId : undefined} onClick={() => { if (!busy) setReplace(true); }}>{l("저장본 불러오기", "Load checkpoint", "保存内容を読み込む")}</button> : null}</div>
        {disabled ? <p role="status">{l("완료 기록을 저장하는 중입니다. 저장 후 이어하기를 선택하세요.", "Saving the completed record. Resume after saving finishes.", "完了記録を保存中です。保存後に再開を選んでください。")}</p> : null}
        {saved ? <p>{l("마지막 저장", "Last saved", "最終保存")} · {new Date(saved.updatedAt).toLocaleString(language)} · {saved.elapsed}{l("초", "s", "秒")}</p> : null}
        {query.isLoading ? <p role="status">{l("저장본을 확인하는 중…", "Checking checkpoints…", "保存内容を確認中…")}</p> : resumeOnly && !saved && !query.isError ? <p>{l("이 공정에 불러올 중간 저장본이 없습니다.", "There is no saved checkpoint for this process.", "この工程には読み込める中間保存がありません。")}</p> : null}
        {query.isError ? <p role="status">{l("저장본 목록을 불러오지 못했습니다.", "Could not load checkpoints.", "保存内容を読み込めませんでした。")}</p> : null}
        {replace && saved ? <div className="et-alert" id={confirmationId} role="alertdialog" aria-modal={false} aria-labelledby={`${confirmationId}-title`}
          onKeyDown={event => { if (event.key === "Escape") { event.preventDefault(); closeConfirmation(); } }}>
          <p id={`${confirmationId}-title`}>{l("현재 탭의 답안 대신 저장본을 불러올까요? 서술형 입력은 비워집니다.", "Replace this tab's answers with the checkpoint? Written fields will be cleared.", "このタブの回答を保存内容に置き換えますか？記述入力は空になります。")}</p>
          <div className="et-actions">
            <button ref={cancelButton} type="button" className="et-linkbutton" onClick={closeConfirmation}>{l("취소", "Cancel", "キャンセル")}</button>
            <button type="button" className="et-linkbutton" disabled={busy} onClick={() => { if (busy || !userId) return; const { updatedAt: _time, ...raw } = saved; restore(trainingDraftSchema.parse(raw)); closeConfirmation(); setNotice(l("저장한 시점에서 일시정지 상태로 이어갑니다. 서술형은 다시 작성하세요.", "Resumed at the saved point, paused. Re-enter written answers.", "保存した時点から停止状態で再開しました。記述回答は再入力してください。")); }}>{l("불러오기", "Load", "読み込む")}</button>
          </div>
        </div> : null}
      </>}
    <p role="status" aria-live="polite">{notice}</p>
  </div></details>;
}

export function SavedCheckpointList({ userId, language, onEtch }: { userId: number | null; language: ProductLanguage; onEtch: () => void }) {
  const l = (ko: string, en: string, ja: string) => tr(language, ko, en, ja);
  const readiness = trpc.training.draftStorage.useQuery(undefined, { enabled: Boolean(userId), retry: false });
  const query = trpc.training.drafts.useQuery(undefined, { enabled: Boolean(userId) && readiness.data?.ready === true, retry: false });
  const rows = query.data?.userId === userId ? query.data.drafts : [];
  if (!userId || readiness.data?.ready !== true) return null;
  return <section className="et-panel et-saved-checkpoints" aria-labelledby="saved-checkpoints-heading">
    <p className="et-eyebrow">SAVED CHECKPOINTS / CONTINUE LEARNING</p>
    <h2 id="saved-checkpoints-heading">{l("마지막으로 중간 저장한 연습", "Your saved checkpoints", "中間保存した練習")}</h2>
    <p className="et-caption">{l("모듈을 열고 ‘저장본 불러오기’를 선택하세요. 제출 완료 기록과 별개이며, 마지막으로 직접 저장한 상태입니다.", "Open a module and select Load checkpoint. These are your last explicit saves, separate from submitted results.", "モジュールを開き「保存内容を読み込む」を選択してください。提出済みの結果とは別の、最後に保存した状態です。")}</p>
    {query.isLoading ? <p role="status">{l("불러오는 중…", "Loading…", "読み込み中…")}</p> : query.isError ? <p role="status">{l("중간 저장 목록을 사용할 수 없습니다.", "Checkpoint list is unavailable.", "中間保存の一覧を利用できません。")}</p> : !rows?.length ? <p>{l("아직 계정에 중간 저장한 연습이 없습니다.", "No account checkpoints yet.", "中間保存した練習はまだありません。")}</p> : <ul className="et-checkpoint-list">{rows.map(row => {
      const scenario = getProcessScenario(row.scenarioId);
      if (!scenario) return null;
      const title = l(...scenario.title);
      const action = l("연습 열기", "Open exercise", "練習を開く");
      const savedAt = new Date(row.updatedAt);
      return <li className="et-checkpoint-card" key={row.scenarioId}>
        <span className="et-checkpoint-order" aria-label={l(`공정 ${scenario.order}`, `Process ${scenario.order}`, `工程 ${scenario.order}`)}>{String(scenario.order).padStart(2, "0")}</span>
        <div className="et-checkpoint-info">
          <h3>{title}</h3>
          <div className="et-checkpoint-meta">
            <span className="et-checkpoint-position">{l(`${row.elapsed}초에서 저장`, `Saved at ${row.elapsed}s`, `${row.elapsed}秒で保存`)}</span>
            <span>{l("저장 시각", "Saved", "保存日時")} <time dateTime={savedAt.toISOString()}>{savedAt.toLocaleString(language)}</time></span>
          </div>
        </div>
        {row.scenarioId === "etch-chamber-a-01"
          ? <button type="button" className="et-linkbutton et-checkpoint-open" aria-label={`${title} · ${action}`} onClick={onEtch}>{action} <span aria-hidden="true">→</span></button>
          : <Link className="et-linkbutton et-checkpoint-open" aria-label={`${title} · ${action}`} href={scenarioHref(scenario)}>{action} <span aria-hidden="true">→</span></Link>}
      </li>;
    })}</ul>}
  </section>;
}
