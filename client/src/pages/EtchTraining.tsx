import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import EtchEquipmentReference from "../components/EtchEquipmentReference";
import { ArrowRight, ArrowLeft, Play, Pause, Flag, BookOpen, Activity } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, ReferenceLine } from "recharts";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ETCH_DURATION, ETCH_STORAGE_KEY, emptyEtchAttempt, etchEvidence, etchFeedback, etchPhase, etchSample, etchSamples, etchSignals, restoreEtchAttempt, setEtchMarker, validEtchAnswer, type EtchAnswer, type EtchSignal } from "../../../shared/etchScenario";
import "./etch-training.css";

type Stage = "home" | "brief" | "observe" | "decision" | "review";
function readAttempt() {
  try { return restoreEtchAttempt(sessionStorage.getItem(ETCH_STORAGE_KEY)) ?? emptyEtchAttempt(); }
  catch { return emptyEtchAttempt(); }
}
const clock = (t: number) => `${Math.floor(t / 60).toString().padStart(2, "0")}:${(t % 60).toString().padStart(2, "0")}`;

export function SignalChart({ signal, until, marker, review = false }: { signal: EtchSignal; until: number; marker: number | null; review?: boolean }) {
  const samples = etchSamples(signal, until);
  const definition = etchSignals.find(s => s.id === signal)!;
  return <div className="et-chart" role="img" aria-label={`${definition.name}, ${clock(until)}까지의 가상 상대지수. 실선은 현재 기록, 점선은 같은 단계의 정상 참고 기록입니다. 상세 수치는 관측값 표에서 확인할 수 있습니다.`}>
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={samples} margin={{ top: 12, right: 12, bottom: 12, left: 0 }}>
        <CartesianGrid stroke="#31465b" strokeDasharray="3 3" />
        <XAxis dataKey="time" type="number" domain={[0, ETCH_DURATION]} ticks={[0, 60, 120, 180]} tickFormatter={clock} stroke="#b5c7d8" fontSize={12} />
        <YAxis domain={[70, 130]} ticks={[70, 90, 110, 130]} stroke="#b5c7d8" fontSize={12} width={38} />
        <Tooltip labelFormatter={v => `교육용 경과 ${clock(Number(v))}`} contentStyle={{ background: "#112438", border: "1px solid #657a8c", color: "#fff" }} formatter={(v: number) => v.toFixed(1)} />
        <Line name="가상 기준 상한" dataKey="high" stroke="#668878" dot={false} isAnimationActive={false} strokeDasharray="2 4" />
        <Line name="가상 기준 하한" dataKey="low" stroke="#668878" dot={false} isAnimationActive={false} strokeDasharray="2 4" />
        <Line name="이전 정상 참고 기록" dataKey="reference" stroke="#b5c7d8" strokeDasharray="5 5" dot={false} isAnimationActive={false} />
        <Line name="이번 실행" dataKey="value" stroke="#8ed0c3" strokeWidth={2.5} dot={false} isAnimationActive={false} />
        {marker !== null && marker <= until ? <ReferenceLine x={marker} stroke="#e5bc79" strokeDasharray="4 4" /> : null}
        {review && until >= 70 ? <ReferenceLine x={70} stroke="#c4aad7" strokeDasharray="2 3" /> : null}
      </LineChart>
    </ResponsiveContainer>
  </div>;
}

export function EvidenceSnapshot({ time, observedUntil }: { time: number; observedUntil: number }) {
  const rows = etchEvidence(time, observedUntil);
  return <div className="et-evidence">
    <p><strong>{clock(rows[0].time)} · 단계 {rows[0].phase}</strong>의 센서 근거</p>
    <div className="et-table" role="region" aria-label="시점별 센서 비교표" tabIndex={0}>
      <table>
        <caption>관측값 표 · 모든 수치는 교육용 상대지수</caption>
        <thead><tr><th scope="col">센서</th><th scope="col">이번 실행</th><th scope="col">정상 참고</th><th scope="col">차이</th><th scope="col">단계 기준</th></tr></thead>
        <tbody>{rows.map(row => <tr key={row.id}>
          <th scope="row">{row.name}</th><td>{row.value.toFixed(1)}</td><td>{row.reference.toFixed(1)}</td>
          <td>{row.difference > 0 ? "+" : ""}{row.difference.toFixed(1)}</td><td>{row.low}–{row.high}</td>
        </tr>)}</tbody>
      </table>
    </div>
    <p className="et-caption">차이 = 이번 실행 − 같은 단계·같은 시점의 정상 참고값. 한 시점의 차이만으로 원인이나 고장을 확정하지 마세요.</p>
  </div>;
}

