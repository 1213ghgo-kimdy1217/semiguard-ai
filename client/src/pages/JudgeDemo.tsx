import { Link } from "wouter";
import { useEffect, useMemo, useState } from "react";

type DemoLanguage = "ko" | "en" | "ja";
type DemoStep = 1 | 2 | 3;

const copy: Record<DemoLanguage, {
  badge: string; title: string; subtitle: string; readOnly: string; simulated: string;
  steps: [string, string, string]; start: string; previous: string; next: string; complete: string;
  riskTitle: string; riskLabel: string; riskDescription: string; evidenceTitle: string; evidenceDescription: string;
  actionTitle: string; actionDescription: string; actionOne: string; actionTwo: string; actionThree: string;
  timing: string; login: string; privacy: string; noControl: string; sensorLabels: [string, string, string, string];
}> = {
  ko: {
    badge: "심사위원 읽기 전용 데모", title: "30초로 확인하는 SemiGuard AI 안전 분석", subtitle: "실제 설비·계정 데이터 없이, 위험 신호에서 점검 순서까지의 판단 흐름을 체험합니다.", readOnly: "읽기 전용", simulated: "시뮬레이션 데이터",
    steps: ["위험 신호", "센서 근거", "권장 점검"], start: "데모 시작", previous: "이전", next: "다음 단계", complete: "핵심 흐름을 확인했습니다", riskTitle: "1. 위험 신호를 빠르게 확인합니다", riskLabel: "경고", riskDescription: "가상 진공 펌프의 위험도 점수가 상승했습니다. 이 화면은 교육·심사용 시뮬레이션이며 실제 설비 제어를 수행하지 않습니다.", evidenceTitle: "2. 센서 근거를 함께 확인합니다", evidenceDescription: "AI 판단은 수치만으로 고장을 단정하지 않습니다. 편차가 큰 센서를 먼저 보여 주고, 현장 점검과 매뉴얼 확인을 요청합니다.", actionTitle: "3. 권장 점검 순서를 확인합니다", actionDescription: "위험 신호는 담당자 판단을 보조합니다. 시스템이 자동으로 장비를 제어하거나 작업 결정을 대신하지 않습니다.", actionOne: "최근 30분의 전류·진동 추이를 확인합니다.", actionTwo: "관련 설비 매뉴얼과 직전 점검 이력을 대조합니다.", actionThree: "현장 담당자에게 보고하고 승인된 안전 절차에 따라 점검합니다.", timing: "3단계 · 약 30초", login: "정식 대시보드 로그인", privacy: "실제 사용자·설비 데이터는 이 데모에 포함되지 않습니다.", noControl: "설정 변경, 데이터 주입, 내보내기, 상담 기록 저장은 제공하지 않습니다.", sensorLabels: ["전류", "온도", "진동", "소음"],
  },
  en: {
    badge: "Read-only judge demo", title: "See SemiGuard AI safety analysis in 30 seconds", subtitle: "Experience the path from a risk signal to an inspection sequence without real equipment or account data.", readOnly: "Read only", simulated: "Simulated data",
    steps: ["Risk signal", "Sensor evidence", "Inspection steps"], start: "Start demo", previous: "Previous", next: "Next step", complete: "Core flow reviewed", riskTitle: "1. See the risk signal quickly", riskLabel: "Warning", riskDescription: "The risk score of a simulated vacuum pump has risen. This is an education and judging simulation; it never controls real equipment.", evidenceTitle: "2. Review the sensor evidence", evidenceDescription: "AI does not diagnose a failure from numbers alone. It highlights the largest deviations first and asks for on-site and manual verification.", actionTitle: "3. Review the recommended inspection order", actionDescription: "The risk signal supports the responsible operator. The system does not control equipment or replace a work decision.", actionOne: "Review the recent 30-minute current and vibration trend.", actionTwo: "Compare the relevant equipment manual and the last inspection record.", actionThree: "Report to the responsible operator and inspect under approved safety procedures.", timing: "3 steps · about 30 seconds", login: "Sign in to full dashboard", privacy: "No real user or equipment data is included in this demo.", noControl: "Settings, data injection, export, and consultation history saving are unavailable.", sensorLabels: ["Current", "Temperature", "Vibration", "Noise"],
  },
  ja: {
    badge: "審査員向け読み取り専用デモ", title: "30秒で確認するSemiGuard AI安全分析", subtitle: "実際の設備・アカウントデータなしで、危険信号から点検順序までの判断フローを体験できます。", readOnly: "読み取り専用", simulated: "シミュレーションデータ",
    steps: ["危険信号", "センサー根拠", "推奨点検"], start: "デモを開始", previous: "前へ", next: "次の段階", complete: "主要フローを確認しました", riskTitle: "1. 危険信号を素早く確認します", riskLabel: "警告", riskDescription: "仮想真空ポンプのリスクスコアが上昇しました。この画面は教育・審査用シミュレーションであり、実際の設備を制御しません。", evidenceTitle: "2. センサー根拠を確認します", evidenceDescription: "AIは数値だけで故障を断定しません。偏差の大きいセンサーを先に示し、現地点検とマニュアル確認を求めます。", actionTitle: "3. 推奨点検順序を確認します", actionDescription: "危険信号は担当者の判断を補助します。システムが設備を自動制御したり、作業判断を代替したりすることはありません。", actionOne: "直近30分の電流・振動の推移を確認します。", actionTwo: "関連設備マニュアルと直前の点検記録を照合します。", actionThree: "現場担当者へ報告し、承認された安全手順に従って点検します。", timing: "3段階・約30秒", login: "正式ダッシュボードにログイン", privacy: "このデモには実際のユーザー・設備データは含まれません。", noControl: "設定変更、データ注入、エクスポート、相談履歴保存は提供しません。", sensorLabels: ["電流", "温度", "振動", "騒音"],
  },
};

