import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { ArrowDown, ArrowRight, ArrowUpRight, Activity, Check, ScanLine } from "lucide-react";
import "./welcome.css";

const sensors = [
  { name: "전류", unit: "A", value: "6.50", range: "4.5–5.5", difference: "상한보다 1.00 A 높음", points: "0,83 20,81 40,85 60,80 80,84 100,78 120,80 140,74 160,70 180,63 200,47 220,51 240,33 260,39 280,18 300,22", status: "정상 범위 이탈" },
  { name: "온도", unit: "°C", value: "50.0", range: "42–48", difference: "상한보다 2.0 °C 높음", points: "0,84 20,85 40,80 60,83 80,78 100,73 120,72 140,68 160,59 180,53 200,50 220,45 240,40 260,33 280,28 300,22", status: "정상 범위 이탈" },
  { name: "진동", unit: "mm/s", value: "1.10", range: "1.7–2.3", difference: "하한보다 0.60 mm/s 낮음", points: "0,30 20,35 40,29 60,34 80,31 100,38 120,36 140,48 160,43 180,60 200,56 220,72 240,68 260,83 280,79 300,92", status: "정상 범위 이탈" },
  { name: "소음", unit: "dB", value: "57.8", range: "51–59", difference: "정상 범위 안에서 관찰됨", points: "0,55 20,61 40,49 60,54 80,64 100,57 120,50 140,54 160,45 180,50 200,47 220,51 240,41 260,46 280,42 300,46", status: "정상 범위" },
];

const steps = [
  { title: "변화를 발견하고", subtitle: "SIGNAL", body: "점수만으로 판단하지 않습니다. 현재값과 정상 범위를 나란히 보고, 무엇이 달라졌는지 확인합니다.", detail: "전류 6.50 A · 기준 상한 5.50 A", note: "정상 상한 대비 +1.00 A" },
  { title: "근거를 따라가고", subtitle: "EVIDENCE", body: "변화가 시작된 시점과 센서별 기여도를 살핍니다. 관찰한 사실과 아직 확인하지 않은 원인 후보를 구분합니다.", detail: "관찰된 사실: 전류 상승 · 진동 하락", note: "원인 후보는 추가 확인이 필요합니다" },
  { title: "다음 확인을 정합니다", subtitle: "NEXT CHECK", body: "센서 상태, 최근 운전 조건, 점검 기록을 순서대로 확인합니다. 조치 후에는 정상 범위로 돌아왔는지 다시 살핍니다.", detail: "센서 연결 → 운전 조건 → 점검 기록", note: "현장 절차와 담당자의 판단을 우선합니다" },
];

export function WaferGraphic() {
  return (
    <svg className="sg-wafer" viewBox="0 0 560 560" aria-hidden="true">
      <defs>
        <pattern id="sg-dies" width="28" height="28" patternUnits="userSpaceOnUse">
          <rect x="3" y="3" width="22" height="22" rx="2" fill="#202a2d" stroke="#718387" strokeWidth=".6" />
          <path d="M8 8h12v12H8z M11 11h6v6h-6z" fill="none" stroke="#718387" strokeWidth=".5" />
        </pattern>
        <clipPath id="sg-wafer-clip"><circle cx="280" cy="280" r="195" /></clipPath>
      </defs>
      <circle cx="280" cy="280" r="257" fill="none" stroke="#303738" strokeDasharray="2 8" />
      <circle cx="280" cy="280" r="225" fill="none" stroke="#364041" />
      <path d="M280 6v60M280 494v60M6 280h60M494 280h60" stroke="#677174" />
      <g className="sg-wafer-disc">
        <circle cx="280" cy="288" r="201" fill="#090d0e" stroke="#495455" strokeWidth="5" />
        <circle cx="280" cy="280" r="198" fill="#303d41" stroke="#8a9a9d" strokeWidth="2" />
        <circle cx="280" cy="280" r="195" fill="url(#sg-dies)" />
        <g clipPath="url(#sg-wafer-clip)">
          <path d="M55 215L505 345" stroke="#bdd7dd" strokeWidth="95" opacity=".06" />
          <rect x="227" y="227" width="22" height="22" rx="2" fill="#e4aa55" />
          <rect x="255" y="227" width="22" height="22" rx="2" fill="#e4aa55" opacity=".4" />
          <rect x="227" y="255" width="22" height="22" rx="2" fill="#e4aa55" opacity=".3" />
          <path className="sg-scan" d="M70 100h420" stroke="#e4aa55" strokeWidth="2" opacity=".7" />
        </g>
        <path d="M269 473l11-10 11 10" fill="#0c1112" stroke="#8a9a9d" />
      </g>
      <path d="M238 238L150 155H42" fill="none" stroke="#e4aa55" strokeWidth="1.5" />
      <circle cx="238" cy="238" r="6" fill="none" stroke="#e4aa55" />
      <path d="M370 345l80 60h68" fill="none" stroke="#718387" />
    </svg>
  );
}

