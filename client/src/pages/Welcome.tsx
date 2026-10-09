import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { ArrowDown, ArrowRight, ArrowUpRight, Activity, Check, ScanLine } from "lucide-react";
import ProductLanguageSelect from "../components/ProductLanguageSelect";
import AppInstall from "../components/AppInstall";
import PracticeMeasurementConsent from "../components/PracticeMeasurement";
import { useProductLanguage, tr } from "../lib/productLanguage";
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
  { title: "다음 확인을 정합니다", subtitle: "NEXT CHECK", body: "가상 기록에서 다음에 확인할 근거를 선택합니다. 판단을 제출한 뒤 AI 코칭과 타임라인에서 놓친 시점·근거를 복기합니다.", detail: "내 판단 기록 → 제출 → 코칭·복기", note: "AI는 질문과 설명을 돕습니다. 고장을 확정하지 않습니다" },
];

const welcomeCopy = {
  ko: {
    title: "SemiGuard AI — 반도체 장비 판단 훈련", description: "반도체 신입 엔지니어를 위한 장비 판단 훈련 플랫폼. 교육용 가상 기록을 관찰하고, 직접 판단한 뒤 피드백과 타임라인으로 복기합니다.", skip: "본문으로 건너뛰기", menu: "주 메뉴", workflow: "판단의 흐름", principles: "설계 원칙", login: "로그인", hero1: "반도체 장비", hero2: "판단 훈련 플랫폼", intro1: "가상 데이터를 관찰하고, 내 판단과 근거를 기록하세요.", intro2: "AI 코칭과 타임라인 복기로 판단 과정을 다시 살펴봅니다.", start: "로그인하고 시작하기", how: "어떻게 작동하나요", path: "소개 → 로그인 → 연습 방식 선택 ·", preview: "로그인 없이 미리보기", figure: "관찰에서 시작하는 판단", sensorTitle: "같은 순간, 네 가지 근거.", example: "예시 데이터 · 16개 관측값", chooseSensor: "관찰할 센서 선택", trend: "추이", range: "정상 범위", previous: "이전 관측", now: "현재", chartScale: "센서 간 세로축 축척은 다릅니다.", scoreStatus: "경고 · 센서 근거 확인", scoreDetail: "정상 기준과의 편차를 합산한 점수입니다. 고장 확률을 의미하지 않습니다.", follow: "판단 흐름 따라가기", workflowTitle1: "하나의 신호가", workflowTitle2: "이해 가능한 판단이 되도록.", workflowDetail: "무슨 일이 관찰됐는지, 무엇을 더 확인해야 하는지. 복잡한 데이터를 세 단계의 흐름으로 연결합니다.", chooseStep: "판단 단계 선택", principlesTitle1: "설명할 수 있는 근거.", principlesTitle2: "분명하게 정한 역할.", final1: "이제, 신호를", final2: "직접 읽어보세요.", selectPractice: "로그인하고 연습 선택하기", afterLogin: "로그인 후 시나리오 훈련과 자유 분석 중 선택할 수 있습니다.", footer: "반도체 신입 엔지니어를 위한 장비 판단 훈련 플랫폼",
    principlesList: [["위험 점수는 규칙으로", "정상 기준과 z-score 편차로 계산합니다. 학습된 AI 모델이 위험 점수를 산출하지 않습니다."], ["AI는 설명을 돕도록", "센서 근거, 가능한 원인 후보, 권장 확인 순서를 정리합니다. 원인을 확정하거나 설비에 명령을 보내지 않습니다."], ["검증 범위는 투명하게", "현재는 가상 센서 데이터를 활용한 교육·점검 보조 시스템입니다. 실제 팹 성능은 검증되지 않았습니다."]],
  },
  en: {
    title: "SemiGuard AI — Semiconductor judgment training", description: "An equipment-reasoning training platform for new semiconductor engineers. Observe synthetic records, form your own judgment, then review feedback and timelines.", skip: "Skip to content", menu: "Main navigation", workflow: "How judgment works", principles: "Design principles", login: "Log in", hero1: "Semiconductor equipment.", hero2: "Practise your judgment.", intro1: "Observe virtual data and record your judgment and evidence.", intro2: "Revisit your reasoning with AI coaching and timeline review.", start: "Log in to begin", how: "How it works", path: "Introduction → Login → Choose practice ·", preview: "Preview without logging in", figure: "Reasoning starts with observation", sensorTitle: "Four signals, one moment.", example: "Example data · 16 observations", chooseSensor: "Choose a sensor", trend: "trend", range: "Normal range", previous: "Earlier", now: "Now", chartScale: "Vertical scales differ between sensors.", scoreStatus: "Warning · inspect sensor evidence", scoreDetail: "This score aggregates deviations from synthetic normal baselines. It is not a failure probability.", follow: "Follow the reasoning", workflowTitle1: "Turn a signal into", workflowTitle2: "an explainable judgment.", workflowDetail: "See what was observed and what needs checking next. Follow a three-step reasoning flow.", chooseStep: "Choose a reasoning step", principlesTitle1: "Explainable evidence.", principlesTitle2: "Clearly defined roles.", final1: "Now read the", final2: "signals yourself.", selectPractice: "Log in and choose practice", afterLogin: "After login, choose guided scenario training or free analysis.", footer: "Equipment judgment training for new semiconductor engineers",
    principlesList: [["Rules calculate risk", "Normal baselines and z-score deviations drive the score. A trained AI model does not calculate risk."], ["AI helps explain", "AI organizes sensor evidence, possible causes, and suggested next checks. It does not confirm a cause or command equipment."], ["Scope is transparent", "This educational aid currently uses synthetic sensor data. Performance in a real fab has not been validated."]],
  },
  ja: {
    title: "SemiGuard AI — 半導体装置の判断訓練", description: "半導体の新人エンジニア向け装置判断訓練プラットフォーム。教育用仮想記録を観察して判断し、フィードバックとタイムラインで振り返ります。", skip: "本文へ移動", menu: "メインメニュー", workflow: "判断の流れ", principles: "設計原則", login: "ログイン", hero1: "半導体装置の", hero2: "判断訓練プラットフォーム", intro1: "仮想データを観察し、自分の判断と根拠を記録します。", intro2: "AIコーチングとタイムラインで判断の過程を振り返ります。", start: "ログインして始める", how: "仕組みを見る", path: "紹介 → ログイン → 練習方法の選択 ·", preview: "ログインせずに見る", figure: "観察から始まる判断", sensorTitle: "同じ時点、四つの根拠。", example: "サンプルデータ · 観測値16件", chooseSensor: "センサーを選択", trend: "の推移", range: "正常範囲", previous: "以前の観測", now: "現在", chartScale: "センサーごとに縦軸の尺度は異なります。", scoreStatus: "警告 · センサーの根拠を確認", scoreDetail: "仮想の正常基準からの偏差を合算した点数です。故障確率ではありません。", follow: "判断の流れを見る", workflowTitle1: "一つの信号から、", workflowTitle2: "説明できる判断へ。", workflowDetail: "観察した事実と、次に確認すべきことを三段階で整理します。", chooseStep: "判断の段階を選択", principlesTitle1: "説明できる根拠。", principlesTitle2: "明確にした役割。", final1: "今度は自分で、", final2: "信号を読んでみましょう。", selectPractice: "ログインして練習を選ぶ", afterLogin: "ログイン後、シナリオ訓練または自由分析を選べます。", footer: "半導体の新人エンジニア向け装置判断訓練プラットフォーム",
    principlesList: [["リスク点数はルールで計算", "正常基準とzスコアの偏差で計算します。学習済みAIモデルはリスク点数を算出しません。"], ["AIは説明を補助", "センサーの根拠、考えられる原因候補、推奨確認順序を整理します。原因の確定や装置への指令は行いません。"], ["検証範囲を明確に", "現在は仮想センサーデータを用いた教育・点検補助システムです。実際の製造現場での性能は検証されていません。"]],
  },
} as const;

