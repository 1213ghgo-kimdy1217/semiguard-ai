import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { checkChoices, emptyAnswer, evaluateAnswer, evidenceChoices, isComplete, restoreAttempt, trainingSensors, type TrainingAnswer } from "../../../shared/trainingScenario";
import "./training.css";

const storageKey = "semiguard.training.scenario01.v1";
const hints = ["현재값만 보지 말고 정상 범위와 이전 관측값을 비교해 보세요.", "한 점의 흔들림과 여러 관측값의 지속적인 변화는 어떻게 다를까요?", "관찰된 사실과 아직 검증하지 않은 원인 후보를 나눠 작성해 보세요."];
function readAttempt() { try { return restoreAttempt(sessionStorage.getItem(storageKey)); } catch { return null; } }

function SensorChart({ sensor, selected }: { sensor: typeof trainingSensors[number]; selected: string }) {
  const y = (v: number) => 110 - (v - sensor.domain[0]) / (sensor.domain[1] - sensor.domain[0]) * 90;
  return <article className="tr-sensor"><div className="tr-sensor-heading"><h3>{sensor.name}</h3><span>현재 <strong>{sensor.values[12].toFixed(1)}</strong> {sensor.unit}</span></div>
    <p>교육용 정상 범위 {sensor.range[0]}–{sensor.range[1]} {sensor.unit}</p>
    <svg viewBox="0 0 360 142" role="img" aria-label={`${sensor.name} 시간 추이. 단위 ${sensor.unit}. 상세 수치는 아래 표에서 확인할 수 있습니다.`}>
      <rect x="34" y={y(sensor.range[1])} width="310" height={y(sensor.range[0]) - y(sensor.range[1])} fill="#e4eee9" />
      {[sensor.domain[0], sensor.domain[1]].map(v => <g key={v}><line x1="34" x2="344" y1={y(v)} y2={y(v)} stroke="#dce2e9" /><text x="29" y={y(v) + 4} textAnchor="end">{v}</text></g>)}
      <polyline points={sensor.values.map((v, i) => `${34 + i * 310 / 12},${y(v)}`).join(" ")} fill="none" stroke="#285da0" strokeWidth="2.5" />
      {selected !== "" && <line x1={34 + Number(selected) * 310 / 12} x2={34 + Number(selected) * 310 / 12} y1="15" y2="114" stroke="#ad6419" strokeDasharray="4 3" />}
      {[0, 6, 12].map(i => <text key={i} x={34 + i * 310 / 12} y="135" textAnchor="middle">{i * 2}분</text>)}
    </svg>
  </article>;
}

