import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import EtchEquipmentReference from "../components/EtchEquipmentReference";
import { ArrowRight, ArrowLeft, Play, Pause, Flag, BookOpen, Activity } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, ReferenceLine } from "recharts";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ETCH_DURATION, ETCH_STORAGE_KEY, emptyEtchAttempt, etchEvidence, etchFeedback, etchPhase, etchSample, etchSamples, etchSignals, restoreEtchAttempt, setEtchMarker, validEtchAnswer, type EtchAnswer, type EtchSignal } from "../../../shared/etchScenario";
import ProductLanguageSelect from "../components/ProductLanguageSelect";
import { etchSignalLocation, etchSignalName } from "../lib/etchLanguage";
import { tr, useProductLanguage, type ProductLanguage } from "../lib/productLanguage";
import "./etch-training.css";

type Stage = "home" | "brief" | "observe" | "decision" | "review";
function readAttempt() {
  try { return restoreEtchAttempt(sessionStorage.getItem(ETCH_STORAGE_KEY)) ?? emptyEtchAttempt(); }
  catch { return emptyEtchAttempt(); }
}
const clock = (t: number) => `${Math.floor(t / 60).toString().padStart(2, "0")}:${(t % 60).toString().padStart(2, "0")}`;

const feedbackCopy = {
  en: {
    signal: ["Main change", "In this teaching scenario, pressure shows a sustained deviation while phase B is maintained."],
    onset: ["Onset interval", "The trend begins at 70 seconds by design. The start of a trend and crossing a range boundary are different moments."],
    comparison: ["Compare within the same phase", "The phase change at 40 seconds is normal and changes the baseline. Compare the same phase and point in the run."],
    certainty: ["Separate fact from inference", "The pressure deviation is an observation. This data alone cannot confirm a specific component failure."],
  },
  ja: {
    signal: ["主な変化", "この教育用シナリオでは、段階Bが続く間に圧力の継続的な偏差が現れます。"],
    onset: ["変化開始区間", "傾向の変化は70秒から始まるように構成しています。傾向の開始と基準範囲からの逸脱は別の時点です。"],
    comparison: ["同じ段階の基準と比較", "40秒の段階変更は基準そのものが変わる正常な変化です。同じ段階・同じ進行位置の記録を比較します。"],
    certainty: ["事実と推測を区別", "圧力の偏差は観察事実です。このデータだけで特定部品の故障は確定できません。"],
  },
} as const;

export function SignalChart({ signal, until, marker, review = false, sampleStep = 1, sourceSamples, language = "ko" }: { signal: EtchSignal; until: number; marker: number | null; review?: boolean; sampleStep?: number; sourceSamples?: ReturnType<typeof etchSamples>; language?: ProductLanguage }) {
  const samples = (sourceSamples ?? etchSamples(signal, until)).filter(sample => sample.time % sampleStep === 0);
  return <div className="et-chart" role="img" aria-label={tr(language, `${etchSignalName(language, signal)}, ${clock(until)}까지의 가상 상대지수. 실선은 현재 기록, 점선은 같은 단계의 정상 참고 기록입니다. 상세 수치는 관측값 표에서 확인할 수 있습니다.`, `${etchSignalName(language, signal)}, synthetic relative index through ${clock(until)}. Solid: current run; dashed: normal reference at the same phase. Exact values are in the observations table.`, `${etchSignalName(language, signal)}、${clock(until)}までの仮想相対指数。実線は今回の記録、破線は同じ段階の正常参照記録です。詳細値は観測値表にあります。`)}>
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={samples} margin={{ top: 12, right: 12, bottom: 12, left: 0 }}>
        <CartesianGrid stroke="#31465b" strokeDasharray="3 3" />
        <XAxis dataKey="time" type="number" domain={sourceSamples ? [samples[0]?.time ?? 0, Math.max(samples.at(-1)?.time ?? 0, 1)] : [0, Math.max(ETCH_DURATION, until)]} ticks={!sourceSamples && until <= ETCH_DURATION ? [0, 60, 120, 180] : undefined} tickFormatter={clock} stroke="#b5c7d8" fontSize={12} />
        <YAxis domain={[70, 130]} ticks={[70, 90, 110, 130]} stroke="#b5c7d8" fontSize={12} width={38} />
        <Tooltip labelFormatter={v => `${tr(language, "교육용 경과", "Training elapsed", "教育用経過")} ${clock(Number(v))}`} contentStyle={{ background: "#112438", border: "1px solid #657a8c", color: "#fff" }} formatter={(v: number) => v.toFixed(1)} />
        <Line name={tr(language, "가상 기준 상한", "Synthetic upper limit", "仮想基準上限")} dataKey="high" stroke="#668878" dot={false} isAnimationActive={false} strokeDasharray="2 4" />
        <Line name={tr(language, "가상 기준 하한", "Synthetic lower limit", "仮想基準下限")} dataKey="low" stroke="#668878" dot={false} isAnimationActive={false} strokeDasharray="2 4" />
        <Line name={tr(language, "이전 정상 참고 기록", "Previous normal reference", "以前の正常参照記録")} dataKey="reference" stroke="#b5c7d8" strokeDasharray="5 5" dot={false} isAnimationActive={false} />
        <Line name={tr(language, "이번 실행", "Current run", "今回の実行")} dataKey="value" stroke="#8ed0c3" strokeWidth={2.5} dot={false} isAnimationActive={false} />
        {marker !== null && marker <= until ? <ReferenceLine x={marker} stroke="#e5bc79" strokeDasharray="4 4" /> : null}
        {review && until >= 70 ? <ReferenceLine x={70} stroke="#c4aad7" strokeDasharray="2 3" /> : null}
      </LineChart>
    </ResponsiveContainer>
  </div>;
}

