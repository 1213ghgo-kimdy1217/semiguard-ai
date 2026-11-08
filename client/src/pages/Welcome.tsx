import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { ArrowDown, ArrowRight, ArrowUpRight, Activity, Check, ScanLine } from "lucide-react";
import AppInstall from "../components/AppInstall";
import { useAccountSession } from "../components/AccountSession";
import WelcomeStudioShowcase from "../components/WelcomeStudioShowcase";
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
  { title: "장비를 열고 원리 체험", subtitle: "PREPARE", body: "공정을 선택하고 3D 장비 문을 열어요. 준비 단계에서 내부 구조와 움직임을 살펴봐요.", detail: "외관 → 내부 구조 → 원리 체험", note: "산화로에서는 웨이퍼 보트를 움직이고 산화막이 자라는 원리를 확인해요." },
  { title: "검사 기록을 비교하고 표시", subtitle: "OBSERVE", body: "재생과 일시정지로 검사 기록을 살펴봐요. 관측값을 정상 참고와 비교하고 다시 볼 시점을 표시해요.", detail: "가상 검사값 · 정상 참고 · 표시한 시점", note: "변화를 본 시점과 원인에 대한 추정을 구분해 판단을 작성해요." },
  { title: "제출한 판단을 같은 장면에서 복기", subtitle: "REVIEW", body: "제출한 뒤 표시한 시점으로 돌아가 내 판단과 검사 기록을 다시 봐요. 참고 장비의 제조사 자료도 확인할 수 있어요.", detail: "타임라인 복기 → 장비 자료 → 선택적 AI 코칭", note: "AI 코칭은 요청할 때만 답안과 가상 기록을 바탕으로 확인할 질문을 제안해요." },
];

