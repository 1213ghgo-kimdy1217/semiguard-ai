import React, { useEffect, useState } from "react";
import { Link } from "wouter";
import { useAuth } from "../_core/hooks/useAuth";
import ProductLanguageSelect from "../components/ProductLanguageSelect";
import PracticeMeasurementConsent from "../components/PracticeMeasurement";
import { tr, useProductLanguage, type ProductLanguage } from "../lib/productLanguage";
import { etchSample, etchSignals, type EtchSignal } from "../../../shared/etchScenario";
import "./etch-training.css";
import "./training-preview.css";

export const PREVIEW_TIMES = [0, 10, 20, 30] as const;
const signalNames = {
  pressure: ["챔버 압력", "Chamber pressure", "チャンバー圧力"],
  flow: ["가스 유량", "Gas flow", "ガス流量"],
  rf: ["RF 전력", "RF power", "RF電力"],
  temperature: ["온도", "Temperature", "温度"],
} as const;
const clock = (seconds: number) => `00:${String(seconds).padStart(2, "0")}`;

type PreviewProps = {
  language: ProductLanguage;
  setLanguage: (language: ProductLanguage) => void;
  authenticated: boolean;
  index: number;
  setIndex: (index: number) => void;
  signal: EtchSignal;
  setSignal: (signal: EtchSignal) => void;
};