export function EvidenceSnapshot({ time, observedUntil, sourceRows, language = "ko" }: { time: number; observedUntil: number; sourceRows?: ReturnType<typeof etchEvidence>; language?: ProductLanguage }) {
  const rows = sourceRows ?? etchEvidence(time, observedUntil);
  return <div className="et-evidence">
    <p><strong>{clock(rows[0].time)} · {tr(language, "단계", "Phase", "段階")} {rows[0].phase}</strong> {tr(language, "의 센서 근거", "sensor evidence", "のセンサー根拠")}</p>
    <div className="et-table" role="region" aria-label={tr(language, "시점별 센서 비교표", "Sensor comparison by time", "時点別センサー比較表")} tabIndex={0}>
      <table>
        <caption>{tr(language, "관측값 표 · 모든 수치는 교육용 상대지수", "Observations · all values are training-only relative indices", "観測値表 · すべて教育用の相対指数")}</caption>
        <thead><tr><th scope="col">{tr(language, "센서", "Sensor", "センサー")}</th><th scope="col">{tr(language, "이번 실행", "Current run", "今回の実行")}</th><th scope="col">{tr(language, "정상 참고", "Normal reference", "正常参照")}</th><th scope="col">{tr(language, "차이", "Difference", "差")}</th><th scope="col">{tr(language, "단계 기준", "Phase range", "段階基準")}</th></tr></thead>
        <tbody>{rows.map(row => <tr key={row.id}>
          <th scope="row">{etchSignalName(language, row.id)}</th><td>{row.value.toFixed(1)}</td><td>{row.reference.toFixed(1)}</td>
          <td>{row.difference > 0 ? "+" : ""}{row.difference.toFixed(1)}</td><td>{row.low}–{row.high}</td>
        </tr>)}</tbody>
      </table>
    </div>
    <p className="et-caption">{tr(language, "차이 = 이번 실행 − 같은 단계·같은 시점의 정상 참고값. 한 시점의 차이만으로 원인이나 고장을 확정하지 마세요.", "Difference = current run − normal reference at the same phase and time. One difference cannot establish a cause or failure.", "差 = 今回の実行 − 同じ段階・同じ時点の正常参照値。一時点の差だけで原因や故障を確定しないでください。")}</p>
  </div>;
}