const welcomeCopy = {
  ko: {
    title: "SemiGuard AI — 반도체 장비 판단 훈련", description: "SemiGuard AI(세미가드 에이아이)는 가상 장비 데이터로 8대 공정 판단을 연습하고 AI 코칭·복기로 배우는 교육 플랫폼입니다.", skip: "본문으로 건너뛰기", menu: "주 메뉴", workflow: "판단의 흐름", principles: "설계 원칙", login: "로그인", hero1: "반도체 장비", hero2: "판단 훈련 플랫폼", intro1: "3D 장비를 열고, 가상 검사 기록에서 판단의 근거를 찾아보세요.", intro2: "제출한 판단은 장비 장면과 타임라인에서 다시 살펴볼 수 있어요.", start: "로그인하고 시작하기", how: "어떻게 작동하나요", path: "소개 → 로그인 → 연습 방식 선택 ·", preview: "로그인하고 샘플 살펴보기", figure: "관찰에서 시작하는 판단", sensorTitle: "4센서 대시보드의 관측 예시", example: "예시 데이터 · 16개 관측값", chooseSensor: "관찰할 센서 선택", trend: "추이", range: "정상 범위", previous: "이전 관측", now: "현재", chartScale: "센서 간 세로축 축척은 다릅니다.", scoreStatus: "경고 · 센서 근거 확인", scoreDetail: "정상 기준과의 편차를 합산한 점수입니다. 고장 확률을 의미하지 않습니다.", follow: "연습 방식 살펴보기", workflowTitle1: "장비를 여는 순간부터", workflowTitle2: "판단을 복기할 때까지.", workflowDetail: "8대 공정 판단 연습에서 따라가는 세 단계예요.", chooseStep: "판단 단계 선택", principlesTitle1: "설명할 수 있는 근거.", principlesTitle2: "분명하게 정한 역할.", final1: "이제, 신호를", final2: "직접 읽어보세요.", selectPractice: "로그인하고 연습 선택하기", afterLogin: "공정별 판단 연습이나 장비 모형 실습을 선택해 시작할 수 있어요.", footer: "반도체 신입 엔지니어를 위한 장비 판단 훈련 플랫폼",
    principlesList: [["위험 점수는 규칙으로", "정상 기준과 z-score 편차로 계산합니다. 학습된 AI 모델이 위험 점수를 산출하지 않습니다."], ["AI는 설명을 돕도록", "센서 근거, 가능한 원인 후보, 권장 확인 순서를 정리합니다. 원인을 확정하거나 설비에 명령을 보내지 않습니다."], ["검증 범위는 투명하게", "현재는 가상 센서 데이터를 활용한 교육·점검 보조 시스템입니다. 실제 팹 성능은 검증되지 않았습니다."]],
  },
  en: {
    title: "SemiGuard AI — Semiconductor judgment training", description: "An equipment-reasoning training platform for new semiconductor engineers. Observe synthetic records, form your own judgment, then review feedback and timelines.", skip: "Skip to content", menu: "Main navigation", workflow: "How judgment works", principles: "Design principles", login: "Log in", hero1: "Semiconductor equipment.", hero2: "Practise your judgment.", intro1: "Open 3D equipment and find evidence in synthetic inspection records.", intro2: "Revisit your submitted judgment in the equipment scene and on its timeline.", start: "Log in to begin", how: "How it works", path: "Introduction → Login → Choose practice ·", preview: "Sign in to explore the sample", figure: "Reasoning starts with observation", sensorTitle: "An observation example from the four-sensor dashboard", example: "Example data · 16 observations", chooseSensor: "Choose a sensor", trend: "trend", range: "Normal range", previous: "Earlier", now: "Now", chartScale: "Vertical scales differ between sensors.", scoreStatus: "Warning · inspect sensor evidence", scoreDetail: "This score aggregates deviations from synthetic normal baselines. It is not a failure probability.", follow: "Explore practice options", workflowTitle1: "From opening the equipment", workflowTitle2: "to reviewing your judgment.", workflowDetail: "Follow three steps in the eight-process judgment practice.", chooseStep: "Choose a reasoning step", principlesTitle1: "Explainable evidence.", principlesTitle2: "Clearly defined roles.", final1: "Now read the", final2: "signals yourself.", selectPractice: "Log in and choose practice", afterLogin: "Choose a process judgment exercise or an equipment model lab.", footer: "Equipment judgment training for new semiconductor engineers",
    principlesList: [["Rules calculate risk", "Normal baselines and z-score deviations drive the score. A trained AI model does not calculate risk."], ["AI helps explain", "AI organizes sensor evidence, possible causes, and suggested next checks. It does not confirm a cause or command equipment."], ["Scope is transparent", "This educational aid currently uses synthetic sensor data. Performance in a real fab has not been validated."]],
  },
  ja: {
    title: "SemiGuard AI — 半導体装置の判断訓練", description: "半導体の新人エンジニア向け装置判断訓練プラットフォーム。教育用仮想記録を観察して判断し、フィードバックとタイムラインで振り返ります。", skip: "本文へ移動", menu: "メインメニュー", workflow: "判断の流れ", principles: "設計原則", login: "ログイン", hero1: "半導体装置の", hero2: "判断訓練プラットフォーム", intro1: "3D装置を開き、仮想の検査記録から判断の根拠を探します。", intro2: "提出した判断は、装置の場面とタイムラインで振り返ることができます。", start: "ログインして始める", how: "仕組みを見る", path: "紹介 → ログイン → 練習方法の選択 ·", preview: "ログインしてサンプルを見る", figure: "観察から始まる判断", sensorTitle: "4センサーダッシュボードの観察例", example: "サンプルデータ · 観測値16件", chooseSensor: "センサーを選択", trend: "の推移", range: "正常範囲", previous: "以前の観測", now: "現在", chartScale: "センサーごとに縦軸の尺度は異なります。", scoreStatus: "警告 · センサーの根拠を確認", scoreDetail: "仮想の正常基準からの偏差を合算した点数です。故障確率ではありません。", follow: "練習方法を見る", workflowTitle1: "装置を開いてから、", workflowTitle2: "判断を振り返るまで。", workflowDetail: "8大工程の判断練習を三つの段階で紹介します。", chooseStep: "判断の段階を選択", principlesTitle1: "説明できる根拠。", principlesTitle2: "明確にした役割。", final1: "今度は自分で、", final2: "信号を読んでみましょう。", selectPractice: "ログインして練習を選ぶ", afterLogin: "工程別の判断練習や装置模型の実習を選んで始められます。", footer: "半導体の新人エンジニア向け装置判断訓練プラットフォーム",
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
  ko: { audience: "반도체 신입 엔지니어를 위한", scope: "교육용 시뮬레이션 · 가상 공정 기록", learn: "8대 공정 학습 살펴보기" },
  en: { audience: "For new semiconductor engineers", scope: "Educational simulation · synthetic process records", learn: "Explore the eight processes" },
  ja: { audience: "半導体の新人エンジニアのための", scope: "教育用シミュレーション・仮想の工程記録", learn: "8大工程の学習を見る" },
} as const;

const stepCopy = {
  en: [
    { title: "Open the equipment and explore", body: "Select a process and open the 3D equipment. Follow the preparation steps to explore the parts and their movements.", detail: "Exterior → interior → process in action", note: "In oxidation, move the wafer boat and explore how the oxide layer grows." },
    { title: "Compare and mark inspection records", body: "Play and pause the inspection record. Compare readings with a normal reference and mark points you want to revisit.", detail: "Synthetic reading · normal reference · marked time", note: "Keep observed changes separate from possible causes when you write your judgment." },
    { title: "Review your judgment in the same scene", body: "After submitting, return to marked points to revisit your judgment and the readings. Explore the related equipment and manufacturer sources.", detail: "Timeline review → equipment sources → optional AI coaching", note: "When you request it, AI coaching suggests questions based on your answers and the synthetic record." },
  ],
  ja: [
    { title: "装置を開いて原理を学ぶ", body: "工程を選び、3D装置の扉を開きます。準備の手順に沿って内部構造と動きを観察します。", detail: "外観 → 内部構造 → 工程の動き", note: "酸化工程ではウェーハボートを動かし、酸化膜が成長する仕組みを確認します。" },
    { title: "検査記録を比較して印を付ける", body: "検査記録を再生・一時停止し、観測値と正常参照値を比べます。見直したい時点に印を付けます。", detail: "仮想の検査値・正常参照値・印を付けた時点", note: "観察した変化と原因の推測を区別して判断を書きます。" },
    { title: "同じ場面で提出した判断を見直す", body: "提出後は印を付けた時点に戻り、判断と検査記録を見直します。関連装置やメーカー資料も確認できます。", detail: "タイムラインで振り返り → 装置資料 → 任意のAIコーチング", note: "AIコーチングは、利用者がリクエストしたときに回答と仮想記録をもとに確認の問いを提案します。" },
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
  const [language] = useProductLanguage();
  const t = welcomeCopy[language];
  const signedIn = useAccountSession()?.signedIn ?? false;
  const practiceHref = signedIn ? "/training" : "/login";
  const practiceLabel = signedIn ? tr(language, "판단 연습 시작하기", "Start judgment practice", "判断練習を始める") : t.start;
  const sampleLabel = signedIn ? tr(language, "30초 샘플 보기", "View the 30-second sample", "30秒のサンプルを見る") : t.preview;
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
    if (window.location.hash !== "#studio-preview") return;
    const frame = requestAnimationFrame(() => document.getElementById("studio-preview")?.scrollIntoView());
    return () => cancelAnimationFrame(frame);
  }, []);

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
      <section className="sg-hero" id="sg-content">
        <div className="sg-hero-copy">
          <p className="sg-audience"><span className="sg-dot" aria-hidden="true" />{orientation.audience}</p>
          <h1>{t.hero1}<br /><span>{t.hero2}</span></h1>
          <p className="sg-intro">{t.intro1}<br />{t.intro2}</p>
          <p className="sg-simulation-scope"><Check size={15} aria-hidden="true" />{orientation.scope}</p>
          <div className="sg-hero-actions"><Link className="sg-button sg-button-primary" href={practiceHref}>{practiceLabel} <ArrowUpRight size={18} /></Link><a href="#workflow" className="sg-text-link">{t.how} <ArrowDown size={16} /></a></div>
          <p className="sg-quiet">{signedIn ? null : t.path+" "}<Link href="/preview">{sampleLabel}</Link></p>
          <Link className="sg-learn-link" href="/learn">{orientation.learn} <ArrowRight size={16} aria-hidden="true" /></Link>
        </div>
        <WelcomeStudioShowcase language={language} signedIn={signedIn} />
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
          <div className="sg-score-summary"><p className="sg-eyebrow">RULE-BASED SCORE</p><div className="sg-score">67<span>/100</span></div><span className="sg-outline-label sg-amber">{t.scoreStatus}</span><p>{t.scoreDetail}</p><Link href="/training">{t.follow} <ArrowRight size={16} /></Link></div>
        </div>
      </section>

      <section className="sg-mode-guide" aria-labelledby="sg-mode-title" data-reveal>
        <p className="sg-eyebrow">TWO WAYS TO PRACTISE REASONING</p><h2 id="sg-mode-title">{tr(language, "배우고 판단하기. 자유롭게 비교하기.", "Learn and reason. Explore and compare.", "学んで判断し、自由に比較する。")}</h2>
        <div className="sg-mode-grid"><article><h3>{tr(language, "8대 공정 판단 연습", "Eight-process judgment practice", "8大工程の判断練習")}</h3><p>{tr(language, "공정별 3D 장비에서 가상 검사 기록을 정상 참고와 비교합니다. 판단을 제출하고 같은 장면으로 돌아가 근거를 다시 봅니다.", "Compare synthetic inspection records with normal references in each 3D process scene. Submit your judgment and return to the same scene to review the evidence.", "工程別の3D装置で仮想の検査記録を正常参照値と比べます。判断を提出し、同じ場面に戻って根拠を見直します。")}</p></article>
          <article><h3>{tr(language, "장비 모형 실습", "Equipment model lab", "装置模型の実習")}</h3><p>{tr(language, "가상 식각 챔버에서 압력·유량·RF 전력·온도를 관찰합니다. 교육용 모형을 연결하거나 화면에서 모의 체험을 시작할 수 있어요.", "Observe pressure, flow, RF power and temperature in a simulated etch chamber. Connect the teaching model or start an on-screen simulation.", "模擬エッチングチャンバーの圧力、流量、RF電力、温度を観察します。学習用模型を接続するか、画面上で模擬体験を始められます。")}</p></article></div>
        <p>{tr(language, "첫 화면에서는 서비스의 구성과 활용 흐름을 소개합니다. 공정 학습·샘플 관찰·판단 연습·공유 기록 열람은 로그인 후 이용하며 내 선택형 기록을 저장할 수 있습니다. 중간 저장은 재생 위치와 선택 답안만, 결과 공유는 내가 선택한 기록만 대상으로 합니다.", "The first page introduces the service and its workflow. Process learning, sample observation, practice and shared records require sign-in; your choice records stay in your account. Checkpoints contain only playback position and choices; sharing covers only a result you select.", "最初の画面ではサービスの構成と利用の流れを紹介します。工程学習・サンプル観察・判断練習・共有記録の閲覧はログイン後に利用し、自分の選択式記録を保存できます。中間保存は再生位置と選択回答、共有は自分が選んだ結果だけが対象です。")}</p>
        <Link href={practiceHref} className="sg-text-link">{tr(language, "내 학습 공간 시작하기", "Start a personal learning workspace", "自分の学習スペースを始める")} <ArrowRight size={16} /></Link>
      </section>

      <section className="sg-workflow" id="workflow" data-reveal>
        <p className="sg-quiet"><a href="#workflow">{t.workflow}</a><span aria-hidden="true"> · </span><a href="#principles">{t.principles}</a></p>
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

      <section className="sg-final-cta" data-reveal><p className="sg-eyebrow">YOUR NEXT CHECK STARTS HERE</p><h2>{t.final1}<br /><span>{t.final2}</span></h2><Link href={practiceHref} className="sg-button sg-button-primary">{signedIn ? practiceLabel : t.selectPractice} <ArrowUpRight size={20} /></Link><p>{t.afterLogin}</p></section>
      <footer className="sg-footer"><span>SemiGuard AI</span><p>{t.footer}</p><Link href={signedIn ? "/account" : "/login"}>{signedIn ? tr(language, "내 계정", "My account", "マイアカウント") : t.login} <ArrowUpRight size={14} /></Link></footer>
    </main>
  );
}