export default function EtchTraining() {
  const [attempt, setAttempt] = useState(readAttempt);
  const [stage, setStage] = useState<Stage>("home");
  const [running, setRunning] = useState(false);
  const [selected, setSelected] = useState<EtchSignal>("pressure");
  const [reviewTime, setReviewTime] = useState(ETCH_DURATION);
  const [inspectionTime, setInspectionTime] = useState(0);
  const [notice, setNotice] = useState("");
  const [storageWarning, setStorageWarning] = useState("");
  const [hint, setHint] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const { answer } = attempt;
  useEffect(() => { document.title = "SemiGuard — 식각 챔버 판단 훈련"; }, []);
  useEffect(() => { heading.current?.focus(); }, [stage]);
  useEffect(() => {
    try { sessionStorage.setItem(ETCH_STORAGE_KEY, JSON.stringify(attempt)); }
    catch { setStorageWarning("이 브라우저에서는 임시 저장을 사용할 수 없습니다. 새로고침하면 기록이 사라집니다."); }
  }, [attempt]);
  useEffect(() => {
    if (!running || attempt.submitted || attempt.elapsed >= ETCH_DURATION) return;
    const id = window.setInterval(() => setAttempt(a => ({ ...a, elapsed: Math.min(ETCH_DURATION, a.elapsed + 1) })), 1000);
    return () => window.clearInterval(id);
  }, [running, attempt.submitted, attempt.elapsed >= ETCH_DURATION]);
  useEffect(() => {
    if (!running || attempt.submitted || attempt.elapsed >= ETCH_DURATION) return;
    const pause = () => { if (document.hidden) { setRunning(false); setNotice("다른 탭으로 이동해 훈련을 일시정지했습니다. 재개 버튼으로 계속하세요."); } };
    document.addEventListener("visibilitychange", pause);
    return () => document.removeEventListener("visibilitychange", pause);
  }, [running, attempt.submitted, attempt.elapsed >= ETCH_DURATION]);
  const move = (next: Stage) => { if (next !== "observe" && next !== "decision") setRunning(false); setStage(next); setNotice(""); };
  const update = (key: keyof EtchAnswer, value: string) => setAttempt(a => a.submitted ? a : ({ ...a, answer: { ...a.answer, [key]: value } }));
  const isRunning = running && attempt.elapsed < ETCH_DURATION && !attempt.submitted;
  const shownTime = stage === "review" ? reviewTime : attempt.elapsed;
  const inspectedTime = Math.min(inspectionTime, attempt.elapsed);
  const signal = etchSignals.find(s => s.id === selected)!;
  const submit = () => {
    if (attempt.elapsed < ETCH_DURATION || !validEtchAnswer(answer)) { setNotice("전체 관찰을 마친 뒤 모든 선택 항목과 두 서술 항목을 10자 이상 작성해 주세요."); return; }
    setAttempt(a => ({ ...a, submitted: true })); move("review");
  };
  return <div className="et-app">
    <a className="et-skip" href="#etch-main">훈련 내용으로 이동</a>
    <header className="et-header"><Link className="et-brand" href="/training" onClick={() => move("home")}><b>SG</b> SemiGuard <small>TRAINING LAB</small></Link><nav aria-label="제품 메뉴"><Link href="/learn">8대 공정 학습</Link><Button variant="ghost" onClick={() => move("home")}>선택 화면</Button><Link href="/live">실시간 자유 분석</Link><Link href="/welcome">소개</Link></nav></header>
    <main className="et-main" id="etch-main">
      <div className="et-meta"><span>PLASMA ETCH / SCENARIO 01</span><span>교육용 가상 장비 · 실제 제어 없음</span></div>
      <p className="et-storage">이 훈련 기록은 현재 탭에만 임시 저장됩니다. 계정 저장·기기 간 동기화는 아직 지원하지 않습니다.</p>
      {storageWarning ? <p role="alert" className="et-alert">{storageWarning}</p> : null}
      {stage === "home" ? <><p className="et-eyebrow">STEP 02 / CHOOSE YOUR PRACTICE</p><h1 ref={heading} tabIndex={-1}>연습 방식을 선택하세요.</h1><p className="et-lead">시나리오로 관찰 → 근거 기록 → 판단 → 복기를 따라가거나, 같은 가상 신호를 자유롭게 살펴보세요. 실제 장비 데이터나 제어 기능은 없습니다.</p><div className="et-columns">
        <section className="et-panel"><BookOpen aria-hidden="true" /><p className="et-eyebrow">GUIDED TRAINING</p><h2>챔버 A — 이전 실행과 달라진 기록</h2><p>같은 공정 단계의 기록을 비교하고, 관찰한 사실과 아직 모르는 것을 구분하세요.</p><div className="et-tags"><span>가상 식각 챔버</span><span>시나리오 1개</span><span>약 5분</span></div><Button className="et-primary" onClick={() => move(attempt.submitted ? "review" : attempt.elapsed > 0 ? "observe" : "brief")}>{attempt.submitted ? "내 복기 보기" : attempt.elapsed > 0 ? "훈련 이어하기" : "시나리오 시작"}<ArrowRight /></Button></section>
        <section className="et-panel et-navy"><Activity aria-hidden="true" /><p className="et-eyebrow">LIVE ANALYSIS</p><h2>실시간 자유 분석</h2><p>같은 가상 식각 챔버에서 센서를 비교하고 여러 시점의 근거 메모를 남기세요. 시나리오를 먼저 완료하지 않아도 이용할 수 있습니다.</p><p className="et-caption">Scenario 01과 동일한 신호의 독립 실행입니다. 로그인 없이 이용하며 훈련 답안과 분리됩니다.</p><Link className="et-linkbutton" href="/live">자유 관찰 시작 <ArrowRight size={18} /></Link></section>
      </div></> : null}
      {stage === "brief" ? <><p className="et-eyebrow">YOUR ASSIGNMENT</p><h1 ref={heading} tabIndex={-1}>챔버 A —<br />이전 실행과 달라진 기록</h1><div className="et-columns"><section className="et-panel"><h2>선임에게 전달할 근거를 정리하세요.</h2><p>당신은 입사 초기 장비 엔지니어입니다. 이번 실행을 이전 정상 기록과 비교하고 있습니다. 공정 단계가 바뀌면 관측값도 달라질 수 있습니다.</p><ol><li>장비의 관측 위치와 단계별 기준 이해</li><li>지속적인 변화와 시작 구간 기록</li><li>관찰 사실과 추가 확인 계획 작성</li></ol><p className="et-caption">180초의 교육용 압축 재생입니다. 실제 공정 시간·운전 레시피를 재현하지 않습니다.</p></section><aside className="et-panel et-navy"><p className="et-eyebrow">EQUIPMENT CONTEXT</p><h2>어디에서 나온 신호인가요?</h2><div className="et-diagram" aria-label="교육용 연결 개념도"><span>공급 계통<br />유량</span><span>챔버 A<br />압력 · 온도</span><span>전력 계통<br />RF</span></div><p>공개 원리를 바탕으로 구성한 가상 장비입니다. 실제 센서 배치나 특정 제조사 제품을 뜻하지 않습니다.</p><p className="et-caption">수치는 모두 상대지수입니다. 단계 A의 가상 기준 중심은 80, 단계 B는 100이며 서로 다른 물리 단위의 절댓값이 아닙니다.</p></aside></div><details className="et-panel et-preparation"><summary>훈련 전 빠른 준비 · 익숙하다면 건너뛰세요</summary><p>이 안내는 현재 가상 시나리오의 읽는 법입니다. 실제 장비 운전 교육이나 물리 기준값이 아닙니다.</p><ul><li>단계가 바뀌면 정상 기준도 달라집니다. 같은 단계의 기록끼리 비교하세요.</li><li>압력·유량·RF·온도는 서로 다른 관측 항목입니다. 여기서는 교육용 상대지수로 표현하며 물리 단위가 같다는 뜻은 아닙니다.</li><li>한 점의 차이보다 지속되는 흐름과 같은 시점의 다른 센서를 함께 확인하세요.</li><li>그래프에 표시한 시점과 답안의 변화 시작 시점은 별도입니다. 과거를 표시했다고 그때 발견한 것은 아닙니다.</li><li>관찰한 사실과 가능한 원인 추정을 나누고, 아직 모르는 정보도 적으세요.</li></ul><p>준비가 됐다면 아래 관찰 시작을 누르세요. 이 안내를 읽지 않아도 훈련할 수 있습니다.</p></details><div className="et-actions"><Button variant="outline" onClick={() => move("home")}><ArrowLeft />훈련 홈</Button><Button className="et-primary" onClick={() => { move("observe"); setRunning(true); }}>관찰 시작<ArrowRight /></Button></div></> : null}
      {stage === "brief" ? <EtchEquipmentReference /> : null}
      {stage === "observe" || stage === "decision" ? <><div className="et-workhead"><div><p className="et-eyebrow">OBSERVE / REASON</p><h1 ref={heading} tabIndex={-1}>챔버 A · 단계 {etchPhase(attempt.elapsed)}</h1></div><div className="et-clock"><strong>{clock(attempt.elapsed)}</strong><span>{attempt.elapsed === ETCH_DURATION ? "관찰 완료" : isRunning ? "1초마다 갱신 중" : "일시정지"}</span></div></div><div className="et-actions"><Button variant="outline" disabled={attempt.elapsed === ETCH_DURATION} onClick={() => setRunning(v => !v)}>{isRunning ? <Pause /> : <Play />}{isRunning ? "일시정지" : "재개"}</Button><Button className="et-primary" onClick={() => move(stage === "observe" ? "decision" : "observe")}>{stage === "observe" ? "판단 기록으로" : "실시간 관찰로"}<ArrowRight /></Button></div>
        {stage === "observe" ? <section className="et-monitor"><div className="et-sensors">{etchSignals.map(s => { const p = etchSample(s.id, shownTime); return <button key={s.id} className="et-sensor" aria-pressed={selected === s.id} onClick={() => setSelected(s.id)}><span>{s.name}</span><strong>{p.value.toFixed(1)} <small>상대지수</small></strong><span>현재 단계 기준 {p.low}–{p.high}</span></button>; })}</div><h2>{signal.name} · 같은 단계 비교</h2><p className="et-caption">{signal.location} · 센서 카드를 선택하면 상세 기록이 바뀝니다.</p><SignalChart signal={selected} until={shownTime} marker={attempt.marker} /><p className="et-caption">실선: 이번 실행 / 점선: 정상 참고 기록 / 녹색 점선: 가상 기준 / 주황선: 내가 표시한 시점</p><details><summary>지금까지의 관측값 표로 보기</summary><div className="et-table"><table><thead><tr><th>시간</th><th>단계</th><th>{signal.name}</th><th>가상 기준</th></tr></thead><tbody>{etchSamples(selected, shownTime).filter(p => p.time % 10 === 0 || p.time === shownTime).map(p => <tr key={p.time}><td>{clock(p.time)}</td><td>{p.phase}</td><td>{p.value.toFixed(1)}</td><td>{p.low}–{p.high}</td></tr>)}</tbody></table></div></details><div className="et-marker-picker">
<label htmlFor="etch-marker-time">표시할 시점 {clock(inspectedTime)} · 관찰한 구간 00:00–{clock(attempt.elapsed)}</label>
<input id="etch-marker-time" type="range" min={0} max={attempt.elapsed} step={1} disabled={attempt.elapsed === 0} value={inspectedTime} onChange={e => setInspectionTime(Number(e.target.value))} />
<p className="et-caption">슬라이더로 과거 시점을 고른 뒤 표시하세요. 기존 표시 1개를 새 위치로 옮기며, 답안은 바뀌지 않습니다.</p>
<p>{attempt.marker === null ? "아직 표시한 시점이 없습니다." : `내가 표시한 시점: ${clock(attempt.marker)}`}</p>
</div><div className="et-actions">
<Button className="et-primary" onClick={() => { setAttempt(a => setEtchMarker(a, a.elapsed)); setNotice(`${clock(attempt.elapsed)} · 지금 시점을 기록했습니다.`); }}><Flag />지금 발견 기록</Button>
<Button variant="outline" onClick={() => { setAttempt(a => setEtchMarker(a, inspectedTime)); setNotice(`${clock(inspectedTime)} · 선택한 시점에 표시했습니다.`); }}>선택한 시점에 표시</Button>
<Button variant="outline" disabled={attempt.marker === null} onClick={() => { setAttempt(a => setEtchMarker(a, null)); setNotice("시점 표시를 취소했습니다."); }}>표시 취소</Button><Button variant="outline" onClick={() => setHint(v => !v)}>판단 도움말</Button></div>{hint ? <p>사전 작성 코칭: 같은 공정 단계의 기록과 비교했나요? 한 점의 흔들림과 지속적인 추세를 구분해 보세요. AI 생성 답변이 아닙니다.</p> : null}</section> : <form className="et-panel et-form" onSubmit={e => { e.preventDefault(); submit(); }}>
          <details className="et-inspect" open>
            <summary>답안을 쓰면서 과거 시점 살펴보기</summary>
            <p className="et-caption">슬라이더로 이미 관찰한 구간을 비교하세요. 살펴보기만으로 답안이 바뀌지는 않습니다.</p>
            <label id="etch-inspection-label">살펴볼 시점 {clock(inspectedTime)} / 관찰한 구간 {clock(attempt.elapsed)}</label>
            <Slider aria-labelledby="etch-inspection-label" min={0} max={Math.max(1, attempt.elapsed)} step={1} disabled={attempt.elapsed === 0} value={[inspectedTime]} onValueChange={([v]) => setInspectionTime(Math.min(v, attempt.elapsed))} />
            <EvidenceSnapshot time={inspectedTime} observedUntil={attempt.elapsed} />
            <div className="et-actions">
              <Button type="button" variant="outline" onClick={() => setInspectionTime(attempt.elapsed)}>최신 관측 시점 보기</Button>
              <Button type="button" variant="outline" onClick={() => { update("onset", String(inspectedTime)); setNotice(`${clock(inspectedTime)}을 변화 시작 시점 답안에 반영했습니다. 발견 기록은 바뀌지 않습니다.`); }}>이 시점을 시작 시점 답안에 반영</Button>
            </div>
            <p className="et-caption">{attempt.marker === null ? "그래프에 표시한 시점은 없습니다." : `내 표시 시점: ${clock(attempt.marker)}`} · 표시한 시점과 답안의 변화 시작 시점은 별도로 저장됩니다.</p>
          </details>
          <fieldset><legend>가장 뚜렷한 변화를 관찰한 항목</legend><RadioGroup value={answer.signal} onValueChange={v => update("signal", v)}>{etchSignals.map(s => <label key={s.id}><RadioGroupItem value={s.id} />{s.name}</label>)}</RadioGroup></fieldset>
          <label>변화가 시작됐다고 판단한 시점 (초)<input type="number" min={0} max={attempt.elapsed} step={1} required value={answer.onset} onChange={e => update("onset", e.target.value)} /></label><p className="et-caption">발견 버튼을 누른 시간과, 과거 기록에서 선택한 변화 시작 시간은 다릅니다.</p>
          <fieldset><legend>어떤 기준과 비교했나요?</legend><RadioGroup value={answer.comparison} onValueChange={v => update("comparison", v)}><label><RadioGroupItem value="same-phase" />같은 공정 단계의 정상 기록</label><label><RadioGroupItem value="whole-run" />공정 단계와 무관하게 전체 값 비교</label></RadioGroup></fieldset>
          <fieldset><legend>현재 정보로 특정 고장을 확정할 수 있나요?</legend><RadioGroup value={answer.certainty} onValueChange={v => update("certainty", v)}><label><RadioGroupItem value="uncertain" />추가 확인이 필요합니다</label><label><RadioGroupItem value="certain" />확정할 수 있습니다</label></RadioGroup></fieldset>
          <label>관찰한 사실과 근거<textarea minLength={10} maxLength={1200} required rows={4} value={answer.facts} onChange={e => update("facts", e.target.value)} /></label><label>아직 모르는 것 · 다음에 확인할 정보와 순서<textarea minLength={10} maxLength={1200} required rows={4} value={answer.checks} onChange={e => update("checks", e.target.value)} /></label><p className="et-caption">각 10–1,200자 · 개인정보·회사 비공개 자료는 입력하지 마세요. 실제 장비 조작을 지시하는 과제가 아닙니다.</p><Button className="et-primary" type="submit" disabled={attempt.elapsed < ETCH_DURATION}>판단 제출하고 복기하기<ArrowRight /></Button>{attempt.elapsed < ETCH_DURATION ? <p>전체 관찰 완료 후 제출할 수 있습니다. 작성 중에도 재생 상태는 상단에서 확인할 수 있습니다.</p> : null}
        </form>}
      </> : null}
      {stage === "review" && attempt.submitted ? <><p className="et-eyebrow">TIMELINE REVIEW</p><h1 ref={heading} tabIndex={-1}>내 판단을 근거와 비교합니다.</h1><p>시나리오 기준에 따른 연습 피드백입니다. AI 채점이나 현장 자격 평가가 아닙니다.</p><div className="et-columns"><section className="et-monitor"><h2>압력 변화와 내가 표시한 시점</h2><SignalChart signal="pressure" until={reviewTime} marker={attempt.marker} review /><EvidenceSnapshot time={reviewTime} observedUntil={attempt.elapsed} /><label id="etch-replay-label">복기 재생 위치 {clock(reviewTime)}</label><Slider aria-labelledby="etch-replay-label" min={0} max={ETCH_DURATION} step={1} value={[reviewTime]} onValueChange={([v]) => setReviewTime(v)} /><ul><li>00:40 — 단계 B로 정상 전환</li><li>01:10 — 시나리오상 압력 추세 변화 시작</li><li>{attempt.marker === null ? "표시한 시점 없음" : `${clock(attempt.marker)} — 내가 그래프에 표시한 시점`}</li><li>{clock(Number(answer.onset))} — 내가 선택한 변화 시작 시점</li></ul></section><section className="et-panel">{etchFeedback(answer).map(r => <article className="et-feedback" key={r.title}><span className={r.ok ? "et-good" : "et-revisit"}>{r.ok ? "기준에 부합" : "다시 살펴보기"}</span><h2>{r.label}</h2><p>{r.detail}</p></article>)}</section></div><section className="et-panel et-report"><h2>내가 작성한 관찰 사실</h2><p>{answer.facts}</p><h2>추가 확인 계획</h2><p>{answer.checks}</p><p className="et-caption">서술형의 의미와 확인 순서는 자동 채점하지 않았습니다. 같은 문제의 재도전 결과를 현장 숙련도 향상으로 해석하지 않습니다.</p></section><div className="et-panel et-next"><h2>같은 장비를 자유롭게 다시 관찰하세요.</h2><p>같은 가상 신호를 별도 실행하며 근거 메모를 여러 번 남길 수 있습니다. 새로운 문제나 훈련 기록의 연속 실행은 아닙니다.</p><Link href="/live" className="et-linkbutton">실시간 자유 분석으로<ArrowRight size={18} /></Link><Button variant="outline" onClick={() => { setAttempt(emptyEtchAttempt()); setHint(false); setReviewTime(ETCH_DURATION); move("brief"); }}>새 시도로 다시 연습</Button></div></> : null}
      <p role="status" aria-live="polite" className="et-notice">{notice}</p><footer className="et-footer">공개 원리 기반 가상 식각 챔버 · 실제 팹 성능·교육 효과 미검증</footer>
    </main>
  </div>;
}
