import { useEffect, useRef, useState } from "react";
import { TrainingCheckpoint } from "../components/TrainingCheckpoint";
import { TrainingRetry } from "../components/TrainingRetry";
import ProcessEquipmentReference from "../components/ProcessEquipmentReference";
import { toTrainingDraft, restoreTrainingDraft } from "../../../shared/trainingDraft";
import { Link } from "wouter";
import { ArrowLeft, ArrowRight, Flag, Pause, Play } from "lucide-react";
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "../components/ui/button";
import ProductLanguageSelect from "../components/ProductLanguageSelect";
import ScenarioJudgmentCoach from "../components/ScenarioJudgmentCoach";
import { tr, useProductLanguage, type ProductLanguage } from "../lib/productLanguage";
import { trpc } from "../lib/trpc";
import { toProcessTrainingSubmission } from "../../../shared/trainingRecord";
import {
  emptyProcessAttempt, getProcessScenario, processCriteria, processSample, processSamples,
  processScenarios, restoreProcessAttempt, scenarioHref, validProcessAnswer,
  type LocalizedText, type ProcessAnswer, type ProcessAttempt, type ProcessScenario,
} from "../../../shared/processScenarios";
import "./etch-training.css";
import "./process-training.css";

type Stage = "brief" | "observe" | "decision" | "review";
const clock = (time: number) => `${Math.floor(time / 60).toString().padStart(2, "0")}:${(time % 60).toString().padStart(2, "0")}`;
const localize = (text: LocalizedText, language: ProductLanguage) => text[language === "ko" ? 0 : language === "en" ? 1 : 2];

function ProcessChart({ scenario, signalId, until, marker, review, language }: {
  scenario: ProcessScenario; signalId: string; until: number; marker: number | null; review: boolean; language: ProductLanguage;
}) {
  const signal = scenario.signals.find(item => item.id === signalId)!;
  const data = processSamples(scenario, signalId, until);
  return <div className="et-chart pt-chart" role="img" aria-label={tr(language,
    `${localize(signal.name, language)}, ${clock(until)}까지의 교육용 상대지수. 실선은 이번 기록, 점선은 같은 조건의 정상 참고 기록입니다. 아래 표에서 상세 수치를 볼 수 있습니다.`,
    `${localize(signal.name, language)}: training-only relative indices through ${clock(until)}. Solid: current record; dashed: normal reference under the same conditions. Exact values are in the table below.`,
    `${localize(signal.name, language)}、${clock(until)}までの教育用相対指数。実線は今回の記録、破線は同じ条件の正常参照記録です。詳細値は下の表にあります。`)}>
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 12, right: 18, bottom: 12, left: 0 }}>
        <CartesianGrid stroke="#3a4a40" strokeDasharray="3 3" />
        <XAxis dataKey="time" type="number" domain={[0, scenario.duration]} ticks={[0, 30, 60, 90]} tickFormatter={clock} stroke="#b4c1b6" fontSize={12} />
        <YAxis domain={["dataMin - 5", "dataMax + 5"]} stroke="#b4c1b6" fontSize={12} width={42} tickFormatter={value => Number(value).toFixed(0)} />
        <Tooltip labelFormatter={value => clock(Number(value))} contentStyle={{ background: "#18201f", border: "1px solid #657367", color: "#edf0eb" }} formatter={(value: number) => value.toFixed(1)} />
        <Line name={tr(language, "가상 기준 상한", "Synthetic upper range", "仮想基準上限")} dataKey="high" stroke="#657e69" strokeDasharray="2 4" dot={false} isAnimationActive={false} />
        <Line name={tr(language, "가상 기준 하한", "Synthetic lower range", "仮想基準下限")} dataKey="low" stroke="#657e69" strokeDasharray="2 4" dot={false} isAnimationActive={false} />
        <Line name={tr(language, "같은 조건의 정상 참고", "Same-condition normal reference", "同じ条件の正常参照")} dataKey="reference" stroke="#b4c1b6" strokeDasharray="5 5" dot={false} isAnimationActive={false} />
        <Line name={tr(language, "이번 기록", "Current record", "今回の記録")} dataKey="value" stroke="#91cfc2" strokeWidth={2.5} dot={false} isAnimationActive={false} />
        {marker !== null && marker <= until ? <ReferenceLine x={marker} stroke="#e4aa55" strokeDasharray="4 4" /> : null}
        {review && scenario.changeTime !== null && scenario.changeTime <= until ? <ReferenceLine x={scenario.changeTime} stroke="#c4aad7" strokeDasharray="2 3" /> : null}
      </LineChart>
    </ResponsiveContainer>
  </div>;
}

