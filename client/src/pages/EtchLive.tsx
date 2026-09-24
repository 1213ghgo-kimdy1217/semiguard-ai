import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { etchSignals, type EtchSignal } from "../../../shared/etchScenario";
import { freeEvidence, freePhase, freeSignalSample, freeSignalSamples } from "../../../shared/freeObservation";
import { addLiveNote, emptyLiveSession, restoreLegacyLiveSession, restoreLiveSession, type LiveNote } from "../../../shared/etchLive";
import { SignalChart, EvidenceSnapshot } from "./EtchTraining";
import SensorFileAnalysis from "./SensorFileAnalysis";
import "./etch-training.css";

const clock = (t: number) => `${Math.floor(t / 60).toString().padStart(2, "0")}:${(t % 60).toString().padStart(2, "0")}`;
const STORAGE_KEY = "semiguard-etch-live-v2";
const LEGACY_STORAGE_KEY = "semiguard-etch-live-v1";
function nextSeed(previous = 0) {
  const seed = crypto.getRandomValues(new Uint32Array(1))[0] || 1;
  return seed === previous ? seed + 1 : seed;
}

export default function EtchLive() {
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
  useEffect(() => { document.title = "SemiGuard — 식각 챔버 자유 관찰"; }, []);
  useEffect(() => {
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 2, seed, elapsed, selected, inspection, notes })); }
    catch { setStorageWarning("이 브라우저에서는 임시 저장을 사용할 수 없습니다. 화면을 떠나기 전에 기록 파일을 내려받으세요."); }
  }, [seed, elapsed, selected, inspection, notes]);
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => setElapsed(t => Math.min(Number.MAX_SAFE_INTEGER, t + 3)), 3000);
    return () => window.clearInterval(id);
  }, [active]);
  useEffect(() => {
    if (!active) return;
    const pause = () => { if (document.hidden) { setRunning(false); setNotice("다른 탭으로 이동해 일시정지했습니다."); } };
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
    setNotice("관찰 기록을 파일로 내려받았습니다. 실제 발견 속도나 숙련도 점수가 아닙니다.");
  }
  function exportLegacyNotes() {
    if (!legacy) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify({ kind: "semiguard-etch-free-observation", source: "scenario-01-fixed", simulated: true, ...legacy }, null, 2)], { type: "application/json" }));
    const link = document.createElement("a"); link.href = url; link.download = "semiguard-previous-observation.json"; link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice("이전 고정 신호의 기록을 내려받았습니다. 새 가상 실행에 섞지 않았습니다.");
  }
  return <div className="et-app">
    <a className="et-skip" href="#live-main">자유 관찰 내용으로 이동</a>
    <header className="et-header"><a className="et-brand" href="/training"><b>SG</b> SemiGuard</a><nav aria-label="제품 메뉴"><a href="/learn">8대 공정 학습</a><a href="/training">시나리오 훈련</a><a href="/dashboard">장비 관찰 작업대</a></nav></header>
    <main id="live-main" className="et-main">
      <div className="et-meta"><span>FREE ANALYSIS / DATA SOURCE</span><span>실제 장비 연결 및 제어 없음</span></div>
      <div className="et-actions" role="group" aria-label="분석할 데이터 선택"><Button variant={mode === "synthetic" ? "default" : "outline"} aria-pressed={mode === "synthetic"} onClick={() => setMode("synthetic")}>가변 가상 스트림</Button><Button variant={mode === "file" ? "default" : "outline"} aria-pressed={mode === "file"} onClick={() => { setRunning(false); setMode("file"); }}>기록 CSV 분석</Button></div>
      {mode === "file" ? <SensorFileAnalysis /> : <>
      <div className="et-workhead"><div><h1>식각 챔버 자유 관찰</h1><p>정답 제출 없이 신호를 비교하고, 여러 시점의 근거를 기록하세요.</p></div><div className="et-clock"><strong>{clock(elapsed)}</strong><span>{active ? "3초마다 갱신 중" : elapsed === 0 ? "시작 전" : "일시정지"}</span></div></div>
      <p className="et-caption">실행 ID {seed.toString(16).toUpperCase()} · 실행마다 신호가 달라지는 교육용 가상 데이터입니다. Scenario 01의 정답 신호와 분리되어 있으며, 실제 장비 스트림이나 AI 진단이 아닙니다.</p>
      <p className="et-storage">실행과 메모는 현재 브라우저 탭에 임시 저장되어 새로고침하거나 다른 화면에 다녀와도 유지됩니다. 탭을 닫으면 사라질 수 있으니 필요한 기록은 파일로 내려받으세요. 계정 저장·기기 간 동기화는 지원하지 않으며 훈련 답안은 변경하지 않습니다.</p>
      {legacy ? <section className="et-panel"><p>이전 고정 신호 실행의 메모 {legacy.notes.length}개가 남아 있습니다. 값이 다른 새 실행으로 옮기지 않고 별도 파일로 보존할 수 있습니다.</p><Button variant="outline" onClick={exportLegacyNotes}>이전 기록 내려받기</Button></section> : null}
      {storageWarning ? <p role="alert" className="et-storage">{storageWarning}</p> : null}
      <div className="et-actions">
        <Button className="et-primary" onClick={() => setRunning(v => !v)}>{active ? "일시정지" : elapsed === 0 ? "관찰 시작" : "재개"}</Button>
        <Button variant="outline" onClick={() => { setRunning(false); setResetPrompt(true); }}>처음부터 다시</Button>
        <Button variant="outline" disabled={!notes.length} onClick={exportNotes}>기록 파일 내려받기</Button>
      </div>
      {resetPrompt ? <section className="et-panel" aria-label="다시 시작 확인"><p>현재 실행과 메모 {notes.length}개를 지우고 다른 가상 신호로 다시 시작할까요? 필요한 기록은 먼저 내려받으세요. 기존 시나리오 답안은 유지됩니다.</p><div className="et-actions"><Button onClick={() => { setSeed(nextSeed(seed)); setElapsed(0); setSelected("pressure"); setInspection(null); setNotes([]); setDraft(""); setResetPrompt(false); setNotice("새로운 가상 신호를 준비했습니다."); }}>기록 지우고 새 실행 준비</Button><Button variant="outline" onClick={() => setResetPrompt(false)}>취소</Button></div></section> : null}
      <section className="et-monitor" aria-label="식각 센서 모니터">
        <div className="et-sensors">{etchSignals.map(s => { const p = freeSignalSample(s.id, time, seed); return <button className="et-sensor" key={s.id} aria-pressed={selected === s.id} onClick={() => setSelected(s.id)}><span>{s.name}</span><strong>{p.value.toFixed(1)} <small>상대지수</small></strong><span>단계 {p.phase} 기준 {p.low}–{p.high}</span></button>; })}</div>
        <h2>{signal.name} · {clock(time)} · 단계 {freePhase(time)}</h2><p className="et-caption">{signal.location}</p>
        <SignalChart signal={selected} until={elapsed} marker={inspection} sourceSamples={samples} />
        <p className="et-caption">실선: 이번 실행 · 점선: 가상 정상 참고 · 녹색 점선: 가상 기준 · 주황선: 살펴보는 시점. 그래프는 최신 또는 선택한 시점 주변 최대 5분을 자세히 보여줍니다.</p>
        <div className="et-marker-picker"><label htmlFor="live-inspection">살펴볼 시점 {clock(time)} / 관찰한 구간 {clock(elapsed)}</label><input id="live-inspection" type="range" min={0} max={elapsed} step={1} value={time} disabled={!elapsed} onChange={e => setInspection(Number(e.target.value))} /><label htmlFor="live-inspection-seconds">경과 초로 정확히 선택</label><input id="live-inspection-seconds" type="number" min={0} max={elapsed} step={1} value={time} disabled={!elapsed} onChange={e => setInspection(Math.max(0, Math.min(elapsed, Math.floor(Number(e.target.value) || 0))))} /></div>
        <Button variant="outline" onClick={() => setInspection(null)}>최신 시점 따라가기</Button>
        <EvidenceSnapshot time={time} observedUntil={elapsed} sourceRows={rows} />
      </section>
      <div className="et-columns">
        <form className="et-panel et-form" onSubmit={e => {
          e.preventDefault();
          const next = addLiveNote(notes, time, elapsed, selected, draft);
          if (next === notes) { setNotice("메모를 1–1,200자로 작성하세요."); return; }
          setNotes(next); setDraft(""); setNotice(`${clock(time)}의 ${signal.name} 근거를 기록했습니다.`);
        }}>
          <h2>관찰 근거 남기기</h2><p>{clock(time)} · {signal.name}</p>
          <label htmlFor="live-note">관찰 사실 · 가능한 설명 · 다음 확인<textarea id="live-note" required maxLength={1200} rows={5} value={draft} onChange={e => setDraft(e.target.value)} /></label>
          <p className="et-caption">회사 비공개 자료나 개인정보는 쓰지 마세요. 과거 시점을 기록한 것은 그때 발견했다는 뜻이 아닙니다.</p>
          <Button className="et-primary" type="submit">선택 시점 근거 기록 ({notes.length}개)</Button>
        </form>
        <section className="et-panel et-report"><h2>이번 실행 기록</h2>{notes.length === 0 ? <p>센서와 시점을 선택한 뒤 메모를 남겨보세요.</p> : <ol>{notes.map(note => <li key={note.id}><h3>{clock(note.time)} · {etchSignals.find(s => s.id === note.signal)?.name}</h3><p>{note.text}</p><p className="et-caption">버튼을 누른 경과 시각: {clock(note.recordedAt)}</p><Button variant="outline" onClick={() => { setInspection(note.time); setSelected(note.signal); setNotice(`${clock(note.time)}의 센서 근거를 모니터에 표시했습니다.`); }}>이 시점 비교</Button><Button variant="ghost" aria-label={`기록 ${note.id} 취소`} onClick={() => { setNotes(list => list.filter(n => n.id !== note.id)); setNotice("선택한 메모를 취소했습니다."); }}>기록 취소</Button></li>)}</ol>}</section>
      </div>
      <p role="status" aria-live="polite">{notice}</p>
      </>}
      <footer className="et-footer">가상 스트림은 교육용이며, CSV는 출처가 검증되지 않은 과거 기록입니다. 실제 장비 연결·제어 없음 · 실제 팹 성능 미검증. <a href="/training">시나리오 훈련으로 돌아가기</a></footer>
    </main>
  </div>;
}
