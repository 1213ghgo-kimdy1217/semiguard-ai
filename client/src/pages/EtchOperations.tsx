import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ETCH_DURATION, etchPhase, etchSignals, type EtchSignal } from "../../../shared/etchScenario";
import { operationsStorageKey, emptyOperationsSession, firstPersistentOutside, nextOperationsTime, operationsEvidence, restoreOperationsSession, validOperationsNote, type OperationsNote } from "../../../shared/etchOperations";
import { SignalChart } from "./EtchTraining";
import "./etch-training.css";
import "./etch-operations.css";

const clock = (time: number) => `${Math.floor(time / 60).toString().padStart(2, "0")}:${(time % 60).toString().padStart(2, "0")}`;
const linkedProvider = new URLSearchParams(window.location.search).get("social_linked");

export default function EtchOperations({ userId }: { userId: number }) {
  const storageKey = operationsStorageKey(userId);
  const [session, setSession] = useState(() => {
    try { return restoreOperationsSession(sessionStorage.getItem(storageKey)) ?? emptyOperationsSession(); }
    catch { return emptyOperationsSession(); }
  });
  const [running, setRunning] = useState(false);
  const [fact, setFact] = useState("");
  const [possibility, setPossibility] = useState("");
  const [nextCheck, setNextCheck] = useState("");
  const [notice, setNotice] = useState("");
  const [storageWarning, setStorageWarning] = useState("");
  const [resetPrompt, setResetPrompt] = useState(false);
  const active = running && session.elapsed < ETCH_DURATION;
  const viewedTime = session.inspection ?? session.elapsed;
  const rows = operationsEvidence(viewedTime, session.elapsed);
  const selected = etchSignals.find(signal => signal.id === session.selected)!;
  const onset = firstPersistentOutside("pressure", session.elapsed);
  const socialLinked = ["google", "naver", "kakao"].includes(linkedProvider || "");

  useEffect(() => { document.title = "SemiGuard — 식각 챔버 관찰 작업대"; }, []);
  useEffect(() => {
    try { sessionStorage.setItem(storageKey, JSON.stringify(session)); }
    catch { setStorageWarning("이 브라우저에서는 임시 저장을 사용할 수 없습니다. 필요한 기록은 파일로 내려받으세요."); }
  }, [session, storageKey]);
  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => setSession(current => ({ ...current, elapsed: nextOperationsTime(current.elapsed) })), 3000);
    return () => window.clearInterval(timer);
  }, [active]);
  useEffect(() => {
    if (!active) return;
    const pause = () => {
      if (document.hidden) { setRunning(false); setNotice("다른 탭으로 이동해 가상 관찰을 일시정지했습니다."); }
    };
    document.addEventListener("visibilitychange", pause);
    return () => document.removeEventListener("visibilitychange", pause);
  }, [active]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (fact.trim() || possibility.trim() || nextCheck.trim()) { event.preventDefault(); event.returnValue = ""; }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [fact, possibility, nextCheck]);

  function addNote() {
    if (session.notes.length >= 30) { setNotice("한 실행에는 최대 30개까지 기록할 수 있습니다."); return; }
    const note: OperationsNote = {
      id: crypto.randomUUID(), time: viewedTime, signal: session.selected,
      fact: fact.trim(), possibility: possibility.trim(), nextCheck: nextCheck.trim(),
    };
    if (!validOperationsNote(note, session.elapsed)) { setNotice("관찰 사실을 10–600자로 작성하세요. 다른 항목은 각각 600자 이내입니다."); return; }
    setSession(current => ({ ...current, notes: [...current.notes, note] }));
    setFact(""); setPossibility(""); setNextCheck("");
    setNotice(`${clock(viewedTime)}의 관찰을 기록했습니다. 과거 시점을 선택한 경우 당시 발견했다는 뜻은 아닙니다.`);
  }

  function exportSession() {
    const payload = { kind: "semiguard-etch-operations", simulated: true, ...session };
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }));
    const link = document.createElement("a"); link.href = url; link.download = "semiguard-etch-observation.json"; link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice("가상 관찰 기록을 파일로 내려받았습니다.");
  }

  return <div className="et-app op-app">
    <a className="et-skip" href="#operations-main">관찰 작업대로 이동</a>
    <header className="et-header"><Link className="et-brand" href="/dashboard"><b>SG</b> SemiGuard <small>SIMULATION</small></Link><nav aria-label="제품 메뉴"><Link href="/dashboard">4센서 대시보드</Link><Link href="/live">자유 관찰</Link><Link href="/training">시나리오 훈련</Link><Link href="/learn">8대 공정 학습</Link></nav></header>
    <main id="operations-main" className="et-main">
      <div className="et-meta"><span>CHAMBER A / OBSERVATION WORKSPACE</span><span>가상 신호 · 실제 설비 연결 및 제어 없음</span></div>
      <div className="et-workhead"><div><p className="et-eyebrow">OPERATIONAL OBSERVATION / NOT A QUIZ</p><h1>식각 챔버 관찰 작업대</h1><p className="et-lead">한 대의 가상 장비에서 무엇이 달라졌는지 확인하고, 사실과 가능한 설명을 분리해 기록합니다.</p></div><div className="et-clock"><strong>{clock(session.elapsed)}</strong><span>{session.elapsed === ETCH_DURATION ? "가상 실행 완료" : active ? "3초마다 관측 중" : session.elapsed === 0 ? "시작 전" : "일시정지"}</span></div></div>
      <p className="et-storage">이 화면은 실제 장비 스트림이 아니라 180초로 압축한 교육용 가상 실행입니다. 값은 물리 단위가 아닌 상대지수이며 실제 공정 시간·레시피·성능을 뜻하지 않습니다. 관찰 기록은 이 브라우저 탭에 임시 저장되고 계정·기기 간 동기화되지 않습니다.</p>
      {socialLinked ? <p role="status" className="op-message">소셜 계정 연결이 완료되었습니다. <Link href="/dashboard">4센서 대시보드에서 확인</Link>할 수 있습니다.</p> : null}
      {storageWarning ? <p role="alert" className="et-alert">{storageWarning}</p> : null}
      <div className="et-actions"><Button className="et-primary" disabled={session.elapsed === ETCH_DURATION} onClick={() => setRunning(value => !value)}>{active ? "관찰 일시정지" : session.elapsed === 0 ? "가상 관찰 시작" : "관찰 재개"}</Button><Button variant="outline" onClick={() => { setRunning(false); setResetPrompt(true); }}>새 실행 준비</Button><Button variant="outline" onClick={exportSession} disabled={!session.elapsed && !session.notes.length}>기록 파일 내려받기</Button></div>
      {resetPrompt ? <section className="et-panel op-message" aria-label="새 실행 확인"><p>현재 가상 실행과 임시 메모 {session.notes.length}개를 지우고 처음부터 다시 시작할까요? 기존 계정 기록은 지워지지 않습니다.</p><div className="et-actions"><Button onClick={() => { setSession(emptyOperationsSession()); setRunning(false); setResetPrompt(false); setNotice("새 가상 실행을 준비했습니다."); }}>임시 실행 지우기</Button><Button variant="outline" onClick={() => setResetPrompt(false)}>취소</Button></div></section> : null}
      <section className="op-context" aria-label="장비 상태"><div><span className="op-label">관찰 대상</span><strong>Plasma Etch · Chamber A</strong><small>공개 원리 기반 가상 구성 · 특정 제조사 장비 아님</small></div><div><span className="op-label">표시 중인 단계</span><strong>단계 {etchPhase(viewedTime)}</strong><small>같은 단계의 정상 참고 기록과 비교</small></div><div><span className="op-label">현재 강조</span><strong>{onset === null ? "지속 편차 미확인" : "압력 추세 확인 필요"}</strong><small>{onset === null ? "관측한 구간 기준" : `${clock(onset)}부터 3회 연속 기준 밖 · 규칙 기반 표시`}</small></div></section>
      <div className="op-grid"><section className="et-monitor op-monitor" aria-label="가상 센서 관찰"><div className="op-section-head"><div><p className="et-eyebrow">01 / SIGNALS</p><h2>현재값과 같은 단계의 기준</h2></div><span className="op-label">{session.inspection === null ? "최신 관측" : `과거 ${clock(viewedTime)} 검토 중`}</span></div><div className="et-sensors">{rows.map(row => <button key={row.id} className="et-sensor" aria-pressed={session.selected === row.id} onClick={() => setSession(current => ({ ...current, selected: row.id }))}><span>{row.name}</span><strong>{row.value.toFixed(1)} <small>상대지수</small></strong><span>기준 {row.low}–{row.high} · 차이 {row.difference > 0 ? "+" : ""}{row.difference.toFixed(1)}</span><em className={row.outside ? "op-outside" : "op-within"}>{row.outside ? "기준 밖" : "기준 안"}</em></button>)}</div><h2>{selected.name}의 변화 추세</h2><p className="et-caption">{selected.location} · 현재 실행과 같은 단계·같은 시점의 정상 참고 기록을 비교합니다.</p><SignalChart signal={session.selected} until={session.elapsed} marker={session.inspection} sampleStep={3} /><p className="et-caption">실선: 이번 가상 실행 · 점선: 정상 참고 · 주황선: 선택한 과거 시점. 단일 값만으로 원인을 확정하지 않습니다.</p><div className="et-marker-picker"><label htmlFor="operations-inspection">살펴볼 시점 {clock(viewedTime)} / 관측한 구간 {clock(session.elapsed)}</label><input id="operations-inspection" type="range" min={0} max={session.elapsed} step={3} value={viewedTime} disabled={!session.elapsed} onChange={event => setSession(current => ({ ...current, inspection: Number(event.target.value) }))} /><Button variant="outline" onClick={() => setSession(current => ({ ...current, inspection: null }))}>최신 시점 따라가기</Button></div></section>
      <aside className="et-panel op-evidence"><p className="et-eyebrow">02 / EVIDENCE</p><h2>관찰된 사실</h2><p>{onset === null ? "현재까지 규칙에 해당하는 지속 편차는 없습니다. 신호 추세를 계속 관찰하세요." : `관측한 구간에서 압력이 ${clock(onset)}부터 세 번 연속으로 같은 단계의 가상 기준을 벗어났습니다.`}</p><p className="et-caption">이 표시는 학습된 AI 판단이 아닌 단순 비교 규칙입니다. 변화의 원인이나 장비 이상을 확정하지 않습니다.</p><div className="et-table" role="region" aria-label="센서 근거표" tabIndex={0}><table><caption>{clock(viewedTime)}의 가상 센서 근거 · 상대지수</caption><thead><tr><th scope="col">센서</th><th scope="col">현재</th><th scope="col">정상 참고</th><th scope="col">차이</th></tr></thead><tbody>{rows.map(row => <tr key={row.id}><th scope="row">{row.name}</th><td>{row.value.toFixed(1)}</td><td>{row.reference.toFixed(1)}</td><td>{row.difference > 0 ? "+" : ""}{row.difference.toFixed(1)}</td></tr>)}</tbody></table></div><h2>다음 확인 순서</h2><ol><li>같은 공정 단계의 기준과 추세를 다시 비교</li><li>다른 신호와 측정 기록의 일치 여부 확인</li><li>관찰 사실·미확정 사항을 기록하고 담당자와 검토</li></ol><p className="et-caption">설비 조작이나 현장 점검 절차를 지시하지 않습니다.</p></aside></div>
      <div className="et-columns op-notes"><form className="et-panel et-form" onSubmit={event => { event.preventDefault(); addNote(); }}><p className="et-eyebrow">03 / OBSERVATION LOG</p><h2>판단 근거 기록</h2><p className="et-caption">{clock(viewedTime)} · {selected.name} · {session.inspection === null ? "최신 관측" : "과거 기록 검토"}</p><label htmlFor="operations-fact">관찰한 사실<textarea id="operations-fact" required minLength={10} maxLength={600} rows={3} value={fact} onChange={event => setFact(event.target.value)} placeholder="예: 같은 단계의 정상 참고 기록과 비교한 차이" /></label><label htmlFor="operations-possibility">가능한 설명 후보 · 미확정<textarea id="operations-possibility" maxLength={600} rows={2} value={possibility} onChange={event => setPossibility(event.target.value)} placeholder="확정하지 않은 가설만 기록" /></label><label htmlFor="operations-next">다음에 확인할 정보<textarea id="operations-next" maxLength={600} rows={2} value={nextCheck} onChange={event => setNextCheck(event.target.value)} placeholder="비교할 다른 기록이나 담당자 검토 항목" /></label><p className="et-caption">회사 비공개 정보나 개인정보는 입력하지 마세요. 과거 시점의 메모는 그때 발견했다는 뜻이 아닙니다.</p><Button className="et-primary" type="submit" disabled={session.notes.length >= 30}>관찰 기록 남기기 ({session.notes.length}/30)</Button></form><section className="et-panel et-report"><p className="et-eyebrow">SESSION HISTORY</p><h2>이번 실행의 기록</h2>{session.notes.length === 0 ? <p>시점과 신호를 고른 뒤 관찰 사실을 남기면 여기에 쌓입니다.</p> : <ol className="op-history">{session.notes.map(note => <li key={note.id}><h3>{clock(note.time)} · {etchSignals.find(signal => signal.id === note.signal)?.name}</h3><p><b>사실</b> {note.fact}</p><p><b>가능한 설명</b> {note.possibility || "미기재 · 원인 미확정"}</p><p><b>다음 확인</b> {note.nextCheck || "미기재"}</p><div className="et-actions"><Button variant="outline" onClick={() => setSession(current => ({ ...current, selected: note.signal, inspection: note.time }))}>이 시점 비교</Button><Button variant="ghost" aria-label={`${clock(note.time)} 기록 취소`} onClick={() => setSession(current => ({ ...current, notes: current.notes.filter(item => item.id !== note.id) }))}>기록 취소</Button></div></li>)}</ol>}</section></div>
      <p role="status" aria-live="polite" className="et-notice">{notice}</p><footer className="et-footer">이 화면은 기존 대시보드를 대체하지 않는 별도 식각 가상 실행입니다. 훈련 채점 없음 · 실제 팹 성능 미검증. 기존 차트·기록·계정 설정은 <Link href="/dashboard">4센서 대시보드</Link>에서 이용할 수 있습니다.</footer>
    </main>
  </div>;
}