function ProcessSnapshot({ scenario, time, language }: { scenario: ProcessScenario; time: number; language: ProductLanguage }) {
  return <div className="et-evidence">
    <h3>{tr(language, `${clock(time)}의 관측 근거`, `Evidence at ${clock(time)}`, `${clock(time)}の観測根拠`)}</h3>
    <div className="et-table" tabIndex={0} role="region" aria-label={tr(language, "시점별 신호 비교표", "Signal comparison at the selected time", "選択時点の信号比較表")}>
      <table>
        <caption>{tr(language, "모든 수치는 교육용 상대지수입니다. 실제 장비의 운전 범위가 아닙니다.", "All values are training-only relative indices, not real equipment operating limits.", "すべて教育用の相対指数で、実装置の運転範囲ではありません。")}</caption>
        <thead><tr>
          <th scope="col">{tr(language, "신호 / 기록 위치", "Signal / record location", "信号 / 記録位置")}</th>
          <th scope="col">{tr(language, "이번 기록", "Current", "今回")}</th>
          <th scope="col">{tr(language, "정상 참고", "Normal reference", "正常参照")}</th>
          <th scope="col">{tr(language, "차이", "Difference", "差")}</th>
          <th scope="col">{tr(language, "참고 범위", "Reference range", "参照範囲")}</th>
        </tr></thead>
        <tbody>{scenario.signals.map(signal => {
          const sample = processSample(scenario, signal.id, time);
          const difference = sample.value - sample.reference;
          return <tr key={signal.id}><th scope="row">{localize(signal.name, language)}<small className="pt-location">{localize(signal.location, language)}</small></th>
            <td>{sample.value.toFixed(1)}</td><td>{sample.reference.toFixed(1)}</td>
            <td>{difference > 0 ? "+" : ""}{difference.toFixed(1)}</td><td>{sample.low.toFixed(1)}–{sample.high.toFixed(1)}</td>
          </tr>;
        })}</tbody>
      </table>
    </div>
    <p className="et-caption">{localize(scenario.referenceRule, language)}</p>
  </div>;
}

export default function ProcessTraining({ processId }: { processId: string }) {
  const [language, setLanguage] = useProductLanguage();
  const auth = trpc.auth.me.useQuery();
  const scenario = getProcessScenario(processId);
  if (!scenario || scenario.processId === "etch") return <div className="et-app"><main className="et-main">
    <h1>{tr(language, "이 공정 훈련을 찾을 수 없습니다.", "This process exercise was not found.", "この工程訓練が見つかりません。")}</h1>
    <Link className="et-linkbutton" href="/training">{tr(language, "학습·연습 선택으로", "Choose learning and practice", "学習・練習の選択へ")}</Link>
  </main></div>;
  if (auth.isLoading) return <div className="et-app"><main className="et-main"><p role="status">{tr(language, "현재 계정의 훈련 기록을 준비하는 중…", "Preparing this account's exercise…", "現在のアカウントの訓練を準備中…")}</p></main></div>;
  const userId = auth.data?.id ?? null;
  return <ProcessTrainingSession key={`${scenario.id}:${userId ?? "guest"}`} scenario={scenario} userId={userId} language={language} setLanguage={setLanguage} />;
}