const sensorData = [
  { value: "8.7 A", normal: "5.0 ± 0.5 A", accent: "#f59e0b" },
  { value: "51.2 °C", normal: "45 ± 3 °C", accent: "#38bdf8" },
  { value: "0.81 mm/s", normal: "2.0 ± 0.3 mm/s", accent: "#fb7185" },
  { value: "57.4 dB", normal: "55 ± 4 dB", accent: "#a78bfa" },
];

function getInitialLanguage(): DemoLanguage {
  try {
    const saved = localStorage.getItem("semiguard_lang");
    return saved === "en" || saved === "ja" || saved === "ko" ? saved : "ko";
  } catch {
    return "ko";
  }
}

export default function JudgeDemo() {
  const [lang, setLang] = useState<DemoLanguage>(getInitialLanguage);
  const [step, setStep] = useState<DemoStep>(1);
  const text = copy[lang];
  const activeTitle = useMemo(() => step === 1 ? text.riskTitle : step === 2 ? text.evidenceTitle : text.actionTitle, [step, text]);

  useEffect(() => {
    try { localStorage.setItem("semiguard_lang", lang); } catch {}
    document.documentElement.lang = lang;
    document.title = lang === "ko" ? "SemiGuard AI 심사위원 읽기 전용 데모" : lang === "ja" ? "SemiGuard AI 審査員向け読み取り専用デモ" : "SemiGuard AI Read-only Judge Demo";
  }, [lang]);

  const advance = () => setStep(current => current < 3 ? ((current + 1) as DemoStep) : 3);
  const previous = () => setStep(current => current > 1 ? ((current - 1) as DemoStep) : 1);

  return <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(6,182,212,0.22),transparent_38%),linear-gradient(135deg,#07111f,#0f172a_55%,#111827)] px-4 py-5 text-slate-100 sm:px-7 sm:py-8">
    <div className="mx-auto max-w-5xl">
      <header className="mb-6 flex flex-col gap-4 rounded-2xl border border-cyan-200/20 bg-slate-950/45 p-4 backdrop-blur sm:flex-row sm:items-start sm:justify-between sm:p-5">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-cyan-200/45 bg-cyan-300/10 px-2.5 py-1 text-[10px] font-bold tracking-wide text-cyan-100">{text.badge}</span>
            <span className="rounded-full border border-amber-200/35 bg-amber-300/10 px-2.5 py-1 text-[10px] font-bold text-amber-100">{text.readOnly}</span>
          </div>
          <h1 className="text-xl font-black tracking-tight sm:text-2xl">{text.title}</h1>
          <p className="mt-2 max-w-2xl text-xs leading-5 text-slate-300 sm:text-sm">{text.subtitle}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <label className="sr-only" htmlFor="judge-demo-language">Language</label>
          <select id="judge-demo-language" value={lang} onChange={event => setLang(event.target.value as DemoLanguage)} className="h-9 rounded-lg border border-slate-600 bg-slate-900 px-2 text-xs font-bold text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-300">
            <option value="ko">한국어</option><option value="en">English</option><option value="ja">日本語</option>
          </select>
          <Link href="/login" className="flex h-9 items-center rounded-lg border border-cyan-300/55 bg-cyan-300/10 px-3 text-xs font-bold text-cyan-100 transition hover:bg-cyan-300/20 focus:outline-none focus:ring-2 focus:ring-cyan-200">{text.login}</Link>
        </div>
      </header>

      <section className="mb-5 rounded-xl border border-amber-200/35 bg-amber-300/10 p-3 text-xs text-amber-50" role="note">
        <span className="font-bold">{text.simulated} · </span>{text.privacy} {text.noControl}
      </section>

      <section className="rounded-2xl border border-slate-700/90 bg-slate-950/65 p-4 shadow-2xl shadow-cyan-950/20 sm:p-6" aria-labelledby="judge-demo-flow-title">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 id="judge-demo-flow-title" className="text-base font-bold text-slate-50">{activeTitle}</h2>
            <p className="mt-1 text-xs text-slate-400">{text.timing}</p>
          </div>
          <div className="flex gap-1.5" role="tablist" aria-label={text.timing}>
            {text.steps.map((label, index) => <button key={label} type="button" role="tab" aria-selected={step === index + 1} onClick={() => setStep((index + 1) as DemoStep)} className="flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[10px] font-bold transition focus:outline-none focus:ring-2 focus:ring-cyan-300" style={{ borderColor: step === index + 1 ? "rgba(103,232,249,0.75)" : "rgba(71,85,105,0.8)", background: step === index + 1 ? "rgba(34,211,238,0.13)" : "rgba(15,23,42,0.6)", color: step === index + 1 ? "#cffafe" : "#94a3b8" }}><span className="flex h-4 w-4 items-center justify-center rounded-full border border-current text-[9px]">{index + 1}</span>{label}</button>)}
          </div>
        </div>

        <div role="tabpanel" className="min-h-[300px]">
          {step === 1 && <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-xl border border-amber-300/40 bg-[linear-gradient(135deg,rgba(245,158,11,0.16),rgba(15,23,42,0.72))] p-5">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-200">{text.riskLabel}</p>
              <div className="mt-4 flex items-end gap-4"><span className="font-mono text-6xl font-black leading-none text-amber-300">67</span><span className="mb-1 text-sm font-bold text-amber-100">/ 100</span></div>
              <div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-800"><div className="h-full w-[67%] rounded-full bg-gradient-to-r from-cyan-400 via-amber-300 to-rose-400" /></div>
              <p className="mt-5 text-sm leading-6 text-slate-200">{text.riskDescription}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">{sensorData.map((sensor, index) => <article key={sensor.value} className="rounded-xl border border-slate-700 bg-slate-900/65 p-3"><p className="text-[10px] font-bold text-slate-400">{text.sensorLabels[index]}</p><p className="mt-2 font-mono text-xl font-black" style={{ color: sensor.accent }}>{sensor.value}</p><p className="mt-2 text-[10px] text-slate-500">{sensor.normal}</p></article>)}</div>
          </div>}

          {step === 2 && <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-xl border border-rose-300/35 bg-rose-300/5 p-5"><p className="text-xs font-bold text-rose-200">{text.sensorLabels[0]} · {text.sensorLabels[2]}</p><div className="mt-4 flex h-40 items-end gap-2" aria-label={`${text.sensorLabels[0]} and ${text.sensorLabels[2]} trend`}>
              {[22, 30, 26, 42, 49, 55, 61, 68, 74, 81, 76, 88].map((height, index) => <span key={index} className="flex-1 rounded-t bg-gradient-to-t from-rose-500/45 to-amber-300/90" style={{ height: `${height}%` }} />)}
            </div><p className="mt-4 text-sm leading-6 text-slate-200">{text.evidenceDescription}</p></div>
            <aside className="rounded-xl border border-cyan-300/30 bg-cyan-300/5 p-5"><p className="text-xs font-bold text-cyan-100">Evidence / 根拠 / 근거</p><ul className="mt-4 space-y-3 text-xs leading-5 text-slate-300"><li className="rounded-lg bg-slate-900/75 p-3">• {text.sensorLabels[0]}: +3.7 A from baseline</li><li className="rounded-lg bg-slate-900/75 p-3">• {text.sensorLabels[2]}: recent upward trend</li><li className="rounded-lg bg-slate-900/75 p-3">• Score: 67/100 · {text.riskLabel}</li></ul></aside>
          </div>}

          {step === 3 && <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]"><div className="rounded-xl border border-emerald-300/35 bg-emerald-300/5 p-5"><p className="text-xs font-bold text-emerald-100">SAFE NEXT STEP</p><p className="mt-4 text-sm leading-6 text-slate-200">{text.actionDescription}</p><div className="mt-5 rounded-lg border border-slate-700 bg-slate-900/75 p-3 text-xs text-slate-400">{text.complete}</div></div><ol className="space-y-3">{[text.actionOne, text.actionTwo, text.actionThree].map((action, index) => <li key={action} className="flex gap-3 rounded-xl border border-slate-700 bg-slate-900/65 p-4"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-cyan-300/15 text-xs font-black text-cyan-100">{index + 1}</span><p className="pt-0.5 text-sm leading-6 text-slate-200">{action}</p></li>)}</ol></div>}
        </div>

        <div className="mt-6 flex items-center justify-between gap-3 border-t border-slate-800 pt-4">
          <button type="button" onClick={previous} disabled={step === 1} className="h-10 rounded-lg border border-slate-600 px-4 text-xs font-bold text-slate-200 transition hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-cyan-300">{text.previous}</button>
          {step === 1 ? <button type="button" onClick={advance} className="h-10 rounded-lg border border-cyan-300/60 bg-cyan-300/10 px-4 text-xs font-bold text-cyan-100 transition hover:bg-cyan-300/20 focus:outline-none focus:ring-2 focus:ring-cyan-200">{text.start}</button> : step < 3 ? <button type="button" onClick={advance} className="h-10 rounded-lg border border-cyan-300/60 bg-cyan-300/10 px-4 text-xs font-bold text-cyan-100 transition hover:bg-cyan-300/20 focus:outline-none focus:ring-2 focus:ring-cyan-200">{text.next}</button> : <Link href="/login" className="flex h-10 items-center rounded-lg border border-cyan-300/60 bg-cyan-300/10 px-4 text-xs font-bold text-cyan-100 transition hover:bg-cyan-300/20 focus:outline-none focus:ring-2 focus:ring-cyan-200">{text.login}</Link>}
        </div>
      </section>
    </div>
  </main>;
}
