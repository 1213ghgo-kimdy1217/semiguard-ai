import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { etchSignals, type EtchSignal } from "../../../shared/etchScenario";
import { freeEvidence, freePhase, freeSignalSample, freeSignalSamples } from "../../../shared/freeObservation";
import { addLiveNote, emptyLiveSession, restoreLegacyLiveSession, restoreLiveSession, type LiveNote } from "../../../shared/etchLive";
import { SignalChart, EvidenceSnapshot } from "./EtchTraining";
import SensorFileAnalysis from "./SensorFileAnalysis";
import ProductLanguageSelect from "../components/ProductLanguageSelect";
import { etchSignalLocation, etchSignalName } from "../lib/etchLanguage";
import { tr, useProductLanguage } from "../lib/productLanguage";
import "./etch-training.css";

const clock = (t: number) => `${Math.floor(t / 60).toString().padStart(2, "0")}:${(t % 60).toString().padStart(2, "0")}`;
const STORAGE_KEY = "semiguard-etch-live-v2";
const LEGACY_STORAGE_KEY = "semiguard-etch-live-v1";
function nextSeed(previous = 0) {
  const seed = crypto.getRandomValues(new Uint32Array(1))[0] || 1;
  return seed === previous ? seed + 1 : seed;
}

export default function EtchLive() {
  const [language, setLanguage] = useProductLanguage();
  const l = (ko: string, en: string, ja: string) => tr(language, ko, en, ja);
  const [initial] = useState(() => {
    try { return restoreLiveSession(sessionStorage.getItem(STORAGE_KEY)) ?? emptyLiveSession(nextSeed()); }
    catch { return emptyLiveSession(nextSeed()); }
  });
  const [seed, setSeed] = useState(initial.seed);
  const [legacy] = useState(() => {
    try { return restoreLegacyLiveSession(sessionStorage.getItem(LEGACY_STORAGE_KEY)); }
    catch { return null; }
  });
  const [elapsed, setElapsed] = useState(initial.elapsed);
  const [running, setRunning] = useState(false);
  const [mode, setMode] = useState<"synthetic" | "file">("synthetic");
  const [selected, setSelected] = useState<EtchSignal>(initial.selected);
  const [inspection, setInspection] = useState<number | null>(initial.inspection);
  const [notes, setNotes] = useState<LiveNote[]>(initial.notes);
  const [draft, setDraft] = useState("");
  const [notice, setNotice] = useState("");
  const [storageWarning, setStorageWarning] = useState("");
  const [resetPrompt, setResetPrompt] = useState(false);
  const time = inspection ?? elapsed;
  const active = running;
  const signal = etchSignals.find(s => s.id === selected)!;
  const rows = useMemo(() => freeEvidence(time, elapsed, seed), [time, elapsed, seed]);
  const samples = useMemo(() => freeSignalSamples(selected, elapsed, seed, time), [selected, elapsed, seed, time]);
  useEffect(() => { document.title = l("SemiGuard — 식각 챔버 자유 관찰", "SemiGuard — Free etch-chamber observation", "SemiGuard — エッチングチャンバー自由観察"); }, [language]);
  useEffect(() => {
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 2, seed, elapsed, selected, inspection, notes })); }
    catch { setStorageWarning(l("이 브라우저에서는 임시 저장을 사용할 수 없습니다. 화면을 떠나기 전에 기록 파일을 내려받으세요.", "Temporary storage is unavailable. Download your notes before leaving this page.", "このブラウザーでは一時保存できません。ページを離れる前に記録をダウンロードしてください。")); }
  }, [seed, elapsed, selected, inspection, notes]);
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => setElapsed(t => Math.min(Number.MAX_SAFE_INTEGER, t + 3)), 3000);
    return () => window.clearInterval(id);
  }, [active]);
  useEffect(() => {
    if (!active) return;
    const pause = () => { if (document.hidden) { setRunning(false); setNotice(l("다른 탭으로 이동해 일시정지했습니다.", "Paused when you switched tabs.", "別のタブに移動したため一時停止しました。")); } };
    document.addEventListener("visibilitychange", pause);
    return () => document.removeEventListener("visibilitychange", pause);
  }, [active]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (draft.trim()) { event.preventDefault(); event.returnValue = ""; }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [draft]);
  function exportNotes() {
    const data = { kind: "semiguard-etch-free-observation", version: 2, source: "synthetic", simulated: true, seed, elapsed, notes };
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
    const a = document.createElement("a"); a.href = url; a.download = "semiguard-observation.json"; a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice(l("관찰 기록을 파일로 내려받았습니다. 실제 발견 속도나 숙련도 점수가 아닙니다.", "Observation notes downloaded. They are not a measure of real detection speed or proficiency.", "観察記録をダウンロードしました。実際の発見速度や熟練度の点数ではありません。"));
  }
  function exportLegacyNotes() {
    if (!legacy) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify({ kind: "semiguard-etch-free-observation", source: "scenario-01-fixed", simulated: true, ...legacy }, null, 2)], { type: "application/json" }));
    const link = document.createElement("a"); link.href = url; link.download = "semiguard-previous-observation.json"; link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice(l("이전 고정 신호의 기록을 내려받았습니다. 새 가상 실행에 섞지 않았습니다.", "Previous fixed-signal notes downloaded separately from the new synthetic run.", "以前の固定信号の記録を、新しい仮想実行と分けてダウンロードしました。"));
  }
  return <div className="et-app">
    <a className="et-skip" href="#live-main">{l("자유 관찰 내용으로 이동", "Skip to free observation", "自由観察の内容へ移動")}</a>
    <header className="et-header"><a className="et-brand" href="/training"><b>SG</b> SemiGuard</a><nav aria-label={l("제품 메뉴", "Product navigation", "製品メニュー")}><a href="/learn">{l("8대 공정 학습", "Eight processes", "8大工程の学習")}</a><a href="/training">{l("시나리오 훈련", "Scenario training", "シナリオ訓練")}</a><a href="/dashboard">{l("4센서 대시보드", "Four-sensor dashboard", "4センサーダッシュボード")}</a><ProductLanguageSelect language={language} onChange={setLanguage} /></nav></header>
    <main id="live-main" className="et-main">
      <div className="et-meta"><span>FREE ANALYSIS / DATA SOURCE</span><span>{l("실제 장비 연결 및 제어 없음", "No real-equipment connection or control", "実際の装置への接続・制御なし")}</span></div>
      <div className="et-actions" role="group" aria-label={l("분석할 데이터 선택", "Select a data source", "分析するデータを選択")}><Button variant={mode === "synthetic" ? "default" : "outline"} aria-pressed={mode === "synthetic"} onClick={() => setMode("synthetic")}>{l("가변 가상 스트림", "Variable synthetic stream", "変化する仮想ストリーム")}</Button><Button variant={mode === "file" ? "default" : "outline"} aria-pressed={mode === "file"} onClick={() => { setRunning(false); setMode("file"); }}>{l("기록 CSV 분석", "Recorded CSV analysis", "記録CSVの分析")}</Button></div>
      {mode === "file" ? <SensorFileAnalysis language={language} /> : <>
      <div className="et-workhead"><div><h1>{l("식각 챔버 자유 관찰", "Free etch-chamber observation", "エッチングチャンバー自由観察")}</h1><p>{l("정답 제출 없이 신호를 비교하고, 여러 시점의 근거를 기록하세요.", "Compare signals without submitting an answer, and record evidence at multiple points.", "回答の提出なしに信号を比較し、複数の時点の根拠を記録してください。")}</p></div><div className="et-clock"><strong>{clock(elapsed)}</strong><span>{active ? l("3초마다 갱신 중", "Updating every 3 seconds", "3秒ごとに更新中") : elapsed === 0 ? l("시작 전", "Not started", "開始前") : l("일시정지", "Paused", "一時停止")}</span></div></div>
      <p className="et-caption">{l("실행 ID", "Run ID", "実行ID")} {seed.toString(16).toUpperCase()} · {l("실행마다 신호가 달라지는 교육용 가상 데이터입니다. Scenario 01의 정답 신호와 분리되어 있으며, 실제 장비 스트림이나 AI 진단이 아닙니다.", "This teaching-only synthetic data changes each run and is separate from Scenario 01 answer data. It is not a real equipment stream or AI diagnosis.", "実行ごとに信号が変わる教育用仮想データです。Scenario 01の正解信号とは分離され、実際の装置ストリームやAI診断ではありません。")}</p>
      <p className="et-storage">{l("실행과 메모는 현재 브라우저 탭에 임시 저장되어 새로고침하거나 다른 화면에 다녀와도 유지됩니다. 탭을 닫으면 사라질 수 있으니 필요한 기록은 파일로 내려받으세요. 계정 저장·기기 간 동기화는 지원하지 않으며 훈련 답안은 변경하지 않습니다.", "Runs and notes are temporarily stored in this browser tab and survive refresh or page navigation, but may disappear when the tab closes. Download important notes. Account storage and cross-device sync are unavailable; scenario answers are unchanged.", "実行とメモは現在のブラウザータブに一時保存され、更新や画面移動後も残りますが、タブを閉じると消える場合があります。必要な記録はダウンロードしてください。アカウント保存・端末間同期には対応せず、訓練回答は変わりません。")}</p>
      {legacy ? <section className="et-panel"><p>{l("이전 고정 신호 실행의 메모", "Notes from a previous fixed-signal run:", "以前の固定信号実行のメモ：")} {legacy.notes.length}{l("개가 남아 있습니다. 값이 다른 새 실행으로 옮기지 않고 별도 파일로 보존할 수 있습니다.", ". Keep them in a separate file rather than mixing them with this different run.", "件残っています。値の異なる新しい実行に混ぜず、別ファイルに保存できます。")}</p><Button variant="outline" onClick={exportLegacyNotes}>{l("이전 기록 내려받기", "Download previous notes", "以前の記録をダウンロード")}</Button></section> : null}
      {storageWarning ? <p role="alert" className="et-storage">{storageWarning}</p> : null}
      <div className="et-actions">
        <Button className="et-primary" onClick={() => setRunning(v => !v)}>{active ? l("일시정지", "Pause", "一時停止") : elapsed === 0 ? l("관찰 시작", "Start observing", "観察を始める") : l("재개", "Resume", "再開")}</Button>
        <Button variant="outline" onClick={() => { setRunning(false); setResetPrompt(true); }}>{l("처음부터 다시", "Start over", "最初からやり直す")}</Button>
        <Button variant="outline" disabled={!notes.length} onClick={exportNotes}>{l("기록 파일 내려받기", "Download notes", "記録をダウンロード")}</Button>
      </div>
      {resetPrompt ? <section className="et-panel" aria-label={l("다시 시작 확인", "Confirm restart", "再開始の確認")}><p>{l(`현재 실행과 메모 ${notes.length}개를 지우고 다른 가상 신호로 다시 시작할까요? 필요한 기록은 먼저 내려받으세요. 기존 시나리오 답안은 유지됩니다.`, `Delete this run and ${notes.length} notes to start with a different synthetic signal? Download important notes first. Scenario answers remain unchanged.`, `現在の実行とメモ${notes.length}件を削除し、別の仮想信号でやり直しますか？必要な記録は先にダウンロードしてください。シナリオの回答は残ります。`)}</p><div className="et-actions"><Button onClick={() => { setSeed(nextSeed(seed)); setElapsed(0); setSelected("pressure"); setInspection(null); setNotes([]); setDraft(""); setResetPrompt(false); setNotice(l("새로운 가상 신호를 준비했습니다.", "A new synthetic signal is ready.", "新しい仮想信号を準備しました。")); }}>{l("기록 지우고 새 실행 준비", "Delete notes and prepare a new run", "記録を削除して新しい実行を準備")}</Button><Button variant="outline" onClick={() => setResetPrompt(false)}>{l("취소", "Cancel", "キャンセル")}</Button></div></section> : null}
      <section className="et-monitor" aria-label={l("식각 센서 모니터", "Etch sensor monitor", "エッチングセンサーモニター")}>
        <div className="et-sensors">{etchSignals.map(s => { const p = freeSignalSample(s.id, time, seed); return <button className="et-sensor" key={s.id} aria-pressed={selected === s.id} onClick={() => setSelected(s.id)}><span>{etchSignalName(language, s.id)}</span><strong>{p.value.toFixed(1)} <small>{l("상대지수", "relative index", "相対指数")}</small></strong><span>{l("단계", "Phase", "段階")} {p.phase} {l("기준", "range", "基準")} {p.low}–{p.high}</span></button>; })}</div>
        <h2>{etchSignalName(language, signal.id)} · {clock(time)} · {l("단계", "phase", "段階")} {freePhase(time)}</h2><p className="et-caption">{etchSignalLocation(language, signal.id)}</p>
        <SignalChart language={language} signal={selected} until={elapsed} marker={inspection} sourceSamples={samples} />
        <p className="et-caption">{l("실선: 이번 실행 · 점선: 가상 정상 참고 · 녹색 점선: 가상 기준 · 주황선: 살펴보는 시점. 그래프는 최신 또는 선택한 시점 주변 최대 5분을 자세히 보여줍니다.", "Solid: current run · dashed: synthetic normal reference · green dashed: synthetic range · orange: selected point. The chart details up to five minutes around the latest or selected point.", "実線：今回の実行・破線：仮想正常参照・緑の破線：仮想基準・オレンジ：確認中の時点。グラフは最新または選択した時点の周囲最大5分を詳しく表示します。")}</p>
        <div className="et-marker-picker"><label htmlFor="live-inspection">{l("살펴볼 시점", "Point to inspect", "確認する時点")} {clock(time)} / {l("관찰한 구간", "Observed interval", "観察した区間")} {clock(elapsed)}</label><input id="live-inspection" type="range" min={0} max={elapsed} step={1} value={time} disabled={!elapsed} onChange={e => setInspection(Number(e.target.value))} /><label htmlFor="live-inspection-seconds">{l("경과 초로 정확히 선택", "Select exact elapsed seconds", "経過秒数で正確に選択")}</label><input id="live-inspection-seconds" type="number" min={0} max={elapsed} step={1} value={time} disabled={!elapsed} onChange={e => setInspection(Math.max(0, Math.min(elapsed, Math.floor(Number(e.target.value) || 0))))} /></div>
        <Button variant="outline" onClick={() => setInspection(null)}>{l("최신 시점 따라가기", "Follow latest point", "最新時点に戻る")}</Button>
        <EvidenceSnapshot language={language} time={time} observedUntil={elapsed} sourceRows={rows} />
      </section>
      <div className="et-columns">
        <form className="et-panel et-form" onSubmit={e => {
          e.preventDefault();
          const next = addLiveNote(notes, time, elapsed, selected, draft);
          if (next === notes) { setNotice(l("메모를 1–1,200자로 작성하세요.", "Write a note of 1–1,200 characters.", "メモを1～1,200文字で入力してください。")); return; }
          setNotes(next); setDraft(""); setNotice(`${clock(time)} · ${etchSignalName(language, signal.id)} ${l("근거를 기록했습니다.", "evidence recorded.", "の根拠を記録しました。")}`);
        }}>
          <h2>{l("관찰 근거 남기기", "Record observation evidence", "観察の根拠を記録")}</h2><p>{clock(time)} · {etchSignalName(language, signal.id)}</p>
          <label htmlFor="live-note">{l("관찰 사실 · 가능한 설명 · 다음 확인", "Observed facts · possible explanation · next check", "観察事実・考えられる説明・次の確認")}<textarea id="live-note" required maxLength={1200} rows={5} value={draft} onChange={e => setDraft(e.target.value)} /></label>
          <p className="et-caption">{l("회사 비공개 자료나 개인정보는 쓰지 마세요. 과거 시점을 기록한 것은 그때 발견했다는 뜻이 아닙니다.", "Do not enter confidential company or personal information. Recording a past point does not mean you discovered it then.", "会社の非公開資料や個人情報を入力しないでください。過去の時点を記録しても、その時点で発見した意味ではありません。")}</p>
          <Button className="et-primary" type="submit">{l("선택 시점 근거 기록", "Record evidence at selected point", "選択時点の根拠を記録")} ({notes.length})</Button>
        </form>
        <section className="et-panel et-report"><h2>{l("이번 실행 기록", "This run's notes", "今回の実行記録")}</h2>{notes.length === 0 ? <p>{l("센서와 시점을 선택한 뒤 메모를 남겨보세요.", "Choose a sensor and point, then write a note.", "センサーと時点を選び、メモを残してください。")}</p> : <ol>{notes.map(note => <li key={note.id}><h3>{clock(note.time)} · {etchSignalName(language, note.signal)}</h3><p>{note.text}</p><p className="et-caption">{l("버튼을 누른 경과 시각:", "Elapsed time when recorded:", "ボタンを押した経過時刻：")} {clock(note.recordedAt)}</p><Button variant="outline" onClick={() => { setInspection(note.time); setSelected(note.signal); setNotice(`${clock(note.time)} ${l("의 센서 근거를 모니터에 표시했습니다.", "sensor evidence shown on the monitor.", "のセンサー根拠をモニターに表示しました。")}`); }}>{l("이 시점 비교", "Compare this point", "この時点を比較")}</Button><Button variant="ghost" aria-label={`${l("기록", "Note", "記録")} ${note.id} ${l("취소", "remove", "取り消し")}`} onClick={() => { setNotes(list => list.filter(n => n.id !== note.id)); setNotice(l("선택한 메모를 취소했습니다.", "Selected note removed.", "選択したメモを取り消しました。")); }}>{l("기록 취소", "Remove note", "記録を取り消す")}</Button></li>)}</ol>}</section>
      </div>
      <p role="status" aria-live="polite">{notice}</p>
      </>}
      <footer className="et-footer">{l("가상 스트림은 교육용이며, CSV는 출처가 검증되지 않은 과거 기록입니다. 실제 장비 연결·제어 없음 · 실제 팹 성능 미검증.", "The synthetic stream is for learning; CSV files are unverified historical records. No real-equipment connection or control; no validated fab performance.", "仮想ストリームは教育用で、CSVは出典未検証の過去の記録です。実際の装置への接続・制御はなく、製造現場での性能は未検証です。")}{" "}<a href="/training">{l("시나리오 훈련으로 돌아가기", "Return to scenario training", "シナリオ訓練に戻る")}</a></footer>
    </main>
  </div>;
}