function ProcessTrainingSession({ scenario, userId, language, setLanguage }: {
  scenario: ProcessScenario; userId: number | null; language: ProductLanguage; setLanguage: (language: ProductLanguage) => void;
}) {
  const l = (ko: string, en: string, ja: string) => tr(language, ko, en, ja);
  const storageKey = `semiguard.process-training.v1.${scenario.id}.${userId ?? "guest"}`;
  const [initial] = useState(() => {
    try {
      const restored = restoreProcessAttempt(scenario, sessionStorage.getItem(storageKey)) ?? emptyProcessAttempt(scenario);
      return { attempt: restored.submitted && !restored.saveKey ? { ...restored, saveKey: crypto.randomUUID() } : restored, warning: false };
    }
    catch { return { attempt: emptyProcessAttempt(scenario), warning: true }; }
  });
  const [attempt, setAttempt] = useState<ProcessAttempt>(initial.attempt);
  const [storageWarning, setStorageWarning] = useState(initial.warning);
  const [stage, setStage] = useState<Stage>(initial.attempt.submitted ? "review" : initial.attempt.elapsed > 0 ? "observe" : "brief");
  const [running, setRunning] = useState(false);
  const [retryRevision, setRetryRevision] = useState(0);
  const [speed, setSpeed] = useState<1 | 3>(1);
  const [signalId, setSignalId] = useState(scenario.signals[0].id);
  const [inspectionSelection, setInspectionSelection] = useState<number | null>(null);
  const [reviewTime, setReviewTime] = useState(scenario.duration);
  const [coachReviewActive, setCoachReviewActive] = useState(false);
  const reviewHeading = useRef<HTMLHeadingElement>(null);
  const coachReturn = useRef<(() => void) | null>(null);
  const reviewCoachPoint = (time: number, returnToQuestion: () => void) => {
    if (!attempt.submitted || stage !== "review" || !Number.isInteger(time) || time < 0 || time > scenario.duration) return;
    coachReturn.current = returnToQuestion; setReviewTime(time); setCoachReviewActive(true);
    reviewHeading.current?.focus({ preventScroll: true }); reviewHeading.current?.scrollIntoView({ block: "start", behavior: "auto" });
  };
  const [notice, setNotice] = useState("");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "failed">("idle");
  const heading = useRef<HTMLHeadingElement>(null);
  const mounted = useRef(true);
  const currentSaveKey = useRef(attempt.saveKey);
  const pendingSaveKey = useRef<string | undefined>(undefined);
  const saveAttempt = trpc.training.saveAttempt.useMutation();
  const utils = trpc.useUtils();
  const { answer } = attempt;
  const isRunning = running && stage === "observe" && !attempt.submitted && attempt.elapsed < scenario.duration;
  const inspectionTime = Math.min(inspectionSelection ?? attempt.elapsed, attempt.elapsed);
  const shownTime = stage === "review" ? reviewTime : inspectionTime;
  const selectedSignal = scenario.signals.find(signal => signal.id === signalId)!;
  const nextScenario = processScenarios.find(item => item.order === scenario.order + 1);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  useEffect(() => {
    document.title = `${localize(scenario.title, language)} — SemiGuard`;
  }, [scenario.title, language]);
  useEffect(() => { coachReturn.current = null; setCoachReviewActive(false); }, [language, attempt.saveKey]);
  useEffect(() => { heading.current?.focus(); heading.current?.scrollIntoView({ block: "start" }); }, [stage]);
  useEffect(() => {
    try { sessionStorage.setItem(storageKey, JSON.stringify(attempt)); }
    catch { setStorageWarning(true); }
  }, [attempt, storageKey]);
  useEffect(() => {
    if (!isRunning) return;
    const id = window.setInterval(() => setAttempt(current => current.submitted ? current : {
      ...current, elapsed: Math.min(scenario.duration, current.elapsed + speed),
    }), 1000);
    return () => window.clearInterval(id);
  }, [isRunning, scenario.duration, speed]);
  useEffect(() => {
    if (!isRunning) return;
    const pause = () => {
      if (!document.hidden) return;
      setRunning(false);
      setNotice(l("다른 탭으로 이동해 가상 기록 재생을 멈췄습니다. 재개 버튼으로 계속하세요.", "Virtual-record playback paused when you switched tabs. Press Resume to continue.", "別のタブに移動したため仮想記録の再生を停止しました。再開ボタンで続けてください。"));
    };
    document.addEventListener("visibilitychange", pause);
    return () => document.removeEventListener("visibilitychange", pause);
  }, [isRunning, language]);

  const move = (next: Stage) => { setRunning(false); setNotice(""); setStage(next); };
  const update = (field: keyof ProcessAnswer, value: string) => setAttempt(current => current.submitted ? current : {
    ...current, answer: { ...current.answer, [field]: value },
  });
  const changeSignal = (value: string) => setAttempt(current => current.submitted ? current : {
    ...current, answer: { ...current.answer, signal: value, onset: value === "none" ? "none" : current.answer.onset === "none" ? "" : current.answer.onset },
  });
  const mark = () => setAttempt(current => current.submitted ? current : {
    ...current, marker: current.marker === inspectionTime ? null : inspectionTime,
  });
  const saveCompleted = async (completed: ProcessAttempt) => {
    if (!userId || !completed.saveKey || pendingSaveKey.current === completed.saveKey) return;
    const key = completed.saveKey;
    pendingSaveKey.current = key;
    setSaveStatus("saving");
    try {
      await saveAttempt.mutateAsync({ attemptKey: key, attempt: toProcessTrainingSubmission(completed) });
      if (!mounted.current || currentSaveKey.current !== key) return;
      setSaveStatus("saved");
      void utils.training.history.invalidate();
      void utils.training.progress.invalidate();
    } catch {
      if (mounted.current && currentSaveKey.current === key) setSaveStatus("failed");
    } finally { if (pendingSaveKey.current === key) pendingSaveKey.current = undefined; }
  };
  const submit = () => {
    if (attempt.submitted || attempt.elapsed !== scenario.duration || !validProcessAnswer(scenario, answer)) {
      setNotice(l("전체 기록을 관찰하고 모든 선택과 두 서술형 답안을 완성하세요.", "Observe the complete record and finish every choice and both written answers.", "記録全体を観察し、すべての選択と二つの記述回答を完成させてください。"));
      return;
    }
    const completed = { ...attempt, submitted: true, saveKey: crypto.randomUUID() };
    currentSaveKey.current = completed.saveKey;
    setAttempt(completed); setReviewTime(scenario.duration); move("review");
    if (userId) void saveCompleted(completed);
  };
  const reset = () => {
    if (saveStatus === "saving") return;
    currentSaveKey.current = undefined;
    setAttempt(emptyProcessAttempt(scenario)); setRunning(false); setSpeed(1); setInspectionSelection(null);
    setSignalId(scenario.signals[0].id); setReviewTime(scenario.duration); setSaveStatus("idle"); move("brief"); heading.current?.focus();
  };
  const choicesReady = validProcessAnswer(scenario, answer);
  const matched = attempt.submitted ? processCriteria(scenario, answer) : null;
  const expectedSignalName = scenario.expectedSignal === "none"
    ? l("정상 참고와의 편차를 확인하지 못함", "No deviation established against the normal reference", "正常参照からの偏差は確認できない")
    : localize(scenario.signals.find(signal => signal.id === scenario.expectedSignal)!.name, language);

  return <div className="et-app pt-app">
    <a className="et-skip" href="#process-main">{l("본문으로 건너뛰기", "Skip to content", "本文へスキップ")}</a>
    <header className="et-header"><Link className="et-brand" href="/training"><b>SG</b> SemiGuard <small>JUDGMENT TRAINING</small></Link>
      <nav aria-label={l("제품 메뉴", "Product navigation", "製品メニュー")}>
        <Link href="/training">{l("학습·연습 선택", "Choose practice", "練習を選ぶ")}</Link>
        <Link href="/learn">{l("8대 공정 학습", "Process learning", "8大工程学習")}</Link>
        <Link href="/live">{l("자유 분석", "Free analysis", "自由分析")}</Link>
        <ProductLanguageSelect language={language} onChange={setLanguage} />
      </nav>
    </header>
    <main id="process-main" className="et-main">
      <div className="et-meta"><span>PROCESS {String(scenario.order).padStart(2, "0")} / 08</span><span>{l("교육용 가상 기록 · 장비 제어 없음", "Synthetic learning records · no equipment control", "教育用仮想記録 · 装置制御なし")}</span></div>
      <h1 tabIndex={-1} ref={heading}>{localize(scenario.title, language)}</h1>
      <ol className="pt-steps" aria-label={l("훈련 단계", "Exercise steps", "訓練の段階")}>
        {([["brief", l("장비·상황", "Briefing", "装置・状況")], ["observe", l("관찰", "Observe", "観察")], ["decision", l("판단 기록", "Reasoning", "判断記録")], ["review", l("복기", "Review", "振り返り")]] as const).map(([key, label], index) => <li key={key} aria-current={stage === key ? "step" : undefined}><span>{index + 1}</span>{label}</li>)}
      </ol>
      <p className="et-caption">{l("이 과정은 학습 순서입니다. 실제 반도체 제조에서는 공정이 여러 번 반복됩니다.", "This is a learning sequence. Real semiconductor manufacturing repeats processes many times.", "これは学習の順序です。実際の半導体製造では工程を何度も繰り返します。")}</p>
      {storageWarning ? <p className="et-alert" role="status">{l("이 브라우저에서 임시 저장을 사용할 수 없습니다. 새로고침하면 미제출 답안이 사라질 수 있습니다.", "Temporary browser storage is unavailable. Refreshing may erase this draft.", "このブラウザーでは一時保存を使えません。更新すると未提出の回答が消える場合があります。")}</p> : null}
      <p className="et-notice" role="status" aria-live="polite">{notice}</p>
      <TrainingCheckpoint userId={userId} language={language} scenarioId={scenario.id} resumeOnly={attempt.submitted} disabled={saveStatus === "saving"}
        capture={() => toTrainingDraft(scenario.id, attempt, stage as "brief" | "observe" | "decision")}
        restore={draft => { currentSaveKey.current = undefined; setRetryRevision(revision => revision + 1); setRunning(false); setAttempt(restoreTrainingDraft(draft)); setInspectionSelection(null); setSaveStatus("idle"); move(draft.stage); }} />

      <TrainingRetry key={`${storageKey}:${attempt.saveKey ?? "draft"}:${retryRevision}`} language={language}
        hasWork={attempt.elapsed > 0 || attempt.marker !== null || attempt.submitted || Object.values(answer).some(value => value.trim().length > 0)}
        disabled={saveStatus === "saving"} onPause={() => setRunning(false)} onRestart={reset} />

      {stage === "brief" ? <>
        <div className="et-columns"><section className="et-panel">
          <p className="et-eyebrow">EQUIPMENT / CONTEXT</p><h2>{localize(scenario.equipment, language)}</h2><p>{localize(scenario.briefing, language)}</p>
          <h3>{l("이번 훈련에서 연습할 판단", "The reasoning to practise", "今回練習する判断")}</h3><p>{localize(scenario.objective, language)}</p>
          <p className="et-caption">{localize(scenario.referenceRule, language)}</p>
          <div className="et-actions"><Button className="et-primary" onClick={() => { move("observe"); setRunning(attempt.elapsed < scenario.duration); }}>{attempt.elapsed > 0 ? l("관찰 이어가기", "Continue observing", "観察を続ける") : l("가상 기록 관찰 시작", "Start observing virtual records", "仮想記録の観察を始める")} <ArrowRight size={16} /></Button></div>
        </section><section className="et-panel et-navy"><p className="et-eyebrow">READ THE SIGNALS</p><h2>{l("서로 다른 기록을 함께 봅니다.", "Compare different records together.", "異なる記録を一緒に確認します。")}</h2>
          <ul className="pt-signal-list">{scenario.signals.map(signal => <li key={signal.id}><strong>{localize(signal.name, language)}</strong><span>{localize(signal.location, language)}</span></li>)}</ul>
          <p>{l("이번 기록과 같은 조건의 정상 참고를 비교하세요. 값이 바뀌었다는 사실과 고장이라는 추정은 다릅니다. 정상 참고와의 편차가 없는 기록도 있습니다.", "Compare the current record with a same-condition normal reference. A changing value is not itself a confirmed fault. Some records have no deviation from the normal reference.", "今回の記録と同じ条件の正常参照を比較してください。値の変化と故障の推測は異なります。正常参照からの偏差がない記録もあります。")}</p>
          <p className="et-caption">{l("90초 가상 타임라인 · 재생 속도 1배/3배 선택 · 재생·일시정지 가능", "90-second virtual timeline · 1× / 3× playback · pause and resume", "90秒の仮想タイムライン · 1倍 / 3倍再生 · 一時停止・再開可能")}</p>
        </section></div>
        <ProcessEquipmentReference processId={scenario.processId} language={language} />
        <details className="et-panel pt-reference"><summary>{l("실제 공정과 연결되는 공개 자료", "Public references for the real process", "実際の工程につながる公開資料")}</summary>
          <p>{l("아래 자료는 공정 개념을 이해하기 위한 출처입니다. 이 훈련은 제조사 데이터나 실제 장비 모델의 성능을 재현하지 않습니다.", "The source below explains the process concept. This exercise does not reproduce manufacturer data or the performance of a real equipment model.", "以下は工程の概念を理解するための資料です。この訓練はメーカーのデータや実装置モデルの性能を再現しません。")}</p>
          <a href={scenario.referenceUrl} target="_blank" rel="noopener noreferrer">{localize(scenario.referenceTitle, language)} ↗</a>
        </details>
      </> : null}

      {stage === "observe" || stage === "review" ? <section className="et-monitor">
        <div className="et-workhead"><div><p className="et-eyebrow">{stage === "review" ? "TIMELINE REVIEW" : "VIRTUAL RECORD OBSERVATION"}</p><h2 ref={reviewHeading} tabIndex={stage === "review" ? -1 : undefined}>{localize(selectedSignal.name, language)}</h2></div>
          <div className="et-clock"><strong>{clock(shownTime)}</strong><span>{l("가상 경과", "Virtual elapsed", "仮想経過")} / {clock(scenario.duration)}</span></div></div>
        <div className="et-sensors pt-sensors">{scenario.signals.map(signal => {
          const sample = processSample(scenario, signal.id, shownTime);
          return <button type="button" className="et-sensor" key={signal.id} aria-pressed={signal.id === signalId} onClick={() => setSignalId(signal.id)}>
            <span>{localize(signal.name, language)}</span><strong>{sample.value.toFixed(1)} <small>{l("상대지수", "relative index", "相対指数")}</small></strong>
            <small>{l("정상 참고", "Normal reference", "正常参照")} {sample.reference.toFixed(1)}</small>
          </button>;
        })}</div>
        <ProcessChart scenario={scenario} signalId={signalId} until={stage === "review" ? shownTime : attempt.elapsed} marker={attempt.marker} review={stage === "review"} language={language} />
        <p className="et-caption">{l("실선: 이번 기록 · 점선: 정상 참고 · 가는 점선: 참고 범위 · 노랑: 내 발견 기록", "Solid: current record · dashed: normal reference · fine dashed: reference range · amber: your marker", "実線：今回の記録 · 破線：正常参照 · 細い破線：参照範囲 · 黄：自分の発見記録")}</p>
        {stage === "observe" ? <>
          <div className="et-actions"><Button className="et-primary" disabled={attempt.elapsed >= scenario.duration} onClick={() => { setRunning(current => !current); setInspectionSelection(null); setNotice(""); }}>{isRunning ? <Pause size={16} /> : <Play size={16} />}{isRunning ? l("일시정지", "Pause", "一時停止") : attempt.elapsed > 0 ? l("재개", "Resume", "再開") : l("재생", "Play", "再生")}</Button>
            <label className="pt-speed">{l("가상 기록 재생 속도", "Virtual-record playback speed", "仮想記録の再生速度")}<select value={speed} onChange={event => setSpeed(event.target.value === "3" ? 3 : 1)}><option value="1">1×</option><option value="3">3×</option></select></label>
          </div><p className="et-caption">{l("3배는 교육용 기록을 빠르게 재생합니다. 실제 설비의 실시간 수집 속도를 의미하지 않습니다.", "3× speeds up teaching-record playback; it is not a real equipment sampling rate.", "3倍は教育用記録の高速再生で、実装置のリアルタイム収集速度ではありません。")}</p>
          <div className="et-marker-picker">
            <label htmlFor="process-inspection-time">{l("이미 관측한 시점 선택", "Select an observed time", "観測済みの時点を選ぶ")} · {clock(inspectionTime)}</label>
            <input id="process-inspection-time" type="range" min={0} max={attempt.elapsed} step={1} value={inspectionTime} onChange={event => setInspectionSelection(Number(event.target.value))} />
            <label htmlFor="process-inspection-seconds">{l("시점 직접 입력 (초)", "Enter a time (seconds)", "時点を直接入力（秒）")}</label>
            <input id="process-inspection-seconds" type="number" min={0} max={attempt.elapsed} step={1} value={inspectionTime} onChange={event => { const value = Number(event.target.value); if (Number.isInteger(value) && value >= 0 && value <= attempt.elapsed) setInspectionSelection(value); }} />
            <div className="et-actions"><Button onClick={mark}><Flag size={16} />{attempt.marker === inspectionTime ? l("이 시점의 기록 취소", "Remove this time marker", "この時点の記録を取り消す") : l("선택한 시점에 변화 발견 기록", "Mark a change at this selected time", "選択した時点に変化の発見を記録")}</Button>
              <Button onClick={() => setInspectionSelection(null)}>{l("현재 관측 시점 따라가기", "Follow the current observed time", "現在の観測時点に戻る")}</Button>
              {attempt.marker !== null ? <Button onClick={() => setAttempt(current => ({ ...current, marker: null }))}>{l("발견 기록 지우기", "Clear discovery marker", "発見記録を消す")}</Button> : null}
            </div><p>{attempt.marker === null ? l("발견 기록은 아직 없습니다. 이상이 확인되지 않았다면 억지로 표시하지 않아도 됩니다.", "No discovery marker yet. You do not have to mark an anomaly you cannot establish.", "発見記録はまだありません。異常を確認できなければ、無理に印を付ける必要はありません。") : l(`내 발견 기록: ${clock(attempt.marker)}. 다른 시점을 기록하면 교체하고, 같은 버튼을 다시 누르면 취소합니다.`, `Your discovery marker: ${clock(attempt.marker)}. Marking another time replaces it; pressing the same button removes it.`, `自分の発見記録：${clock(attempt.marker)}。別の時点を記録すると置き換え、同じボタンを再度押すと取り消します。`)}</p>
            <p className="et-caption">{l("표시는 내가 선택한 가상 기록의 시점입니다. 실제로 그 순간에 발견했다는 뜻이나 발견 속도 평가가 아닙니다.", "This marker represents a virtual-record time you selected, not when you actually discovered it or a discovery-speed assessment.", "この印は選択した仮想記録の時点です。その瞬間に実際に発見したという意味や、発見速度の評価ではありません。")}</p>
          </div>
        </> : <div className="et-marker-picker"><label htmlFor="process-review-time">{l("복기할 시점", "Review time", "振り返る時点")} · {clock(reviewTime)}</label><input id="process-review-time" type="range" min={0} max={scenario.duration} step={1} value={reviewTime} onChange={event => setReviewTime(Number(event.target.value))} /></div>}
        <ProcessSnapshot scenario={scenario} time={shownTime} language={language} />
        {stage === "review" && coachReviewActive ? <Button variant="outline" onClick={() => coachReturn.current?.()}>{l("읽던 AI 질문으로 돌아가기", "Return to the AI question", "読んでいたAIの問いに戻る")}</Button> : null}
        {stage === "observe" ? <div className="et-actions"><Button onClick={() => move("brief")}><ArrowLeft size={16} />{l("상황 다시 보기", "Revisit briefing", "状況を再確認")}</Button><Button className="et-primary" onClick={() => move("decision")}>{l("내 판단 작성하기", "Write your reasoning", "自分の判断を記録")} <ArrowRight size={16} /></Button></div> : null}
      </section> : null}

      {stage === "decision" ? <section className="et-panel pt-decision"><h2>{l("관찰한 사실과 추정을 구분해 기록합니다.", "Record observations separately from inference.", "観察事実と推測を分けて記録します。")}</h2>
        <p>{l("이 답안의 다음 확인은 제공된 가상 기록을 비교하는 순서입니다. 장비를 조작하거나 실제 측정·정비를 하는 계획을 작성하지 마세요.", "Your next steps should compare the supplied virtual records. Do not propose equipment operation, new physical measurements, or maintenance.", "次の確認は提供された仮想記録を比較する順序です。装置操作、実測、整備の計画は記入しないでください。")}</p>
        <form className="et-form pt-form" onSubmit={event => { event.preventDefault(); submit(); }}>
          <fieldset><legend>{l("1. 정상 참고와 비교할 때 가장 주목한 항목", "1. What stood out against the normal reference?", "1. 正常参照と比べて最も注目した項目")}</legend>
            {scenario.signals.map(signal => <label key={signal.id}><input type="radio" name="process-signal" checked={answer.signal === signal.id} value={signal.id} onChange={() => changeSignal(signal.id)} />{localize(signal.name, language)}</label>)}
            <label><input type="radio" name="process-signal" checked={answer.signal === "none"} value="none" onChange={() => changeSignal("none")} />{l("정상 참고와의 편차를 확인하지 못함", "No deviation established against the normal reference", "正常参照からの偏差は確認できない")}</label>
          </fieldset>
          <label htmlFor="process-onset">{l("2. 내가 판단한 정상 참고와의 편차 시작 (초)", "2. Your estimated onset of deviation from the normal reference (seconds)", "2. 判断した正常参照からの偏差開始（秒）")}</label>
          {answer.signal === "none" ? <p className="pt-no-onset">{l("‘편차를 확인하지 못함’ 선택에 따라 시작 시점은 ‘없음’으로 기록됩니다.", "With no deviation established, onset is recorded as none.", "偏差を確認できないを選んだため、開始時点は「なし」で記録します。")}</p> : <input id="process-onset" type="number" min={0} max={attempt.elapsed} step={1} value={answer.onset} onChange={event => { const value = event.target.value; if (!value || (/^(0|[1-9]\d{0,2})$/.test(value) && Number(value) <= attempt.elapsed)) update("onset", value); }} required />}
          <p className="et-caption">{l("범위 경계를 넘은 시점과 추세가 시작된 시점은 다를 수 있습니다. 발견 기록은 별도 표시이며 이 답을 자동으로 대신하지 않습니다.", "The start of a trend can differ from crossing a range boundary. The discovery marker is separate and does not automatically answer this field.", "範囲境界を越える時点と傾向の開始は異なる場合があります。発見記録は別の印で、この回答を自動入力しません。")}</p>
          <fieldset><legend>{l("3. 비교 기준", "3. Comparison reference", "3. 比較基準")}</legend>
            <label><input type="radio" name="process-comparison" checked={answer.comparison === "same-condition"} onChange={() => update("comparison", "same-condition")} />{l("같은 조건·같은 위치·같은 진행 시점의 정상 참고", "Normal reference at the same conditions, location and progress point", "同じ条件・位置・進行時点の正常参照")}</label>
            <label><input type="radio" name="process-comparison" checked={answer.comparison === "whole-run"} onChange={() => update("comparison", "whole-run")} />{l("조건 구분 없이 전체 기록의 평균만 비교", "Only the whole-record average, regardless of conditions", "条件を区別せず記録全体の平均だけを比較")}</label>
          </fieldset>
          <fieldset><legend>{l("4. 지금 자료로 원인을 확정할 수 있나요?", "4. Can these records establish a specific cause?", "4. この資料で原因を確定できますか？")}</legend>
            <label><input type="radio" name="process-certainty" checked={answer.certainty === "uncertain"} onChange={() => update("certainty", "uncertain")} />{l("관찰한 내용과 가능한 원인을 구분해야 함", "Observed facts must remain separate from possible causes", "観察事実と可能性のある原因を区別する必要がある")}</label>
            <label><input type="radio" name="process-certainty" checked={answer.certainty === "certain"} onChange={() => update("certainty", "certain")} />{l("이 자료만으로 특정 원인을 확정할 수 있음", "These records alone confirm a specific cause", "この資料だけで特定の原因を確定できる")}</label>
          </fieldset>
          <label htmlFor="process-facts">{l("5. 관찰한 사실과 아직 확정할 수 없는 내용", "5. Observed facts and what remains uncertain", "5. 観察事実とまだ確定できないこと")}</label>
          <textarea id="process-facts" rows={5} minLength={10} maxLength={1200} required value={answer.facts} onChange={event => update("facts", event.target.value)} aria-describedby="process-writing-note" />
          <span className="et-caption">{answer.facts.trim().length} / 1200 · {l("10자 이상", "at least 10 characters", "10文字以上")}</span>
          <label htmlFor="process-checks">{l("6. 제공된 가상 기록에서 다음으로 비교할 순서와 이유", "6. Next comparisons within the supplied virtual records, and why", "6. 提供された仮想記録で次に比較する順序と理由")}</label>
          <textarea id="process-checks" rows={5} minLength={10} maxLength={1200} required value={answer.checks} onChange={event => update("checks", event.target.value)} aria-describedby="process-writing-note" />
          <span className="et-caption">{answer.checks.trim().length} / 1200 · {l("10자 이상", "at least 10 characters", "10文字以上")}</span>
          <p className="et-caption" id="process-writing-note">{l("서술형 원문은 현재 브라우저 탭에만 임시 저장합니다. 계정 학습 DB에는 선택형 결과만 저장하며, AI에 보내려면 제출 후 별도 동의가 필요합니다. 개인정보·회사 자료를 입력하지 마세요.", "Written answers are kept temporarily in this browser tab only. The learning database stores choice results only; sending text to AI requires separate consent after submission. Do not enter personal or company information.", "記述回答は現在のブラウザータブにのみ一時保存します。学習DBには選択結果のみを保存し、AI送信には提出後の別途同意が必要です。個人情報や会社資料を入力しないでください。")}</p>
          {attempt.elapsed < scenario.duration ? <p className="et-alert">{l(`아직 ${clock(attempt.elapsed)}까지만 관찰했습니다. ${clock(scenario.duration)}까지 관찰한 뒤 제출할 수 있습니다.`, `You have observed through ${clock(attempt.elapsed)}. Finish the ${clock(scenario.duration)} record before submitting.`, `まだ${clock(attempt.elapsed)}までの観察です。${clock(scenario.duration)}まで観察してから提出できます。`)}</p> : null}
          <div className="et-actions"><Button type="button" onClick={() => move("observe")}><ArrowLeft size={16} />{l("관측 기록 다시 보기", "Return to observations", "観測記録に戻る")}</Button><Button className="et-primary" type="submit" disabled={attempt.elapsed !== scenario.duration || !choicesReady}>{l("판단 제출 · 타임라인 복기", "Submit reasoning · review timeline", "判断を提出 · タイムラインを振り返る")}</Button></div>
        </form>
      </section> : null}

      {stage === "review" && matched ? <>
        <section className="et-panel pt-timeline"><p className="et-eyebrow">WHAT THE VIRTUAL SCENARIO CONTAINS</p><h2>{l("기록의 변화와 내 판단을 나란히 봅니다.", "Compare the record with your reasoning.", "記録の変化と自分の判断を並べて確認します。")}</h2>
          <ul>{scenario.events.map((event, index) => <li key={`${event.time}:${index}`}><button type="button" onClick={() => setReviewTime(event.time)}><time>{clock(event.time)}</time>{localize(event.label, language)}</button></li>)}</ul>
          <p>{l("내 발견 기록", "Your discovery marker", "自分の発見記録")}: {attempt.marker === null ? l("없음", "none", "なし") : clock(attempt.marker)} · {l("내 시작 시점 판단", "Your estimated onset", "自分の開始時点の判断")}: {answer.onset === "none" ? l("없음", "none", "なし") : clock(Number(answer.onset))}</p>
          <p className="et-caption">{l("보라색 선은 시나리오가 구성한 편차의 시작입니다. 편차가 없는 경우에는 표시하지 않습니다. 이 구성 기준은 실제 설비의 고장 기준이 아닙니다. 내 표시는 내가 선택한 가상 시점이며 발견 속도 평가가 아닙니다.", "The purple line marks the designed deviation onset, if present, not a real equipment fault limit. Your marker is a selected virtual time, not a discovery-speed assessment.", "紫の線はシナリオで構成した偏差の開始で、実装置の故障基準ではありません。自分の印は選択した仮想時点で、発見速度の評価ではありません。")}</p>
        </section>
        <section className="et-panel et-report"><h2>{l("선택형 기준으로 돌아보기", "Review against choice criteria", "選択基準で振り返る")}</h2>
          <p>{l("다음 표시는 이 가상 시나리오의 선택형 기준과 일치했는지만 보여줍니다. 전문성·안전 자격·실제 현장 판단 능력을 평가하지 않으며 서술형 답안을 자동 채점하지 않습니다.", "These checks show agreement with this synthetic scenario's choice criteria only. They do not assess expertise, safety qualifications or workplace ability, and do not grade written answers.", "以下はこの仮想シナリオの選択基準との一致だけを示します。専門性、安全資格、現場の判断能力は評価せず、記述回答を自動採点しません。")}</p>
          {([
            ["signalMatched", l("주목한 항목", "Main item", "注目した項目"), l(`구성 기준: ${expectedSignalName}. 다른 기록을 함께 보고 추정과 구분하세요.`, `Teaching criterion: ${expectedSignalName}. Compare the other records and separate inference.`, `構成基準：${expectedSignalName}。他の記録も比較し、推測と区別してください。`)],
            ["onsetMatched", l("변화 시작 판단", "Onset reasoning", "変化開始の判断"), scenario.changeTime === null ? l("이 기록에는 정상 참고와의 편차 시작을 지정하지 않았습니다. 정상 변화가 있다는 이유로 이상 시점을 만들지 않습니다.", "This record has no designed deviation from the normal reference. A normal change does not require inventing an anomaly onset.", "この記録には正常参照からの偏差開始を設定していません。正常な変化を理由に異常の開始を作る必要はありません。") : l(`구성상 편차는 ${clock(scenario.changeTime)}부터 시작합니다. 짧은 편차, 반복되는 편차, 추세 변화를 함께 구분해 보세요.`, `The designed deviation starts at ${clock(scenario.changeTime)}. Distinguish brief differences, repeated differences and trend changes.`, `構成上、偏差は${clock(scenario.changeTime)}から始まります。短い偏差、繰り返す偏差、傾向の変化を区別してください。`)],
            ["comparisonMatched", l("같은 조건의 정상 참고", "Same-condition reference", "同じ条件の正常参照"), localize(scenario.referenceRule, language)],
            ["certaintyMatched", l("사실과 원인 추정 구분", "Facts versus cause inference", "事実と原因の推測を区別"), l("관측한 편차는 기록의 사실입니다. 이 자료만으로 실제 장비 고장이나 특정 원인을 확정하거나 배제할 수 없습니다.", "An observed deviation is a fact about the record. These records cannot confirm or exclude a real equipment fault or specific cause.", "観測した偏差は記録上の事実です。この資料だけで実装置の故障や特定原因を確定、または除外できません。")],
          ] as const).map(([key, label, description]) => <article className="et-feedback" key={key}><span className={matched[key] ? "et-good" : "et-revisit"}>{matched[key] ? l("구성 기준과 일치", "Matches teaching criteria", "構成基準と一致") : l("다시 비교해 보기", "Compare again", "再度比較する")}</span><h3>{label}</h3><p>{description}</p></article>)}
          <h3>{l("내가 작성한 사실과 추정", "Your observations and inference", "記入した事実と推測")}</h3><p>{answer.facts}</p>
          <h3>{l("내가 선택한 다음 비교 순서", "Your next record comparisons", "選択した次の比較順序")}</h3><p>{answer.checks}</p>
        </section>
        <section className="et-panel et-save-status" aria-live="polite"><h2>{l("개인 학습 기록", "Personal learning record", "個人学習記録")}</h2>
          {!userId ? <p>{l("현재 답안은 이 브라우저 탭에만 임시 보관됩니다. 로그인한 뒤 새 훈련을 제출하면 선택형 결과가 계정별로 저장됩니다.", "This answer remains in this browser tab only. Sign in and submit a new attempt to save its choice results to your account.", "現在の回答はこのブラウザータブにのみ一時保存します。ログイン後に新しい訓練を提出すると、選択結果をアカウント別に保存します。")}</p>
            : saveStatus === "saved" ? <p>{l("이 계정에 선택형 훈련 결과를 저장했습니다. 서술형 원문은 학습 DB에 저장하지 않았습니다.", "Choice results were saved to this account. Written answers were not saved to the learning database.", "このアカウントに選択式の訓練結果を保存しました。記述回答は学習DBに保存していません。")}</p>
            : saveStatus === "saving" ? <p role="status">{l("선택형 결과 저장 중…", "Saving choice results…", "選択結果を保存中…")}</p>
            : <><p className={saveStatus === "failed" ? "et-alert" : "et-caption"}>{saveStatus === "failed" ? l("계정 저장에 실패했습니다. 답안과 복기는 그대로 유지되며 같은 시도의 저장을 다시 요청할 수 있습니다.", "Account saving failed. Your answer and review remain available; retry saves the same attempt.", "アカウント保存に失敗しました。回答と振り返りは維持され、同じ試行の保存を再依頼できます。") : l("복원된 답안의 계정 저장 여부는 아직 확인하지 않았습니다. 저장 버튼은 동일한 시도를 중복 생성하지 않습니다.", "The account-save status of this restored answer has not been checked. Saving does not duplicate this attempt.", "復元した回答のアカウント保存状態はまだ確認していません。保存ボタンは同じ試行を重複作成しません。")}</p><Button onClick={() => void saveCompleted(attempt)}>{l("이 시도 저장 다시 요청", "Save this attempt again", "この試行の保存を再依頼")}</Button></>}
        </section>
        <ScenarioJudgmentCoach key={`${scenario.id}:${userId ?? "guest"}:${attempt.saveKey}:${language}`} processAttempt={attempt} scenario={scenario} language={language} userId={userId} onReviewPoint={reviewCoachPoint} />
        <section className="et-panel et-next"><h2>{l("다음 판단으로 연결합니다.", "Continue to the next reasoning task.", "次の判断につなげます。")}</h2><p>{l("공정은 순서대로 배울 수 있지만 어느 훈련이든 직접 선택할 수 있습니다. 모든 단계가 이상 신호를 포함하는 것은 아닙니다.", "Follow the learning order or choose any exercise directly. Not every stage contains an anomaly.", "工程を順に学ぶことも、どの訓練でも直接選ぶこともできます。すべての段階に異常があるわけではありません。")}</p>
          <div className="et-actions">{nextScenario ? <Link className="et-linkbutton" href={scenarioHref(nextScenario)}>{l("다음 공정", "Next process", "次の工程")} · {localize(nextScenario.title, language)} <ArrowRight size={16} /></Link> : <Link className="et-linkbutton" href="/live">{l("8대 공정 이후 자유 분석으로", "Continue with free analysis", "8大工程の後は自由分析へ")} <ArrowRight size={16} /></Link>}
            <Link className="et-inline-link" href="/training">{l("다른 학습·연습 선택", "Choose another exercise", "別の学習・練習を選ぶ")}</Link>
          </div>
        </section>
      </> : null}
      <footer className="et-footer">{l("교육용 가상 데이터입니다. 특정 제조사의 실제 장비 데이터·운전 기준·검증된 팹 성능을 의미하지 않습니다. 실제 설비에 명령을 보내지 않습니다.", "Educational synthetic data, not manufacturer equipment data, operating limits or validated fab performance. No commands are sent to real equipment.", "教育用の仮想データであり、特定メーカーの実装置データ、運転基準、検証済みのファブ性能を意味しません。実装置に指令を送信しません。")}</footer>
    </main>
  </div>;
}