export function TrainingPreviewContent({ language, setLanguage, authenticated, index, setIndex, signal, setSignal }: PreviewProps) {
  const l = (ko: string, en: string, ja: string) => tr(language, ko, en, ja);
  const time = PREVIEW_TIMES[index];
  const sample = etchSample(signal, time);
  const name = (id: EtchSignal) => { const labels = signalNames[id]; return l(labels[0], labels[1], labels[2]); };
  const points = PREVIEW_TIMES.map((t, i) => `${32 + i * 112},${140 - (etchSample(signal, t).value - 76) * 12}`).join(" ");
  return <div className="et-app tp-app">
    <a className="et-skip" href="#preview-main">{l("샘플로 이동", "Skip to sample", "サンプルへ移動")}</a>
    <header className="et-header">
      <Link className="et-brand" href="/welcome"><b>SG</b> SemiGuard <small>OBSERVATION PREVIEW</small></Link>
      <nav aria-label={l("제품 메뉴", "Product navigation", "製品メニュー")}>
        <Link href="/welcome">{l("소개", "Introduction", "紹介")}</Link>
        <Link href="/learn">{l("공정 개념 읽기", "Read process concepts", "工程の概念を読む")}</Link>
        <Link href={authenticated ? "/training" : "/login"}>{l(authenticated ? "내 학습 공간" : "로그인", authenticated ? "My workspace" : "Log in", authenticated ? "自分の学習画面" : "ログイン")}</Link>
        <ProductLanguageSelect language={language} onChange={setLanguage} />
      </nav>
    </header>
    <main className="et-main" id="preview-main">
      <PracticeMeasurementConsent />
      <div className="et-meta"><span>GUEST PREVIEW / 30-SECOND SAMPLE</span><span>{l("교육용 가상 값 · 실제 제어 없음", "Synthetic teaching values · no physical control", "教育用仮想値 · 実際の制御なし")}</span></div>
      <section className="tp-intro" aria-labelledby="preview-title">
        <p className="et-eyebrow">OBSERVE FIRST. PRACTISE AFTER SIGN-IN.</p>
        <h1 id="preview-title">{l("장비를 이해하고, 신호를 먼저 살펴보세요.", "Meet the equipment. Explore a sample signal.", "装置を理解し、まず信号を見てみましょう。")}</h1>
        <p className="et-lead">{l("로그인 없이 보는 장비 소개와 30초 샘플입니다. 본 훈련·판단 제출·복기는 로그인 후 시작합니다.", "An equipment introduction and 30-second sample without sign-in. Full practice, reasoning submission, and review begin after sign-in.", "ログインなしで装置紹介と30秒のサンプルを見られます。本訓練・判断の提出・振り返りはログイン後に始めます。")}</p>
        <div className="et-actions"><Link className="et-linkbutton" href={authenticated ? "/training" : "/login"}>{l(authenticated ? "연습 방식 선택하기" : "로그인하고 본 훈련 시작", authenticated ? "Choose a practice mode" : "Log in to start full practice", authenticated ? "練習方法を選ぶ" : "ログインして本訓練を始める")} <span aria-hidden="true">→</span></Link>{!authenticated ? <Link href="/signup">{l("계정 만들기", "Create an account", "アカウントを作成")}</Link> : null}</div>
      </section>
      <div className="tp-observation">
        <section className="et-panel" aria-labelledby="preview-equipment-title">
          <p className="et-eyebrow">EQUIPMENT / CONTEXT</p><h2 id="preview-equipment-title">{l("가상 플라즈마 식각 챔버", "Virtual plasma etch chamber", "仮想プラズマエッチングチャンバー")}</h2>
          <p>{l("공급 계통에서 유량, 챔버에서 압력·온도, 전력 계통에서 RF 신호를 관찰하는 개념입니다. 서로 다른 위치의 신호를 같은 시점에 비교합니다.", "Observe flow in the supply system, pressure and temperature around the chamber, and RF in the power system. Compare signals from different locations at the same point in time.", "供給系統の流量、チャンバーの圧力・温度、電力系統のRF信号を観察する概念です。異なる位置の信号を同じ時点で比較します。")}</p>
          <div className="tp-equipment-map" aria-label={l("교육용 관측 위치", "Teaching observation locations", "教育用の観察位置")}><span>{l("공급 계통", "Supply", "供給系統")}<small>{name("flow")}</small></span><span>{l("챔버", "Chamber", "チャンバー")}<small>{name("pressure")} · {name("temperature")}</small></span><span>{l("전력 계통", "Power", "電力系統")}<small>{name("rf")}</small></span></div>
          <p className="et-caption">{l("실제 센서 배치·운전 기준이 아닙니다. 물리 단위 대신 교육용 상대지수로 표시하며, 값만으로 부품 고장을 확정할 수 없습니다.", "Not a real sensor layout or operating standard. Values are teaching-only relative indices, not physical units; they cannot establish a component failure.", "実際のセンサー配置・運転基準ではありません。物理単位ではなく教育用相対指数で表示し、数値だけで部品故障を確定できません。")}</p>
        </section>
        <section className="et-panel tp-monitor" aria-labelledby="preview-sample-title">
          <p className="et-eyebrow">SAMPLE / SAME-PHASE COMPARISON</p><h2 id="preview-sample-title">{l("현재값과 정상 참고를 나란히", "Current values beside a normal reference", "現在値と正常参照を並べる")}</h2>
          <div className="tp-signals" role="group" aria-label={l("샘플 관측 항목", "Sample signal", "サンプル観察項目")}>{etchSignals.map(s => <button key={s.id} type="button" aria-pressed={signal === s.id} onClick={() => setSignal(s.id)}>{name(s.id)}</button>)}</div>
          <div className="tp-reading" role="status" aria-live="polite" aria-atomic="true"><strong>{name(signal)} <b>{sample.value.toFixed(2)}</b></strong><span>{l("교육용 상대지수", "Teaching relative index", "教育用相対指数")} · {clock(time)}</span><span>{l("정상 참고 범위", "Normal reference range", "正常参照範囲")} {sample.low}–{sample.high} · {l("같은 단계 A", "same phase A", "同じ段階A")}</span></div>
          <figure className="tp-chart"><svg viewBox="0 0 400 170" role="img" aria-label={l(`${name(signal)} 30초 샘플 추이`, `${name(signal)} 30-second sample trend`, `${name(signal)}の30秒サンプル推移`)}><title>{name(signal)}</title><rect x="20" y="44" width="360" height="96" fill="#21372b" /><line x1="20" x2="380" y1="92" y2="92" stroke="#9bab9b" strokeDasharray="5 5" /><polyline points={points} fill="none" stroke="#e4aa55" strokeWidth="3" /><circle cx={32 + index * 112} cy={140 - (sample.value - 76) * 12} r="6" fill="#edf0eb" />{PREVIEW_TIMES.map((t, i) => <text key={t} x={32 + i * 112} y="162" textAnchor="middle" fill="#b4c1b6" fontSize="12">{clock(t)}</text>)}</svg><figcaption>{l("음영: 정상 참고 범위 · 점선: 기준 중심 80 · 선택한 점은 아래 표에서도 확인할 수 있습니다.", "Shade: normal reference range · dashed line: baseline center 80 · the selected point also appears in the table below.", "網掛け：正常参照範囲・破線：基準中心80・選択した点は下の表でも確認できます。")}</figcaption></figure>
          <label className="tp-time">{l("샘플 관찰 시점", "Sample observation time", "サンプル観察時点")} <output>{clock(time)} / 00:30</output><input type="range" aria-label={l("샘플 관찰 시점", "Sample observation time", "サンプル観察時点")} min="0" max="3" step="1" value={index} aria-valuetext={clock(time)} onChange={e => setIndex(Number(e.target.value))} /></label>
          <div className="tp-table"><table><caption>{l("선택 시점의 네 가지 근거", "Four readings at the selected point", "選択時点の4つの根拠")}</caption><thead><tr><th scope="col">{l("항목", "Signal", "項目")}</th><th scope="col">{l("현재값", "Value", "現在値")}</th><th scope="col">{l("정상 참고", "Reference", "正常参照")}</th></tr></thead><tbody>{etchSignals.map(s => <tr key={s.id}><th scope="row">{name(s.id)}</th><td>{etchSample(s.id, time).value.toFixed(2)}</td><td>76–84</td></tr>)}</tbody></table></div>
        </section>
      </div>
      <section className="et-panel tp-account" aria-labelledby="preview-next-title">
        <p className="et-eyebrow">YOUR PERSONAL LEARNING WORKSPACE</p><h2 id="preview-next-title">{l("샘플 다음에는, 직접 판단하는 연습", "After the sample, practise your own reasoning", "サンプルの次は、自分で判断する練習")}</h2>
        <div className="tp-benefits"><article><h3>{l("8대 공정 판단 연습", "Eight-process practice", "8大工程の判断練習")}</h3><p>{l("장비 브리핑부터 관찰·판단 제출·타임라인 복기까지 진행합니다.", "Move from equipment briefing to observation, submission, and timeline review.", "装置の説明から観察・判断提出・タイムラインの振り返りへ進みます。")}</p></article><article><h3>{l("자유 분석과 4센서 대시보드", "Free analysis and four-sensor workspace", "自由分析と4センサー画面")}</h3><p>{l("달라지는 가상 신호나 CSV를 비교하고, 근거 메모를 남기는 분석 공간입니다.", "Compare changing synthetic signals or CSV records and keep evidence notes.", "変化する仮想信号やCSVを比較し、根拠メモを残す分析の場です。")}</p></article><article><h3>{l("내 기록 · 이어하기 · 공유", "History · resume · share", "自分の記録・再開・共有")}</h3><p>{l("계정별 선택형 결과를 다시 보고, 직접 저장한 지점에서 이어가며 원하는 결과만 공유합니다. 서술형 원문은 계정에 저장하지 않습니다.", "Revisit your choice results, resume explicit checkpoints, and share selected results. Written answers are not stored in your account.", "自分の選択式結果を見直し、保存した時点から再開し、選んだ結果だけを共有します。記述回答はアカウントに保存しません。")}</p></article></div>
        <p className="et-caption">{l("샘플에서는 판단 제출·계정 저장·개인 기록·AI 코칭을 제공하지 않습니다. AI는 로그인 후 선택적으로 판단 근거를 설명하며 고장을 확정하거나 위험 점수를 계산하지 않습니다.", "The sample has no submission, account saving, personal history, or AI coaching. After sign-in, optional AI explains reasoning; it does not confirm failures or calculate risk scores.", "サンプルでは判断提出・保存・個人記録・AIコーチングを提供しません。ログイン後の任意AIは判断根拠を説明し、故障確定やリスク点数の計算は行いません。")}</p>
        <Link className="et-linkbutton" href={authenticated ? "/training" : "/login"}>{l(authenticated ? "내 학습 공간으로" : "로그인하고 연습 선택하기", authenticated ? "Open my workspace" : "Log in and choose practice", authenticated ? "自分の学習画面へ" : "ログインして練習を選ぶ")} <span aria-hidden="true">→</span></Link>
      </section>
      <footer className="et-footer">{l("공개 원리 기반 교육용 가상 데이터 · 실제 장비 연결 없음 · 팹 성능·교육 효과 미검증", "Synthetic teaching data based on public concepts · no real equipment connection · fab performance and learning efficacy unvalidated", "公開原理に基づく教育用仮想データ・実際の装置接続なし・製造性能と教育効果は未検証")}</footer>
    </main>
  </div>;
}

export default function TrainingPreview() {
  const [language, setLanguage] = useProductLanguage();
  const { isAuthenticated } = useAuth();
  const [index, setIndex] = useState(0);
  const [signal, setSignal] = useState<EtchSignal>("pressure");
  useEffect(() => { document.title = tr(language, "SemiGuard — 장비·샘플 미리보기", "SemiGuard — Equipment and sample preview", "SemiGuard — 装置・サンプルのプレビュー"); }, [language]);
  return <TrainingPreviewContent language={language} setLanguage={setLanguage} authenticated={isAuthenticated} index={index} setIndex={setIndex} signal={signal} setSignal={setSignal} />;
}