const sensorCopy = {
  en: [
    { name: "Current", difference: "1.00 A above upper limit", status: "Outside normal range" },
    { name: "Temperature", difference: "2.0 °C above upper limit", status: "Outside normal range" },
    { name: "Vibration", difference: "0.60 mm/s below lower limit", status: "Outside normal range" },
    { name: "Noise", difference: "Within normal range", status: "Normal range" },
  ],
  ja: [
    { name: "電流", difference: "上限より1.00 A高い", status: "正常範囲外" },
    { name: "温度", difference: "上限より2.0 °C高い", status: "正常範囲外" },
    { name: "振動", difference: "下限より0.60 mm/s低い", status: "正常範囲外" },
    { name: "騒音", difference: "正常範囲内", status: "正常範囲" },
  ],
};

const orientationCopy = {
  ko: { audience: "반도체 신입 엔지니어를 위한", scope: "교육용 시뮬레이션 · 실제 장비 연결 없음", learn: "그림으로 공정 살펴보기", example: "이렇게 판단을 연습합니다", compare: "정상 참고와 비교", record: "내 판단과 근거 기록", review: "AI 질문 + 타임라인 복기", normal: "정상 참고", observed: "관찰 기록", note: "정상 참고와 달라진 구간을 발견했어요.", question: "다른 신호도 같은 시점에 달라졌나요?", timeline: "변화 시작과 내가 발견한 시점을 비교", caption: "훈련 흐름을 보여주는 가상 예시 · 실제 장비 데이터 아님", description: "가상 신호가 정상 참고와 달라지는 구간을 관찰하고, 판단 근거를 기록한 뒤 AI 질문과 타임라인으로 복기하는 훈련입니다." },
  en: { audience: "For new semiconductor engineers", scope: "Educational simulation · no real equipment connection", learn: "Explore illustrated processes", example: "What you do in a practice session", compare: "Compare with a normal reference", record: "Record your judgment and evidence", review: "AI questions + timeline review", normal: "Normal reference", observed: "Observed record", note: "I noticed a segment differing from the normal reference.", question: "Did other signals change at the same time?", timeline: "Compare the onset with when you noticed it", caption: "Illustrative training flow · not real equipment data", description: "Observe a virtual signal differing from a normal reference, record your reasoning, and review it with AI questions and a timeline." },
  ja: { audience: "半導体の新人エンジニアのための", scope: "教育用シミュレーション · 実際の装置には接続しません", learn: "図で工程を見てみる", example: "このように判断を練習します", compare: "正常参照と比較", record: "自分の判断と根拠を記録", review: "AIの問いとタイムラインで復習", normal: "正常参照", observed: "観察記録", note: "正常参照と異なる区間に気付きました。", question: "ほかの信号も同じ時点で変化しましたか？", timeline: "変化の開始と自分が気付いた時点を比較", caption: "訓練の流れを示す仮想例 · 実際の装置データではありません", description: "仮想信号を正常参照と比較し、判断の根拠を記録して、AIの問いとタイムラインで振り返る訓練です。" },
} as const;