export default function Training() {
  const [saved] = useState(readAttempt);
  const [answer, setAnswer] = useState<TrainingAnswer>(() => saved?.answer ?? emptyAnswer());
  const [stage, setStage] = useState<"home" | "intro" | "work" | "result">("home");
  const [submitted, setSubmitted] = useState(saved?.submitted ?? false);
  const [hintCount, setHintCount] = useState(0);
  const [notice, setNotice] = useState("");
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { document.title = "SemiGuard 2.0 — 판단 훈련"; document.documentElement.lang = "ko"; }, []);
  useEffect(() => { heading.current?.focus(); }, [stage]);
  useEffect(() => { try { sessionStorage.setItem(storageKey, JSON.stringify({ version: 1, answer, submitted })); } catch { setNotice("브라우저 저장을 사용할 수 없습니다. 새로고침하면 답안이 사라질 수 있습니다."); } }, [answer, submitted]);
  const update = <K extends keyof TrainingAnswer>(key: K, value: TrainingAnswer[K]) => setAnswer(a => ({ ...a, [key]: value }));
  const results = submitted && isComplete(answer) ? evaluateAnswer(answer) : [];
  const reset = () => { setAnswer(emptyAnswer()); setSubmitted(false); setHintCount(0); setNotice(""); setStage("intro"); };
  return <div className="tr-app"><a className="tr-skip" href="#training-main">훈련 내용으로 이동</a>
    <header className="tr-header"><Link href="/training" className="tr-brand" onClick={() => setStage("home")}><span>SG</span> SemiGuard <small>TRAINING LAB</small></Link><nav aria-label="훈련 메뉴"><button onClick={() => setStage("home")}>훈련 홈</button><Link href="/dashboard">4센서 대시보드</Link><Link href="/welcome">소개</Link></nav></header>
    <main id="training-main" className="tr-main"><div className="tr-meta"><span>SEMIGUARD 2.0 / SCENARIO 01</span><span>교육용 시뮬레이션 데이터</span></div>
      <p className="tr-storage">답안은 현재 브라우저 탭에서만 임시 복구됩니다. 계정 저장·기기 간 동기화는 지원하지 않습니다.</p>
      {stage === "home" ? <><section className="tr-intro"><p className="tr-eyebrow">OBSERVE. REASON. REVIEW.</p><h1 ref={heading} tabIndex={-1}>고장을 외우는 교육에서,<br />이상을 판단하는 교육으로.</h1><p>센서에서 변화를 찾고, 근거를 선택하고, 다음 확인을 결정하세요.<br />정답보다 중요한 것은 그 판단에 도달한 과정입니다.</p></section>
        <section className="tr-home-grid"><article className="tr-scenario"><div className="tr-meta"><span>01 / 기초 관찰</span><span>{submitted ? "완료" : answer.sensor ? "진행 중" : "미완료"}</span></div><h2>운전 중 발견된 변화</h2><p>네 가지 센서의 변화를 비교하며, 관찰과 원인 추정을 구분하는 첫 훈련입니다.</p><div className="tr-tags"><span>초급</span><span>약 5분</span><span>센서 4개</span></div><ul><li>정상 상태와의 차이 찾기</li><li>변화 시작 시점 선택하기</li><li>현상과 원인 구분하기</li></ul><button className="tr-primary" onClick={() => setStage(submitted ? "result" : "intro")}>{submitted ? "내 결과 보기" : answer.sensor ? "훈련 이어가기" : "훈련 시작하기"} →</button></article><aside className="tr-note"><p className="tr-eyebrow">LEARNING PRINCIPLE</p><h2>먼저 생각하고,<br />그다음 비교합니다.</h2><p>관찰 중에는 정답이나 고장명을 먼저 알려주지 않습니다. 답안을 제출하면 판단 요소별로 권장 과정과 비교할 수 있습니다.</p><hr /><p>실제 장비 제어 없음<br />현장 성능·교육 효과 미검증<br />현재 제공 시나리오 1개</p></aside></section></> : null}
      {stage === "intro" ? <section className="tr-intro tr-panel"><p className="tr-eyebrow">SCENARIO BRIEF / 약 5분</p><h1 ref={heading} tabIndex={-1}>Scenario 01<br />운전 중 발견된 변화</h1><p>가상의 장비가 운전되던 중 센서 기록에 변화가 관찰되었습니다. 0–24분의 기록을 살펴보고 무엇이 달라졌는지 판단하세요.</p><ol><li>4개 센서의 현재값·기준·추이를 비교합니다.</li><li>변화 시점과 판단 근거를 선택합니다.</li><li>추가 확인 순서를 정하고 내 판단을 작성합니다.</li></ol><p>표시된 정상 범위는 이 훈련만을 위한 가상 기준입니다. 실제 설비에 적용하지 마세요.</p><button className="tr-primary" onClick={() => setStage("work")}>관찰 시작 →</button></section> : null}
      {stage === "work" ? <><div className="tr-title-row"><div><p className="tr-eyebrow">OBSERVATION & DECISION</p><h1 ref={heading} tabIndex={-1}>데이터를 보고, 내 판단을 만드세요.</h1></div><span>0–24분 · 2분 간격</span></div><div className="tr-work"><section aria-label="센서 관찰"><div className="tr-charts">{trainingSensors.map(s => <SensorChart key={s.id} sensor={s} selected={answer.onset} />)}</div><p className="tr-caption">옅은 녹색: 가상 정상 범위 · 점선: 내가 선택한 시점 · 센서별 세로축 단위와 범위가 다릅니다.</p><details className="tr-panel"><summary>전체 관측값 표로 보기</summary><div className="tr-table-scroll"><table><caption>교육용 관측 기록</caption><thead><tr><th>경과 시간</th>{trainingSensors.map(s => <th key={s.id}>{s.name} ({s.unit})</th>)}</tr></thead><tbody>{Array.from({ length: 13 }, (_, i) => <tr key={i}><th>{i * 2}분</th>{trainingSensors.map(s => <td key={s.id}>{s.values[i].toFixed(1)}</td>)}</tr>)}</tbody></table></div></details><aside className="tr-panel tr-coach"><p className="tr-eyebrow">COACHING NOTE</p><h2>생각이 막혔나요?</h2><p>사전 작성 코칭 · AI 생성 답변이 아닙니다.</p>{hints.slice(0, hintCount).map(h => <p key={h} className="tr-hint">{h}</p>)}<button disabled={hintCount === hints.length} onClick={() => setHintCount(c => c + 1)}>{hintCount === hints.length ? "모든 힌트를 확인했습니다" : `힌트 보기 (${hintCount}/${hints.length})`}</button></aside></section>
        <form className="tr-panel tr-decision" onSubmit={e => { e.preventDefault(); if (!isComplete(answer)) { setNotice("센서·시점·근거·확인 순서를 선택하고 판단을 20자 이상 작성해 주세요."); return; } setSubmitted(true); setNotice(""); setStage("result"); }}>
          <p className="tr-eyebrow">YOUR DECISION</p><h2>판단 기록</h2><fieldset><legend>01 가장 뚜렷하게 변화한 센서는?</legend>{trainingSensors.map(s => <label key={s.id}><input type="radio" name="sensor" value={s.id} checked={answer.sensor === s.id} onChange={() => update("sensor", s.id)} />{s.name}</label>)}</fieldset>
          <label className="tr-block">02 의미 있는 변화가 시작된 시점<select value={answer.onset} onChange={e => update("onset", e.target.value)}><option value="">시점 선택</option>{Array.from({ length: 13 }, (_, i) => <option key={i} value={i}>{i * 2}분</option>)}</select></label>
          <fieldset><legend>03 특정 고장으로 확정할 수 있나요?</legend><label><input type="radio" name="certainty" checked={answer.certainty === "certain"} onChange={() => update("certainty", "certain")} />확정할 수 있습니다</label><label><input type="radio" name="certainty" checked={answer.certainty === "uncertain"} onChange={() => update("certainty", "uncertain")} />추가 확인이 필요합니다</label></fieldset>
          <fieldset><legend>판단에 사용한 근거 (복수 선택)</legend>{evidenceChoices.map(v => <label key={v}><input type="checkbox" checked={answer.evidence.includes(v)} onChange={e => update("evidence", e.target.checked ? [...answer.evidence, v] : answer.evidence.filter(x => x !== v))} />{v}</label>)}</fieldset>
          <fieldset><legend>04 추가 확인 항목을 순서대로 선택하세요</legend><p>선택한 항목을 다시 누르면 순서에서 빠집니다.</p>{[checkChoices[2], checkChoices[0], checkChoices[1]].map(v => <button className="tr-order" type="button" key={v} aria-pressed={answer.order.includes(v)} onClick={() => update("order", answer.order.includes(v) ? answer.order.filter(x => x !== v) : [...answer.order, v])}><span>{answer.order.includes(v) ? answer.order.indexOf(v) + 1 : "+"}</span>{v}</button>)}</fieldset>
          <label className="tr-block">05 근거와 함께 내 판단을 설명하세요<textarea rows={5} minLength={20} maxLength={1200} value={answer.explanation} onChange={e => update("explanation", e.target.value)} placeholder="어떤 변화가 관찰되었나요? 아직 모르는 것은 무엇이며, 다음에 무엇을 확인할 건가요?" /><small>20–1,200자 · {answer.explanation.length}자 · 개인정보는 입력하지 마세요.</small></label><button className="tr-primary" type="submit">판단 제출하고 피드백 보기 →</button>
        </form></div></> : null}
      {stage === "result" ? <><section className="tr-intro"><p className="tr-eyebrow">TRAINING REVIEW / SCENARIO 01</p><h1 ref={heading} tabIndex={-1}>내 판단을 근거와 비교해 보세요.</h1><p>시나리오에 정의된 기준으로 비교한 연습 피드백입니다.<br />AI 채점이나 현장 자격·숙련도 평가가 아닙니다.</p></section><div className="tr-result-grid">{results.map(r => <article key={r.label} className="tr-panel"><span className={r.ok ? "tr-good" : "tr-review"}>{r.label === "다음 확인 순서" ? "권장 예시와 비교 · 정오 판정 없음" : r.ok ? "기준에 부합" : "다시 살펴보기"}</span><h2>{r.label}</h2><p className="tr-answer"><strong>내 선택</strong><br />{r.selected}</p><h3>관찰 근거 · 권장 예시</h3><p>{r.detail}</p></article>)}</div><section className="tr-panel"><h2>내가 작성한 판단</h2><p className="tr-answer">{answer.explanation}</p><h3>직접 돌아보기</h3><p>위 문장에 관찰된 수치, 다른 센서와의 비교, 불확실성, 다음 확인이 포함되어 있나요? 자유서술의 의미는 자동 채점하지 않습니다.</p><p>새로운 문제에 대한 실력 향상은 별도 검증이 필요합니다. 같은 문제 재도전 결과를 교육 효과로 해석하지 않습니다.</p><button className="tr-primary" onClick={reset}>새 답안으로 다시 도전 →</button><button onClick={() => setStage("home")}>훈련 홈</button></section></> : null}
      <p role="status" className="tr-notice">{notice}</p><footer className="tr-footer">SemiGuard Training Lab · 실제 장비에서 실수하기 전에, 안전한 가상 환경에서 판단을 연습합니다.</footer>
    </main></div>;
}
