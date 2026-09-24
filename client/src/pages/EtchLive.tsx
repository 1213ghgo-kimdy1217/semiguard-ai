import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ETCH_DURATION, etchSignals, etchSample, etchPhase, type EtchSignal } from "../../../shared/etchScenario";
import { addLiveNote, type LiveNote } from "../../../shared/etchLive";
import { SignalChart, EvidenceSnapshot } from "./EtchTraining";
import "./etch-training.css";

const clock = (t: number) => `${Math.floor(t / 60).toString().padStart(2, "0")}:${(t % 60).toString().padStart(2, "0")}`;

export default function EtchLive() {
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const [selected, setSelected] = useState<EtchSignal>("pressure");
  const [inspection, setInspection] = useState<number | null>(null);
  const [notes, setNotes] = useState<LiveNote[]>([]);
  const [draft, setDraft] = useState("");
  const [notice, setNotice] = useState("");
  const [resetPrompt, setResetPrompt] = useState(false);
  const time = inspection ?? elapsed;
  const active = running && elapsed < ETCH_DURATION;
  const signal = etchSignals.find(s => s.id === selected)!;
  useEffect(() => { document.title = "SemiGuard — 식각 챔버 자유 관찰"; }, []);
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => setElapsed(t => Math.min(ETCH_DURATION, t + 1)), 1000);
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
      if (notes.length || draft.trim()) { event.preventDefault(); event.returnValue = ""; }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [notes.length, draft]);
  function exportNotes() {
    const data = { kind: "semiguard-etch-free-observation", version: 1, simulated: true, elapsed, notes };
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
    const a = document.createElement("a"); a.href = url; a.download = "semiguard-observation.json"; a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice("관찰 기록을 파일로 내려받았습니다. 실제 발견 속도나 숙련도 점수가 아닙니다.");
  }
  return <div className="et-app">
    <a className="et-skip" href="#live-main">자유 관찰 내용으로 이동</a>
    <header className="et-header"><a className="et-brand" href="/training"><b>SG</b> SemiGuard</a><nav aria-label="제품 메뉴"><a href="/learn">8대 공정 학습</a><a href="/training">시나리오 훈련</a><a href="/dashboard">기존 4센서 데모</a></nav></header>
    <main id="live-main" className="et-main">
      <div className="et-meta"><span>LIVE LAB / PLASMA ETCH</span><span>교육용 가상 장비 · 실제 제어 없음</span></div>
      <div className="et-workhead"><div><h1>식각 챔버 자유 관찰</h1><p>정답 제출 없이 신호를 비교하고, 여러 시점의 근거를 기록하세요.</p></div><div className="et-clock"><strong>{clock(elapsed)}</strong><span>{elapsed === ETCH_DURATION ? "실행 완료" : active ? "1초마다 갱신 중" : elapsed === 0 ? "시작 전" : "일시정지"}</span></div></div>
      <p className="et-caption">Scenario 01과 같은 180초 가상 신호를 별도로 재생합니다. 훈련 이어하기가 아니며 매번 같은 패턴입니다. 새로운 문제·실제 장비 스트림·AI 채점이 아닙니다.</p>
      <p className="et-storage">기록은 이 화면을 떠나거나 새로고침하면 사라집니다. 이동 전에 기록 파일을 내려받으세요. 훈련 답안은 변경하지 않습니다.</p>
      <div className="et-actions">
        <Button className="et-primary" disabled={elapsed === ETCH_DURATION} onClick={() => setRunning(v => !v)}>{active ? "일시정지" : elapsed === 0 ? "관찰 시작" : "재개"}</Button>
        <Button variant="outline" onClick={() => { setRunning(false); setResetPrompt(true); }}>처음부터 다시</Button>
        <Button variant="outline" disabled={!notes.length} onClick={exportNotes}>기록 파일 내려받기</Button>
      </div>
      {resetPrompt ? <section className="et-panel" aria-label="다시 시작 확인"><p>현재 실행과 메모 {notes.length}개를 지우고 다시 시작할까요? 기존 시나리오 답안은 유지됩니다.</p><div className="et-actions"><Button onClick={() => { setElapsed(0); setInspection(null); setNotes([]); setDraft(""); setResetPrompt(false); setNotice("새 관찰을 준비했습니다."); }}>기록 지우고 다시 준비</Button><Button variant="outline" onClick={() => setResetPrompt(false)}>취소</Button></div></section> : null}
      <section className="et-monitor" aria-label="식각 센서 모니터">
        <div className="et-sensors">{etchSignals.map(s => { const p = etchSample(s.id, time); return <button className="et-sensor" key={s.id} aria-pressed={selected === s.id} onClick={() => setSelected(s.id)}><span>{s.name}</span><strong>{p.value.toFixed(1)} <small>상대지수</small></strong><span>단계 {p.phase} 기준 {p.low}–{p.high}</span></button>; })}</div>
        <h2>{signal.name} · {clock(time)} · 단계 {etchPhase(time)}</h2><p className="et-caption">{signal.location}</p>
        <SignalChart signal={selected} until={elapsed} marker={inspection} />
        <p className="et-caption">실선: 이번 실행 · 점선: 정상 참고 · 녹색 점선: 기준 · 주황선: 살펴보는 시점. 그래프는 관찰 완료 구간까지 표시됩니다.</p>
        <div className="et-marker-picker"><label htmlFor="live-inspection">살펴볼 시점 {clock(time)} / 관찰한 구간 {clock(elapsed)}</label><input id="live-inspection" type="range" min={0} max={elapsed} step={1} value={time} disabled={!elapsed} onChange={e => setInspection(Number(e.target.value))} /></div>
        <Button variant="outline" onClick={() => setInspection(null)}>최신 시점 따라가기</Button>
        <EvidenceSnapshot time={time} observedUntil={elapsed} />
      </section>
      <div className="et-columns">
        <form className="et-panel et-form" onSubmit={e => {
          e.preventDefault();
          const next = addLiveNote(notes, time, elapsed, selected, draft);
          if (next === notes) { setNotice("메모를 1–1,200자로 작성하세요. 한 실행에 최대 30개를 기록할 수 있습니다."); return; }
          setNotes(next); setDraft(""); setNotice(`${clock(time)}의 ${signal.name} 근거를 기록했습니다.`);
        }}>
          <h2>관찰 근거 남기기</h2><p>{clock(time)} · {signal.name}</p>
          <label htmlFor="live-note">관찰 사실 · 가능한 설명 · 다음 확인<textarea id="live-note" required maxLength={1200} rows={5} value={draft} onChange={e => setDraft(e.target.value)} /></label>
          <p className="et-caption">회사 비공개 자료나 개인정보는 쓰지 마세요. 과거 시점을 기록한 것은 그때 발견했다는 뜻이 아닙니다.</p>
          <Button className="et-primary" type="submit" disabled={notes.length >= 30}>선택 시점 근거 기록 ({notes.length}/30)</Button>
        </form>
        <section className="et-panel et-report"><h2>이번 실행 기록</h2>{notes.length === 0 ? <p>센서와 시점을 선택한 뒤 메모를 남겨보세요.</p> : <ol>{notes.map(note => <li key={note.id}><h3>{clock(note.time)} · {etchSignals.find(s => s.id === note.signal)?.name}</h3><p>{note.text}</p><p className="et-caption">버튼을 누른 경과 시각: {clock(note.recordedAt)}</p><Button variant="outline" onClick={() => { setInspection(note.time); setSelected(note.signal); setNotice(`${clock(note.time)}의 센서 근거를 모니터에 표시했습니다.`); }}>이 시점 비교</Button><Button variant="ghost" aria-label={`기록 ${note.id} 취소`} onClick={() => { setNotes(list => list.filter(n => n.id !== note.id)); setNotice("선택한 메모를 취소했습니다."); }}>기록 취소</Button></li>)}</ol>}</section>
      </div>
      <p role="status" aria-live="polite">{notice}</p>
      <footer className="et-footer">현재 실행은 임시 기록입니다. 교육 효과·실제 팹 성능 미검증. <a href="/training">시나리오 훈련으로 돌아가기</a></footer>
    </main>
  </div>;
}