const stepCopy = {
  en: [
    { title: "Spot the change", body: "Do not judge by the score alone. Compare current readings with the normal range to see what changed.", detail: "Current 6.50 A · upper baseline 5.50 A", note: "+1.00 A above normal upper limit" },
    { title: "Follow the evidence", body: "Check when the change began and each sensor's contribution. Separate observed facts from unverified possible causes.", detail: "Observed: current rose · vibration fell", note: "Possible causes need further checking" },
    { title: "Choose the next check", body: "Choose which virtual evidence to check next. Submit your reasoning, then revisit overlooked moments and evidence with coaching and a timeline.", detail: "Your judgment → submission → coaching and review", note: "AI provides questions and explanations, not a confirmed fault diagnosis" },
  ],
  ja: [
    { title: "変化を見つける", body: "点数だけで判断しません。現在値と正常範囲を並べて、何が変わったか確認します。", detail: "電流 6.50 A · 基準上限 5.50 A", note: "正常上限より +1.00 A" },
    { title: "根拠をたどる", body: "変化が始まった時点とセンサーごとの寄与を確認します。観察した事実と未確認の原因候補を分けます。", detail: "観察された事実：電流上昇・振動低下", note: "原因候補には追加の確認が必要です" },
    { title: "次の確認を決める", body: "仮想記録で次に確認する根拠を選びます。判断を提出し、AIコーチングとタイムラインで見落とした時点や根拠を振り返ります。", detail: "判断記録 → 提出 → コーチング・振り返り", note: "AIは問いと説明を補助します。故障を確定しません" },
  ],
};

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
  const [language, setLanguage] = useProductLanguage();
  const t = welcomeCopy[language];
  const orientation = orientationCopy[language];
  const localizedSensors = sensors.map((item, index) => language === "ko" ? item : { ...item, ...sensorCopy[language][index] });
  const localizedSteps = steps.map((item, index) => language === "ko" ? item : { ...item, ...stepCopy[language][index] });
  const current = localizedSensors[sensor];

  useEffect(() => {
    document.title = t.title;
    const description = document.querySelector('meta[name="description"]');
    description?.setAttribute("content", t.description);
  }, [t]);

  useEffect(() => {
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
      <a className="sg-skip" href="#sg-content">{t.skip}</a>
      <header className="sg-nav">
        <Link href="/welcome" className="sg-brand" aria-label={tr(language, "SemiGuard AI 홈", "SemiGuard AI home", "SemiGuard AI ホーム")}><span className="sg-brand-symbol" aria-hidden="true">SG</span><span>SemiGuard<span className="sg-brand-ai"> AI</span></span></Link>
        <nav aria-label={t.menu}><a href="#workflow">{t.workflow}</a><a href="#principles">{t.principles}</a><ProductLanguageSelect language={language} onChange={setLanguage} /><Link href="/login" className="sg-nav-login">{t.login} <ArrowUpRight size={15} /></Link></nav>
      </header>

      <section className="sg-hero" id="sg-content">
        <div className="sg-hero-copy">
          <p className="sg-audience"><span className="sg-dot" aria-hidden="true" />{orientation.audience}</p>
          <h1>{t.hero1}<br /><span>{t.hero2}</span></h1>
          <p className="sg-intro">{t.intro1}<br />{t.intro2}</p>
          <p className="sg-simulation-scope"><Check size={15} aria-hidden="true" />{orientation.scope}</p>
          <div className="sg-hero-actions"><Link className="sg-button sg-button-primary" href="/login">{t.start} <ArrowUpRight size={18} /></Link><a href="#workflow" className="sg-text-link">{t.how} <ArrowDown size={16} /></a></div>
          <p className="sg-quiet">{t.path} <Link href="/preview">{t.preview}</Link></p>
          <Link className="sg-learn-link" href="/learn">{orientation.learn} <ArrowRight size={16} aria-hidden="true" /></Link>
        </div>
        <figure className="sg-training-preview" aria-label={orientation.example}>
          <div className="sg-training-preview-heading"><span className="sg-eyebrow">OBSERVE / REASON / REVIEW</span><h2>{orientation.example}</h2></div>
          <div className="sg-preview-observation"><p><span className="sg-preview-number">01</span>{orientation.compare}</p>
            <div className="sg-preview-legend"><span>{orientation.normal}</span><span>{orientation.observed}</span></div>
            <svg viewBox="0 0 420 150" role="img" aria-label={orientation.description}>
              <path d="M16 30H402M16 75H402M16 120H402" stroke="#31453b" strokeDasharray="3 5" />
              <path d="M16 93H402" stroke="#a9c7d2" strokeWidth="2" strokeDasharray="6 5" />
              <path d="M16 95 48 90 80 96 112 92 144 94 176 89 208 78 240 67 272 52 304 44 336 30 368 33 402 23" fill="none" stroke="#e4aa55" strokeWidth="3" strokeLinejoin="round" />
              <path d="M208 14v121" stroke="#a9c7d2" strokeDasharray="3 5" /><circle cx="208" cy="78" r="6" fill="#e4aa55" stroke="#101817" strokeWidth="2" />
            </svg>
          </div>
          <div className="sg-preview-reason"><p><span className="sg-preview-number">02</span>{orientation.record}</p><blockquote>{orientation.note}</blockquote></div>
          <div className="sg-preview-review"><p><span className="sg-preview-number">03</span>{orientation.review}</p><blockquote>{orientation.question}</blockquote><div className="sg-preview-timeline" aria-hidden="true"><span /><span /></div><p className="sg-preview-timeline-label">{orientation.timeline}</p></div>
          <figcaption>{orientation.caption}</figcaption>
        </figure>
      </section>

      <AppInstall language={language} />
      <PracticeMeasurementConsent />

      <section className="sg-sensor-console" aria-labelledby="sensor-console-title" data-reveal>
        <div className="sg-console-heading"><div><p className="sg-eyebrow">SIMULATED OBSERVATION</p><h2 id="sensor-console-title">{t.sensorTitle}</h2></div><span className="sg-outline-label">{t.example}</span></div>
        <div className="sg-console-grid">
          <div className="sg-sensor-tabs" role="group" aria-label={t.chooseSensor}>{localizedSensors.map((item, index) => <button type="button" key={index} aria-pressed={sensor === index} onClick={() => setSensor(index)}><span className="sg-mono">0{index + 1}</span><span>{item.name}</span><span>{item.value} <small>{item.unit}</small></span><ArrowUpRight size={14} /></button>)}</div>
          <div className="sg-sensor-detail" aria-live="polite">
            <div className="sg-detail-top"><span><Activity size={14} /> {current.name} {t.trend}</span><span className={sensor === 3 ? "sg-safe" : "sg-amber"}>{current.status}</span></div>
            <div className="sg-reading"><strong>{current.value}</strong><span>{current.unit}</span><p>{t.range} <b>{current.range} {current.unit}</b></p></div>
            <svg viewBox="0 0 300 115" className="sg-sparkline" role="img" aria-label={`${current.name}. ${current.difference}. ${t.chartScale}`}>
              <path d="M0 28H300M0 58H300M0 88H300" stroke="#303739" strokeDasharray="3 4" />
              <polyline key={sensor} className="sg-trace" points={current.points} fill="none" stroke={sensor === 3 ? "#8bbba6" : "#e4aa55"} strokeWidth="2.5" strokeLinejoin="round" />
            </svg>
            <div className="sg-chart-caption"><span>{t.previous}</span><span>{current.difference}</span><span>{t.now}</span></div>
          </div>
          <div className="sg-score-summary"><p className="sg-eyebrow">RULE-BASED SCORE</p><div className="sg-score">67<span>/100</span></div><span className="sg-outline-label sg-amber">{t.scoreStatus}</span><p>{t.scoreDetail}</p><Link href="/preview">{t.follow} <ArrowRight size={16} /></Link></div>
        </div>
      </section>

      <section className="sg-mode-guide" aria-labelledby="sg-mode-title" data-reveal>
        <p className="sg-eyebrow">TWO WAYS TO PRACTISE REASONING</p><h2 id="sg-mode-title">{tr(language, "배우고 판단하기. 자유롭게 비교하기.", "Learn and reason. Explore and compare.", "学んで判断し、自由に比較する。")}</h2>
        <div className="sg-mode-grid"><article><h3>{tr(language, "8대 공정 판단 연습", "Eight-process judgment practice", "8大工程の判断練習")}</h3><p>{tr(language, "준비된 공정별 기록과 정상 참고를 관찰하고, 판단을 제출한 뒤 구성 기준·AI 코칭·타임라인으로 복기합니다. 어떤 근거를 놓쳤는지 생각하는 구조화된 연습입니다.", "Observe prepared process records and normal references, submit your reasoning, then review teaching criteria, optional AI coaching, and timelines. Structured practice helps you revisit overlooked evidence.", "準備された工程別記録と正常参照を観察し、判断を提出して構成基準・任意のAIコーチング・タイムラインで振り返る、構造化された練習です。")}</p></article>
          <article><h3>{tr(language, "실시간 자유 분석", "Free observation", "自由観察")}</h3><p>{tr(language, "실행마다 달라지는 가상 식각 신호나 CSV를 시간 제한 없이 비교합니다. 고정 답안·정답 채점 없이 여러 시점의 근거 메모를 쌓는 탐색 공간입니다. 실제 팹 연결은 지원하지 않습니다.", "Compare changing virtual etch signals or CSV records without a time limit. An exploration space for evidence notes at multiple points, without fixed answers or grading. Real-fab connections are not supported.", "実行ごとに変わる仮想エッチング信号やCSVを時間制限なく比較します。固定回答・採点はなく、複数時点の根拠メモを残す探索の場です。実際の製造装置には接続しません。")}</p></article></div>
        <p>{tr(language, "로그인 전에는 장비 소개와 샘플 관찰을 제공합니다. 본 훈련·판단 제출·복기는 로그인 후 이용하며 내 선택형 기록을 저장할 수 있습니다. 중간 저장은 재생 위치와 선택 답안만, 결과 공유는 내가 선택한 기록만 대상으로 합니다.", "Before sign-in, explore equipment introductions and sample observations. Full practice, submission, and review require sign-in; your choice records stay in your account. Checkpoints contain only playback position and choices; sharing covers only a result you select.", "ログイン前は装置紹介とサンプル観察を提供します。本訓練・判断提出・振り返りはログイン後に利用し、自分の選択式記録を保存できます。中間保存は再生位置と選択回答、共有は自分が選んだ結果だけが対象です。")}</p>
        <Link href="/login" className="sg-text-link">{tr(language, "내 학습 공간 시작하기", "Start a personal learning workspace", "自分の学習スペースを始める")} <ArrowRight size={16} /></Link>
      </section>

      <section className="sg-workflow" id="workflow" data-reveal>
        <div className="sg-section-heading"><p className="sg-eyebrow">FROM SIGNAL TO NEXT CHECK</p><h2>{t.workflowTitle1}<br />{t.workflowTitle2}</h2><p>{t.workflowDetail}</p></div>
        <div className="sg-workflow-layout">
          <div className="sg-step-list" role="group" aria-label={t.chooseStep}>{localizedSteps.map((item, index) => <button key={index} type="button" onClick={() => setStep(index)} aria-pressed={step === index}><span className="sg-step-number">0{index + 1}</span><span><small>{item.subtitle}</small><strong>{item.title}</strong>{step === index && <p>{item.body}</p>}</span><ArrowUpRight size={21} /></button>)}</div>
          <div className="sg-step-preview" aria-live="polite"><p className="sg-eyebrow">INSPECTION NOTE / 0{step + 1}</p><ScanLine size={38} strokeWidth={1} /><h3>{localizedSteps[step].detail}</h3><div className="sg-note-rule" /><p>{localizedSteps[step].note}</p><span className="sg-preview-foot">SEMI GUARD · GUIDED OBSERVATION</span></div>
        </div>
      </section>

      <section className="sg-principles" id="principles" data-reveal>
        <div><p className="sg-eyebrow">BUILT FOR UNDERSTANDING</p><h2>{t.principlesTitle1}<br />{t.principlesTitle2}</h2></div>
        <div className="sg-principle-list">{t.principlesList.map(([title, body], index) => <article key={index}><span className="sg-mono">0{index + 1}</span><div><h3>{title}</h3><p>{body}</p></div><Check size={17} /></article>)}</div>
      </section>

      <section className="sg-final-cta" data-reveal><p className="sg-eyebrow">YOUR NEXT CHECK STARTS HERE</p><h2>{t.final1}<br /><span>{t.final2}</span></h2><Link href="/login" className="sg-button sg-button-primary">{t.selectPractice} <ArrowUpRight size={20} /></Link><p>{t.afterLogin}</p></section>
      <footer className="sg-footer"><span>SemiGuard AI</span><p>{t.footer}</p><Link href="/login">{t.login} <ArrowUpRight size={14} /></Link></footer>
    </main>
  );
}