export default function EtchTraining() {
  const [language, setLanguage] = useProductLanguage();
  const l = (ko: string, en: string, ja: string) => tr(language, ko, en, ja);
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
  useEffect(() => { document.title = l("SemiGuard — 식각 챔버 판단 훈련", "SemiGuard — Etch chamber reasoning training", "SemiGuard — エッチングチャンバー判断訓練"); }, [language]);
  useEffect(() => { heading.current?.focus(); }, [stage]);
  useEffect(() => {
    try { sessionStorage.setItem(ETCH_STORAGE_KEY, JSON.stringify(attempt)); }
    catch { setStorageWarning(l("이 브라우저에서는 임시 저장을 사용할 수 없습니다. 새로고침하면 기록이 사라집니다.", "Temporary storage is unavailable in this browser. Refreshing will erase this attempt.", "このブラウザーでは一時保存できません。更新すると記録が消えます。")); }
  }, [attempt]);
  useEffect(() => {
    if (!running || attempt.submitted || attempt.elapsed >= ETCH_DURATION) return;
    const id = window.setInterval(() => setAttempt(a => ({ ...a, elapsed: Math.min(ETCH_DURATION, a.elapsed + 1) })), 1000);
    return () => window.clearInterval(id);
  }, [running, attempt.submitted, attempt.elapsed >= ETCH_DURATION]);
  useEffect(() => {
    if (!running || attempt.submitted || attempt.elapsed >= ETCH_DURATION) return;
    const pause = () => { if (document.hidden) { setRunning(false); setNotice(l("다른 탭으로 이동해 훈련을 일시정지했습니다. 재개 버튼으로 계속하세요.", "Training paused when you switched tabs. Press Resume to continue.", "別のタブに移動したため訓練を一時停止しました。再開ボタンで続けてください。")); } };
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
    if (attempt.elapsed < ETCH_DURATION || !validEtchAnswer(answer)) { setNotice(l("전체 관찰을 마친 뒤 모든 선택 항목과 두 서술 항목을 10자 이상 작성해 주세요.", "Complete the observation, all choices, and both written answers (at least 10 characters each).", "観察を終え、選択項目すべてと二つの記述項目をそれぞれ10文字以上入力してください。")); return; }
    setAttempt(a => ({ ...a, submitted: true })); move("review");
  };
  return <div className="et-app">
    <a className="et-skip" href="#etch-main">{l("훈련 내용으로 이동", "Skip to training", "訓練内容へ移動")}</a>
    <header className="et-header"><Link className="et-brand" href="/training" onClick={() => move("home")}><b>SG</b> SemiGuard <small>TRAINING LAB</small></Link><nav aria-label={l("제품 메뉴", "Product navigation", "製品メニュー")}><Link href="/learn">{l("8대 공정 학습", "Eight processes", "8大工程の学習")}</Link><Button variant="ghost" onClick={() => move("home")}>{l("선택 화면", "Choose practice", "練習を選ぶ")}</Button><Link href="/live">{l("실시간 자유 분석", "Free observation", "自由観察")}</Link><Link href="/welcome">{l("소개", "Introduction", "紹介")}</Link><ProductLanguageSelect language={language} onChange={setLanguage} /></nav></header>
    <main className="et-main" id="etch-main">
      <div className="et-meta"><span>PLASMA ETCH / SCENARIO 01</span><span>{l("교육용 가상 장비 · 실제 제어 없음", "Synthetic training equipment · no physical control", "教育用仮想装置 · 実際の制御なし")}</span></div>
      <p className="et-storage">{l("이 훈련 기록은 현재 탭에만 임시 저장됩니다. 계정 저장·기기 간 동기화는 아직 지원하지 않습니다.", "Training progress is temporarily stored only in this tab. Account storage and cross-device sync are not available.", "訓練記録は現在のタブにのみ一時保存されます。アカウント保存や端末間の同期には対応していません。")}</p>
      {storageWarning ? <p role="alert" className="et-alert">{storageWarning}</p> : null}
      {stage === "home" ? <><p className="et-eyebrow">STEP 02 / CHOOSE YOUR PRACTICE</p><h1 ref={heading} tabIndex={-1}>{l("연습 방식을 선택하세요.", "Choose how to practice.", "練習方法を選んでください。")}</h1><p className="et-lead">{l("시나리오로 관찰 → 근거 기록 → 판단 → 복기를 따라가거나, 별도의 가상 신호 또는 기록 CSV를 자유롭게 살펴보세요. 실제 장비 연결이나 제어 기능은 없습니다.", "Follow a guided flow—observe, record evidence, decide, and review—or explore a separate synthetic stream or recorded CSV freely. There is no connection to or control of real equipment.", "シナリオで観察→根拠の記録→判断→振り返りを進めるか、別の仮想信号や記録CSVを自由に確認できます。実際の装置への接続・制御機能はありません。")}</p><div className="et-columns">
        <section className="et-panel"><BookOpen aria-hidden="true" /><p className="et-eyebrow">GUIDED TRAINING</p><h2>{l("챔버 A — 이전 실행과 달라진 기록", "Chamber A — a run unlike the previous one", "チャンバーA — 前回と異なる記録")}</h2><p>{l("같은 공정 단계의 기록을 비교하고, 관찰한 사실과 아직 모르는 것을 구분하세요.", "Compare records from the same process phase, and separate observed facts from what remains unknown.", "同じ工程段階の記録を比較し、観察した事実とまだ分からないことを分けましょう。")}</p><div className="et-tags"><span>{l("가상 식각 챔버", "Synthetic etch chamber", "仮想エッチングチャンバー")}</span><span>{l("시나리오 1개", "One scenario", "シナリオ1件")}</span><span>{l("약 5분", "About 5 min", "約5分")}</span></div><Button className="et-primary" onClick={() => move(attempt.submitted ? "review" : attempt.elapsed > 0 ? "observe" : "brief")}>{attempt.submitted ? l("내 복기 보기", "View my review", "振り返りを見る") : attempt.elapsed > 0 ? l("훈련 이어하기", "Continue training", "訓練を続ける") : l("시나리오 시작", "Start scenario", "シナリオを始める")}<ArrowRight /></Button></section>
        <section className="et-panel et-navy"><Activity aria-hidden="true" /><p className="et-eyebrow">FREE OBSERVATION</p><h2>{l("실시간 자유 분석", "Free observation", "自由観察")}</h2><p>{l("가상 식각 챔버의 달라지는 센서 신호를 시간 제한 없이 비교하고 여러 시점의 근거 메모를 남기세요. 시나리오를 먼저 완료하지 않아도 이용할 수 있습니다.", "Compare changing synthetic etch-chamber signals without a time limit and record evidence at multiple points. You can begin without finishing the scenario.", "仮想エッチングチャンバーの変化するセンサー信号を時間制限なしで比較し、複数の時点で根拠メモを残せます。シナリオを先に終える必要はありません。")}</p><p className="et-caption">{l("실행마다 다른 가상 신호이며 Scenario 01의 정답 데이터와 분리됩니다. 실제 팹 장비 연결은 아직 지원하지 않습니다.", "Each run produces different synthetic signals, separate from Scenario 01's answer data. Connecting to real fab equipment is not supported.", "実行ごとに異なる仮想信号で、Scenario 01の正解データとは分離されています。実際の製造装置への接続には対応していません。")}</p><Link className="et-linkbutton" href="/live">{l("자유 관찰 시작", "Start free observation", "自由観察を始める")} <ArrowRight size={18} /></Link></section>
      </div></> : null}
      {stage === "brief" ? <><p className="et-eyebrow">YOUR ASSIGNMENT</p><h1 ref={heading} tabIndex={-1}>{l("챔버 A —", "Chamber A —", "チャンバーA —")}<br />{l("이전 실행과 달라진 기록", "A run unlike the previous one", "前回と異なる記録")}</h1><div className="et-columns"><section className="et-panel"><h2>{l("선임에게 전달할 근거를 정리하세요.", "Prepare evidence to discuss with a senior engineer.", "先輩に伝える根拠を整理しましょう。")}</h2><p>{l("당신은 입사 초기 장비 엔지니어입니다. 이번 실행을 이전 정상 기록과 비교하고 있습니다. 공정 단계가 바뀌면 관측값도 달라질 수 있습니다.", "You are a new equipment engineer comparing this run with a previous normal record. Readings may change when the process phase changes.", "あなたは入社したばかりの装置エンジニアです。今回の実行を以前の正常記録と比較しています。工程段階が変わると観測値も変わることがあります。")}</p><ol><li>{l("장비의 관측 위치와 단계별 기준 이해", "Understand observation points and phase-specific baselines", "装置の観測位置と段階別基準を理解")}</li><li>{l("지속적인 변화와 시작 구간 기록", "Record sustained changes and their onset", "継続する変化と開始区間を記録")}</li><li>{l("관찰 사실과 추가 확인 계획 작성", "Write observed facts and next checks", "観察事実と追加確認計画を作成")}</li></ol><p className="et-caption">{l("180초의 교육용 압축 재생입니다. 실제 공정 시간·운전 레시피를 재현하지 않습니다.", "This is a compressed 180-second teaching run, not a reproduction of real process timing or recipes.", "180秒に圧縮した教育用の再生です。実際の工程時間や運転レシピを再現しません。")}</p></section><aside className="et-panel et-navy"><p className="et-eyebrow">EQUIPMENT CONTEXT</p><h2>{l("어디에서 나온 신호인가요?", "Where do these signals come from?", "信号はどこから来ますか？")}</h2><div className="et-diagram" aria-label={l("교육용 연결 개념도", "Training connection diagram", "教育用接続概念図")}><span>{l("공급 계통", "Supply system", "供給系統")}<br />{l("유량", "Flow", "流量")}</span><span>{l("챔버 A", "Chamber A", "チャンバーA")}<br />{l("압력 · 온도", "Pressure · temperature", "圧力・温度")}</span><span>{l("전력 계통", "Power system", "電力系統")}<br />RF</span></div><p>{l("공개 원리를 바탕으로 구성한 가상 장비입니다. 실제 센서 배치나 특정 제조사 제품을 뜻하지 않습니다.", "This synthetic equipment is based on public concepts, not a real sensor layout or a specific manufacturer's product.", "公開された原理に基づく仮想装置です。実際のセンサー配置や特定メーカーの製品を意味しません。")}</p><p className="et-caption">{l("수치는 모두 상대지수입니다. 단계 A의 가상 기준 중심은 80, 단계 B는 100이며 서로 다른 물리 단위의 절댓값이 아닙니다.", "All values are relative indices. The synthetic baseline centers are 80 in phase A and 100 in phase B; they are not absolute readings in shared physical units.", "数値はすべて相対指数です。仮想基準の中心は段階Aで80、段階Bで100であり、共通の物理単位による絶対値ではありません。")}</p></aside></div><details className="et-panel et-preparation"><summary>{l("훈련 전 빠른 준비 · 익숙하다면 건너뛰세요", "Quick preparation · skip if familiar", "訓練前の簡単な準備 · 慣れていればスキップ")}</summary><p>{l("이 안내는 현재 가상 시나리오의 읽는 법입니다. 실제 장비 운전 교육이나 물리 기준값이 아닙니다.", "This explains how to read this synthetic scenario. It is not real equipment training or a set of physical operating limits.", "この案内は仮想シナリオの読み方です。実際の装置運転教育や物理的な基準値ではありません。")}</p><ul><li>{l("단계가 바뀌면 정상 기준도 달라집니다. 같은 단계의 기록끼리 비교하세요.", "Baselines change with the phase. Compare records from the same phase.", "段階が変わると正常基準も変わります。同じ段階の記録を比較してください。")}</li><li>{l("압력·유량·RF·온도는 서로 다른 관측 항목입니다. 여기서는 교육용 상대지수로 표현하며 물리 단위가 같다는 뜻은 아닙니다.", "Pressure, flow, RF, and temperature are distinct observations. Relative indices here do not imply identical physical units.", "圧力・流量・RF・温度は異なる観測項目です。ここでは教育用の相対指数で示し、物理単位が同じという意味ではありません。")}</li><li>{l("한 점의 차이보다 지속되는 흐름과 같은 시점의 다른 센서를 함께 확인하세요.", "Check sustained trends and other sensors at the same time, not just one point.", "一点の差より、続く傾向と同じ時点の他のセンサーを確認してください。")}</li><li>{l("그래프에 표시한 시점과 답안의 변화 시작 시점은 별도입니다. 과거를 표시했다고 그때 발견한 것은 아닙니다.", "A chart marker and your answer for onset are separate. Marking a past point does not mean you discovered it then.", "グラフに印を付けた時点と回答の変化開始時点は別です。過去に印を付けても、その時点で発見した意味ではありません。")}</li><li>{l("관찰한 사실과 가능한 원인 추정을 나누고, 아직 모르는 정보도 적으세요.", "Separate observations from possible explanations and note what remains unknown.", "観察した事実と考えられる原因を分け、まだ分からない情報も書いてください。")}</li></ul><p>{l("준비가 됐다면 아래 관찰 시작을 누르세요. 이 안내를 읽지 않아도 훈련할 수 있습니다.", "When ready, start observing. Reading this guide is optional.", "準備ができたら観察を始めてください。この案内を読まなくても訓練できます。")}</p></details><div className="et-actions"><Button variant="outline" onClick={() => move("home")}><ArrowLeft />{l("훈련 홈", "Training home", "訓練ホーム")}</Button><Button className="et-primary" onClick={() => { move("observe"); setRunning(true); }}>{l("관찰 시작", "Start observing", "観察を始める")}<ArrowRight /></Button></div></> : null}
      {stage === "brief" ? <EtchEquipmentReference language={language} /> : null}
      {stage === "observe" || stage === "decision" ? <><div className="et-workhead"><div><p className="et-eyebrow">OBSERVE / REASON</p><h1 ref={heading} tabIndex={-1}>{l("챔버 A · 단계", "Chamber A · phase", "チャンバーA · 段階")} {etchPhase(attempt.elapsed)}</h1></div><div className="et-clock"><strong>{clock(attempt.elapsed)}</strong><span>{attempt.elapsed === ETCH_DURATION ? l("관찰 완료", "Observation complete", "観察完了") : isRunning ? l("1초마다 갱신 중", "Updating every second", "1秒ごとに更新中") : l("일시정지", "Paused", "一時停止")}</span></div></div><div className="et-actions"><Button variant="outline" disabled={attempt.elapsed === ETCH_DURATION} onClick={() => setRunning(v => !v)}>{isRunning ? <Pause /> : <Play />}{isRunning ? l("일시정지", "Pause", "一時停止") : l("재개", "Resume", "再開")}</Button><Button className="et-primary" onClick={() => move(stage === "observe" ? "decision" : "observe")}>{stage === "observe" ? l("판단 기록으로", "Record judgment", "判断を記録") : l("실시간 관찰로", "Back to observation", "観察に戻る")}<ArrowRight /></Button></div>
        {stage === "observe" ? <section className="et-monitor"><div className="et-sensors">{etchSignals.map(s => { const p = etchSample(s.id, shownTime); return <button key={s.id} className="et-sensor" aria-pressed={selected === s.id} onClick={() => setSelected(s.id)}><span>{etchSignalName(language, s.id)}</span><strong>{p.value.toFixed(1)} <small>{l("상대지수", "relative index", "相対指数")}</small></strong><span>{l("현재 단계 기준", "Current phase range", "現在の段階基準")} {p.low}–{p.high}</span></button>; })}</div><h2>{etchSignalName(language, signal.id)} · {l("같은 단계 비교", "same-phase comparison", "同じ段階の比較")}</h2><p className="et-caption">{etchSignalLocation(language, signal.id)} · {l("센서 카드를 선택하면 상세 기록이 바뀝니다.", "Select a sensor card to change the detailed record.", "センサーカードを選ぶと詳細記録が変わります。")}</p><SignalChart language={language} signal={selected} until={shownTime} marker={attempt.marker} /><p className="et-caption">{l("실선: 이번 실행 / 점선: 정상 참고 기록 / 녹색 점선: 가상 기준 / 주황선: 내가 표시한 시점", "Solid: current run / dashed: normal reference / green dashed: synthetic range / orange: my marker", "実線：今回の実行／破線：正常参照記録／緑の破線：仮想基準／オレンジ：自分の印")}</p><details><summary>{l("지금까지의 관측값 표로 보기", "View observations so far in a table", "これまでの観測値を表で見る")}</summary><div className="et-table"><table><thead><tr><th>{l("시간", "Time", "時刻")}</th><th>{l("단계", "Phase", "段階")}</th><th>{etchSignalName(language, signal.id)}</th><th>{l("가상 기준", "Synthetic range", "仮想基準")}</th></tr></thead><tbody>{etchSamples(selected, shownTime).filter(p => p.time % 10 === 0 || p.time === shownTime).map(p => <tr key={p.time}><td>{clock(p.time)}</td><td>{p.phase}</td><td>{p.value.toFixed(1)}</td><td>{p.low}–{p.high}</td></tr>)}</tbody></table></div></details><div className="et-marker-picker">
<label htmlFor="etch-marker-time">{l("표시할 시점", "Point to mark", "印を付ける時点")} {clock(inspectedTime)} · {l("관찰한 구간", "Observed interval", "観察した区間")} 00:00–{clock(attempt.elapsed)}</label>
<input id="etch-marker-time" type="range" min={0} max={attempt.elapsed} step={1} disabled={attempt.elapsed === 0} value={inspectedTime} onChange={e => setInspectionTime(Number(e.target.value))} />
<p className="et-caption">{l("슬라이더로 과거 시점을 고른 뒤 표시하세요. 기존 표시 1개를 새 위치로 옮기며, 답안은 바뀌지 않습니다.", "Choose a past point with the slider, then mark it. The single existing marker moves; your answer does not change.", "スライダーで過去の時点を選んで印を付けてください。既存の印を移動するだけで、回答は変わりません。")}</p>
<p>{attempt.marker === null ? l("아직 표시한 시점이 없습니다.", "No point marked yet.", "まだ印を付けた時点はありません。") : `${l("내가 표시한 시점:", "My marker:", "自分の印：")} ${clock(attempt.marker)}`}</p>
</div><div className="et-actions">
<Button className="et-primary" onClick={() => { setAttempt(a => setEtchMarker(a, a.elapsed)); setNotice(`${clock(attempt.elapsed)} · ${l("지금 시점을 기록했습니다.", "Current point marked.", "現在の時点を記録しました。")}`); }}><Flag />{l("지금 발견 기록", "Mark current point", "現在の時点を記録")}</Button>
<Button variant="outline" onClick={() => { setAttempt(a => setEtchMarker(a, inspectedTime)); setNotice(`${clock(inspectedTime)} · ${l("선택한 시점에 표시했습니다.", "Selected point marked.", "選んだ時点に印を付けました。")}`); }}>{l("선택한 시점에 표시", "Mark selected point", "選んだ時点に印を付ける")}</Button>
<Button variant="outline" disabled={attempt.marker === null} onClick={() => { setAttempt(a => setEtchMarker(a, null)); setNotice(l("시점 표시를 취소했습니다.", "Marker removed.", "時点の印を取り消しました。")); }}>{l("표시 취소", "Remove marker", "印を取り消す")}</Button><Button variant="outline" onClick={() => setHint(v => !v)}>{l("판단 도움말", "Reasoning hint", "判断のヒント")}</Button></div>{hint ? <p>{l("사전 작성 코칭: 같은 공정 단계의 기록과 비교했나요? 한 점의 흔들림과 지속적인 추세를 구분해 보세요. AI 생성 답변이 아닙니다.", "Prewritten guidance: Did you compare records in the same phase? Distinguish a one-point fluctuation from a sustained trend. This is not an AI-generated answer.", "事前作成のヒント：同じ工程段階の記録と比較しましたか？一点の変動と続く傾向を分けましょう。AI生成の回答ではありません。")}</p> : null}</section> : <form className="et-panel et-form" onSubmit={e => { e.preventDefault(); submit(); }}>
          <details className="et-inspect" open>
            <summary>{l("답안을 쓰면서 과거 시점 살펴보기", "Review past points while writing", "回答を書きながら過去の時点を見る")}</summary>
            <p className="et-caption">{l("슬라이더로 이미 관찰한 구간을 비교하세요. 살펴보기만으로 답안이 바뀌지는 않습니다.", "Use the slider to compare already-observed points. Reviewing alone does not change your answer.", "スライダーで観察済みの区間を比較してください。見るだけでは回答は変わりません。")}</p>
            <label id="etch-inspection-label">{l("살펴볼 시점", "Point to inspect", "確認する時点")} {clock(inspectedTime)} / {l("관찰한 구간", "Observed interval", "観察した区間")} {clock(attempt.elapsed)}</label>
            <Slider aria-labelledby="etch-inspection-label" min={0} max={Math.max(1, attempt.elapsed)} step={1} disabled={attempt.elapsed === 0} value={[inspectedTime]} onValueChange={([v]) => setInspectionTime(Math.min(v, attempt.elapsed))} />
            <EvidenceSnapshot language={language} time={inspectedTime} observedUntil={attempt.elapsed} />
            <div className="et-actions">
              <Button type="button" variant="outline" onClick={() => setInspectionTime(attempt.elapsed)}>{l("최신 관측 시점 보기", "View latest observation", "最新の観測を見る")}</Button>
              <Button type="button" variant="outline" onClick={() => { update("onset", String(inspectedTime)); setNotice(`${clock(inspectedTime)} ${l("을 변화 시작 시점 답안에 반영했습니다. 발견 기록은 바뀌지 않습니다.", "was set as the onset answer. The marker is unchanged.", "を変化開始時点の回答に反映しました。印は変わりません。")}`); }}>{l("이 시점을 시작 시점 답안에 반영", "Use this point as the onset answer", "この時点を開始時点の回答にする")}</Button>
            </div>
            <p className="et-caption">{attempt.marker === null ? l("그래프에 표시한 시점은 없습니다.", "No chart marker.", "グラフ上の印はありません。") : `${l("내 표시 시점:", "My marker:", "自分の印：")} ${clock(attempt.marker)}`} · {l("표시한 시점과 답안의 변화 시작 시점은 별도로 저장됩니다.", "The marker and onset answer are stored separately.", "印を付けた時点と回答の変化開始時点は別々に保存されます。")}</p>
          </details>
          <fieldset><legend>{l("가장 뚜렷한 변화를 관찰한 항목", "Sensor with the clearest change", "最も明確な変化を観察した項目")}</legend><RadioGroup value={answer.signal} onValueChange={v => update("signal", v)}>{etchSignals.map(s => <label key={s.id}><RadioGroupItem value={s.id} />{etchSignalName(language, s.id)}</label>)}</RadioGroup></fieldset>
          <label>{l("변화가 시작됐다고 판단한 시점 (초)", "When did the change begin? (seconds)", "変化が始まったと判断した時点（秒）")}<input type="number" min={0} max={attempt.elapsed} step={1} required value={answer.onset} onChange={e => update("onset", e.target.value)} /></label><p className="et-caption">{l("발견 버튼을 누른 시간과, 과거 기록에서 선택한 변화 시작 시간은 다릅니다.", "The time you pressed the marker button differs from the onset time selected in past data.", "発見ボタンを押した時刻と、過去の記録で選んだ変化開始時刻は異なります。")}</p>
          <fieldset><legend>{l("어떤 기준과 비교했나요?", "What did you compare against?", "何を基準に比較しましたか？")}</legend><RadioGroup value={answer.comparison} onValueChange={v => update("comparison", v)}><label><RadioGroupItem value="same-phase" />{l("같은 공정 단계의 정상 기록", "Normal record in the same phase", "同じ工程段階の正常記録")}</label><label><RadioGroupItem value="whole-run" />{l("공정 단계와 무관하게 전체 값 비교", "Values across the entire run regardless of phase", "工程段階を問わず全体の値を比較")}</label></RadioGroup></fieldset>
          <fieldset><legend>{l("현재 정보로 특정 고장을 확정할 수 있나요?", "Can this information confirm a specific failure?", "現在の情報で特定の故障を確定できますか？")}</legend><RadioGroup value={answer.certainty} onValueChange={v => update("certainty", v)}><label><RadioGroupItem value="uncertain" />{l("추가 확인이 필요합니다", "More checks are needed", "追加の確認が必要です")}</label><label><RadioGroupItem value="certain" />{l("확정할 수 있습니다", "Yes, it can be confirmed", "確定できます")}</label></RadioGroup></fieldset>
          <label>{l("관찰한 사실과 근거", "Observed facts and evidence", "観察した事実と根拠")}<textarea minLength={10} maxLength={1200} required rows={4} value={answer.facts} onChange={e => update("facts", e.target.value)} /></label><label>{l("아직 모르는 것 · 다음에 확인할 정보와 순서", "Unknowns · information and order for the next checks", "まだ分からないこと・次に確認する情報と順序")}<textarea minLength={10} maxLength={1200} required rows={4} value={answer.checks} onChange={e => update("checks", e.target.value)} /></label><p className="et-caption">{l("각 10–1,200자 · 개인정보·회사 비공개 자료는 입력하지 마세요. 실제 장비 조작을 지시하는 과제가 아닙니다.", "10–1,200 characters each. Do not enter personal or confidential company information. This task does not instruct physical equipment operation.", "各10～1,200字。個人情報や会社の非公開資料を入力しないでください。実際の装置操作を指示する課題ではありません。")}</p><Button className="et-primary" type="submit" disabled={attempt.elapsed < ETCH_DURATION}>{l("판단 제출하고 복기하기", "Submit and review reasoning", "判断を提出して振り返る")}<ArrowRight /></Button>{attempt.elapsed < ETCH_DURATION ? <p>{l("전체 관찰 완료 후 제출할 수 있습니다. 작성 중에도 재생 상태는 상단에서 확인할 수 있습니다.", "Submit after the full observation. The playback status stays visible above while you write.", "観察がすべて終わった後に提出できます。記入中も上部で再生状態を確認できます。")}</p> : null}
        </form>}
      </> : null}
      {stage === "review" && attempt.submitted ? <><p className="et-eyebrow">TIMELINE REVIEW</p><h1 ref={heading} tabIndex={-1}>{l("내 판단을 근거와 비교합니다.", "Compare your reasoning with the evidence.", "自分の判断を根拠と比較します。")}</h1><p>{l("시나리오 기준에 따른 연습 피드백입니다. AI 채점이나 현장 자격 평가가 아닙니다.", "This is practice feedback against scenario criteria, not AI grading or a workplace qualification assessment.", "シナリオ基準による練習フィードバックです。AI採点や現場の資格評価ではありません。")}</p><div className="et-columns"><section className="et-monitor"><h2>{l("압력 변화와 내가 표시한 시점", "Pressure change and my marker", "圧力変化と自分の印")}</h2><SignalChart language={language} signal="pressure" until={reviewTime} marker={attempt.marker} review /><EvidenceSnapshot language={language} time={reviewTime} observedUntil={attempt.elapsed} /><label id="etch-replay-label">{l("복기 재생 위치", "Review position", "振り返り位置")} {clock(reviewTime)}</label><Slider aria-labelledby="etch-replay-label" min={0} max={ETCH_DURATION} step={1} value={[reviewTime]} onValueChange={([v]) => setReviewTime(v)} /><ul><li>00:40 — {l("단계 B로 정상 전환", "Normal transition to phase B", "段階Bへの正常な移行")}</li><li>01:10 — {l("시나리오상 압력 추세 변화 시작", "Scenario pressure trend begins", "シナリオ上の圧力傾向の変化が開始")}</li><li>{attempt.marker === null ? l("표시한 시점 없음", "No point marked", "印を付けた時点なし") : `${clock(attempt.marker)} — ${l("내가 그래프에 표시한 시점", "My chart marker", "グラフに付けた自分の印")}`}</li><li>{clock(Number(answer.onset))} — {l("내가 선택한 변화 시작 시점", "My chosen onset", "自分が選んだ変化開始時点")}</li></ul></section><section className="et-panel">{etchFeedback(answer).map(r => <article className="et-feedback" key={r.title}><span className={r.ok ? "et-good" : "et-revisit"}>{r.ok ? l("기준에 부합", "Matches criteria", "基準に合致") : l("다시 살펴보기", "Review again", "もう一度確認")}</span><h2>{language === "ko" ? r.label : feedbackCopy[language][r.title as keyof typeof feedbackCopy.en][0]}</h2><p>{language === "ko" ? r.detail : feedbackCopy[language][r.title as keyof typeof feedbackCopy.en][1]}</p></article>)}</section></div><section className="et-panel et-report"><h2>{l("내가 작성한 관찰 사실", "My observed facts", "自分が記録した観察事実")}</h2><p>{answer.facts}</p><h2>{l("추가 확인 계획", "Plan for further checks", "追加確認の計画")}</h2><p>{answer.checks}</p><p className="et-caption">{l("서술형의 의미와 확인 순서는 자동 채점하지 않았습니다. 같은 문제의 재도전 결과를 현장 숙련도 향상으로 해석하지 않습니다.", "Written meaning and check order are not graded automatically. Reattempts of the same task do not demonstrate improved workplace proficiency.", "記述内容の意味や確認順序は自動採点していません。同じ問題への再挑戦結果を現場の熟練度向上とは解釈しません。")}</p></section><div className="et-panel et-next"><h2>{l("같은 장비를 자유롭게 다시 관찰하세요.", "Observe the same equipment freely next.", "次は同じ装置を自由に観察しましょう。")}</h2><p>{l("다른 가상 신호로 새 실행을 만들고, 시간 제한 없이 근거 메모를 남길 수 있습니다. 실제 장비 연결은 아닙니다.", "Start a new synthetic run with different signals and record evidence without a time limit. It is not connected to real equipment.", "別の仮想信号で新しい実行を作り、時間制限なしで根拠メモを残せます。実際の装置には接続しません。")}</p><Link href="/live" className="et-linkbutton">{l("실시간 자유 분석으로", "Go to free observation", "自由観察へ")}<ArrowRight size={18} /></Link><Button variant="outline" onClick={() => { setAttempt(emptyEtchAttempt()); setHint(false); setReviewTime(ETCH_DURATION); move("brief"); }}>{l("새 시도로 다시 연습", "Practice again with a new attempt", "新しい試行で再練習")}</Button></div></> : null}
      <p role="status" aria-live="polite" className="et-notice">{notice}</p><footer className="et-footer">{l("공개 원리 기반 가상 식각 챔버 · 실제 팹 성능·교육 효과 미검증", "Synthetic etch chamber based on public concepts · real-fab performance and learning effects unvalidated", "公開原理に基づく仮想エッチングチャンバー · 実際の製造現場での性能・学習効果は未検証")}</footer>
    </main>
  </div>;
}