export default function Welcome() {
  const root = useRef<HTMLElement>(null);
  const [sensor, setSensor] = useState(0);
  const [step, setStep] = useState(0);
  const current = sensors[sensor];

  useEffect(() => {
    document.title = "SemiGuard AI — 신호에서 판단으로";
    document.documentElement.lang = "ko";
    const description = document.querySelector('meta[name="description"]');
    description?.setAttribute("content", "반도체 장비의 센서 변화와 근거를 이해하고 다음 확인 순서를 정하는 교육·점검 보조 시스템. 가상 센서 데이터로 판단 흐름을 체험하세요.");
    const elements = root.current?.querySelectorAll("[data-reveal]") ?? [];
    if (!window.IntersectionObserver || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add("sg-visible");
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });
    elements.forEach(element => { element.classList.add("sg-reveal-ready"); observer.observe(element); });
    return () => observer.disconnect();
  }, []);

  return (
    <main className="sg-site" ref={root}>
      <a className="sg-skip" href="#sg-content">본문으로 건너뛰기</a>
      <header className="sg-nav">
        <Link href="/welcome" className="sg-brand" aria-label="SemiGuard AI 홈"><span className="sg-brand-symbol">S<span>G</span></span><span>SemiGuard<span className="sg-brand-ai"> AI</span></span></Link>
        <nav aria-label="주 메뉴"><a href="#workflow">판단의 흐름</a><a href="#principles">설계 원칙</a><Link href="/login" className="sg-nav-login">로그인 <ArrowUpRight size={15} /></Link></nav>
      </header>

      <section className="sg-hero" id="sg-content">
        <div className="sg-hero-copy">
          <p className="sg-eyebrow"><span className="sg-dot" /> SEMICONDUCTOR · SENSOR INTELLIGENCE</p>
          <h1>이상 대응,<br /><span>판단하는 법을 훈련합니다.</span></h1>
          <p className="sg-intro">작은 센서 변화에서, 다음 확인까지.<br />반도체 장비의 이상 신호를 이해하는<br className="sg-mobile-break" /> 새로운 점검 경험.</p>
          <div className="sg-hero-actions"><Link className="sg-button sg-button-primary" href="/login">로그인하고 시작하기 <ArrowUpRight size={18} /></Link><a href="#workflow" className="sg-text-link">어떻게 작동하나요 <ArrowDown size={16} /></a></div>
          <p className="sg-quiet">소개 → 로그인 → 대시보드 → 연습 방식 선택 · <Link href="/training">로그인 없이 미리보기</Link></p>
        </div>
        <div className="sg-hero-visual">
          <span className="sg-visual-index">FIG. 01 / SIGNAL OBSERVATION</span>
          <WaferGraphic />
          <span className="sg-wafer-label">SENSOR CHANGE<br /><b>관찰에서 시작하는 판단</b></span>
          <div className="sg-visual-caption"><span>WAFER PROCESS</span><span>CONCEPT VISUAL / NOT A LIVE FEED</span></div>
        </div>
      </section>

      <section className="sg-sensor-console" aria-labelledby="sensor-console-title" data-reveal>
        <div className="sg-console-heading"><div><p className="sg-eyebrow">SIMULATED OBSERVATION</p><h2 id="sensor-console-title">같은 순간, 네 가지 근거.</h2></div><span className="sg-outline-label">예시 데이터 · 16개 관측값</span></div>
        <div className="sg-console-grid">
          <div className="sg-sensor-tabs" role="group" aria-label="관찰할 센서 선택">{sensors.map((item, index) => <button type="button" key={item.name} aria-pressed={sensor === index} onClick={() => setSensor(index)}><span className="sg-mono">0{index + 1}</span><span>{item.name}</span><span>{item.value} <small>{item.unit}</small></span><ArrowUpRight size={14} /></button>)}</div>
          <div className="sg-sensor-detail" aria-live="polite">
            <div className="sg-detail-top"><span><Activity size={14} /> {current.name} 추이</span><span className={sensor === 3 ? "sg-safe" : "sg-amber"}>{current.status}</span></div>
            <div className="sg-reading"><strong>{current.value}</strong><span>{current.unit}</span><p>정상 범위 <b>{current.range} {current.unit}</b></p></div>
            <svg viewBox="0 0 300 115" className="sg-sparkline" role="img" aria-label={`${current.name} 예시 추이. ${current.difference}. 센서 간 세로축 축척은 다릅니다.`}>
              <path d="M0 28H300M0 58H300M0 88H300" stroke="#303739" strokeDasharray="3 4" />
              <polyline key={sensor} className="sg-trace" points={current.points} fill="none" stroke={sensor === 3 ? "#8bbba6" : "#e4aa55"} strokeWidth="2.5" strokeLinejoin="round" />
            </svg>
            <div className="sg-chart-caption"><span>이전 관측</span><span>{current.difference}</span><span>현재</span></div>
          </div>
          <div className="sg-score-summary"><p className="sg-eyebrow">RULE-BASED SCORE</p><div className="sg-score">67<span>/100</span></div><span className="sg-outline-label sg-amber">경고 · 센서 근거 확인</span><p>정상 기준과의 편차를 합산한 점수입니다. 고장 확률을 의미하지 않습니다.</p><Link href="/demo">판단 흐름 따라가기 <ArrowRight size={16} /></Link></div>
        </div>
      </section>

      <section className="sg-workflow" id="workflow" data-reveal>
        <div className="sg-section-heading"><p className="sg-eyebrow">FROM SIGNAL TO NEXT CHECK</p><h2>하나의 신호가<br />이해 가능한 판단이 되도록.</h2><p>무슨 일이 관찰됐는지, 무엇을 더 확인해야 하는지.<br />복잡한 데이터를 세 단계의 흐름으로 연결합니다.</p></div>
        <div className="sg-workflow-layout">
          <div className="sg-step-list" role="group" aria-label="판단 단계 선택">{steps.map((item, index) => <button key={item.title} type="button" onClick={() => setStep(index)} aria-pressed={step === index}><span className="sg-step-number">0{index + 1}</span><span><small>{item.subtitle}</small><strong>{item.title}</strong>{step === index && <p>{item.body}</p>}</span><ArrowUpRight size={21} /></button>)}</div>
          <div className="sg-step-preview" aria-live="polite"><p className="sg-eyebrow">INSPECTION NOTE / 0{step + 1}</p><ScanLine size={38} strokeWidth={1} /><h3>{steps[step].detail}</h3><div className="sg-note-rule" /><p>{steps[step].note}</p><span className="sg-preview-foot">SEMI GUARD · GUIDED OBSERVATION</span></div>
        </div>
      </section>

      <section className="sg-principles" id="principles" data-reveal>
        <div><p className="sg-eyebrow">BUILT FOR UNDERSTANDING</p><h2>설명할 수 있는 근거.<br />분명하게 정한 역할.</h2></div>
        <div className="sg-principle-list">{[
          ["01", "위험 점수는 규칙으로", "정상 기준과 z-score 편차로 계산합니다. 학습된 AI 모델이 위험 점수를 산출하지 않습니다."],
          ["02", "AI는 설명을 돕도록", "센서 근거, 가능한 원인 후보, 권장 확인 순서를 정리합니다. 원인을 확정하거나 설비에 명령을 보내지 않습니다."],
          ["03", "검증 범위는 투명하게", "현재는 가상 센서 데이터를 활용한 교육·점검 보조 시스템입니다. 실제 팹 성능은 검증되지 않았습니다."],
        ].map(([number, title, body]) => <article key={number}><span className="sg-mono">{number}</span><div><h3>{title}</h3><p>{body}</p></div><Check size={17} /></article>)}</div>
      </section>

      <section className="sg-final-cta" data-reveal><p className="sg-eyebrow">YOUR NEXT CHECK STARTS HERE</p><h2>이제, 신호를<br /><span>직접 읽어보세요.</span></h2><Link href="/login" className="sg-button sg-button-primary">로그인하고 대시보드로 <ArrowUpRight size={20} /></Link><p>로그인 후 시나리오 훈련과 자유 분석 중 선택할 수 있습니다.</p></section>
      <footer className="sg-footer"><span>SemiGuard AI</span><p>반도체 장비 교육·점검 보조 시스템</p><Link href="/login">로그인 <ArrowUpRight size={14} /></Link></footer>
    </main>
  );
}
