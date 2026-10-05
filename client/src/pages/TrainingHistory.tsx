import React, { useEffect, useRef, useState } from "react";
import { trainingPracticeHref, trainingReplay } from "../../../shared/trainingReplay";
import { Link } from "wouter";
import { Line, LineChart, ReferenceLine, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { getProcessScenario, processSample } from "../../../shared/processScenarios";
import { etchSample, etchSignals } from "../../../shared/etchScenario";
import { tr, useProductLanguage } from "../lib/productLanguage";
import { etchSignalName } from "../lib/etchLanguage";
import { trpc } from "../lib/trpc";
import ProductLanguageSelect from "../components/ProductLanguageSelect";
import TrainingShareControls from "../components/TrainingShareControls";
import ProcessEvidenceReview, { ProcessRecordContext } from "../components/ProcessEvidenceReview";
import "./etch-training.css";
import "./process-training.css";

export default function TrainingHistory({ attemptId }: { attemptId: string }) {
  const [language, setLanguage] = useProductLanguage();
  const l = (ko: string, en: string, ja: string) => tr(language, ko, en, ja);
  const auth = trpc.auth.me.useQuery();
  const id = Number(attemptId);
  const validId = /^\d+$/.test(attemptId) && Number.isSafeInteger(id) && id > 0;
  const query = trpc.training.detail.useQuery({ id: validId ? id : 1 }, { enabled: validId && Boolean(auth.data), retry: false });
  const record = query.data?.userId === auth.data?.id ? query.data?.attempt : null;
  const scenario = record ? getProcessScenario(record.scenarioId) : undefined;
  const replay = record ? trainingReplay(record) : undefined;
  const practiceHref = record ? trainingPracticeHref(record.scenarioId) : undefined;
  const [comparisonTime, setComparisonTime] = useState<number | null>(null);
  const [selected, setSelected] = useState("");
  const replayHeading = useRef<HTMLHeadingElement>(null);
  const historyHeader = useRef<HTMLElement>(null);
  const reviewEvidencePoint = (at: number) => {
    setComparisonTime(at);
    const heading = replayHeading.current;
    heading?.focus({ preventScroll: true });
    if (heading) window.scrollTo({ top: Math.max(0, window.scrollY + heading.getBoundingClientRect().top - (historyHeader.current?.getBoundingClientRect().height ?? 80) - 20), behavior: "auto" });
  };
  useEffect(() => { setComparisonTime(null); setSelected(""); }, [attemptId, auth.data?.id]);
  useEffect(() => { document.title = l("SemiGuard — 내 판단 기록", "SemiGuard — My reasoning record", "SemiGuard — 自分の判断記録"); }, [language]);
  const isEtch = scenario?.processId === "etch";
  const duration = isEtch ? 180 : scenario?.duration ?? 90;
  const signals = scenario ? isEtch ? etchSignals.map(s => ({ id: s.id, name: etchSignalName(language, s.id) })) : scenario.signals.map(s => ({ id: s.id, name: l(...s.name) })) : [];
  const signalId = signals.some(s => s.id === selected) ? selected : replay?.signalId ?? signals[0]?.id;
  const time = comparisonTime ?? replay?.targets[0]?.time ?? 0;
  const sample = (signal: string, at: number) => isEtch ? etchSample(signal as typeof etchSignals[number]["id"], at) : processSample(scenario!, signal, at);
  const clock = (value: number) => `${Math.floor(value / 60).toString().padStart(2, "0")}:${(value % 60).toString().padStart(2, "0")}`;
  const chart = scenario && signalId ? Array.from({ length: duration + 1 }, (_, at) => sample(signalId, at)) : [];
  return <div className="et-app"><header ref={historyHeader} className="et-header"><Link className="et-brand" href="/training"><b>SG</b> SemiGuard</Link><ProductLanguageSelect language={language} onChange={setLanguage} /></header>
    <main className="et-main"><p className="et-eyebrow">MY SAVED REASONING / READ ONLY</p><h1>{l("내 판단 기록", "My reasoning record", "自分の判断記録")}</h1><Link className="et-linkbutton" href="/training">{l("학습 기록 목록으로", "Back to practice history", "練習記録一覧へ")}</Link>
      {!validId ? <p role="alert">{l("올바르지 않은 기록 주소입니다.", "Invalid record address.", "記録のアドレスが正しくありません。")}</p>
        : auth.isLoading ? <p role="status">{l("로그인 확인 중…", "Checking sign-in…", "ログインを確認中…")}</p>
        : !auth.data ? <Link className="et-linkbutton" href="/login">{l("본인 기록을 보려면 로그인하세요.", "Sign in to view your own record.", "自分の記録を見るにはログインしてください。")}</Link>
        : query.isLoading ? <p role="status">{l("기록을 불러오는 중…", "Loading the record…", "記録を読み込み中…")}</p>
        : query.isError ? <p role="alert">{l("기록을 불러오지 못했습니다.", "Could not load the record.", "記録を読み込めませんでした。")} <button type="button" onClick={() => void query.refetch()}>{l("다시 시도", "Retry", "再試行")}</button></p>
        : !record ? <p>{l("이 계정에서 볼 수 있는 기록이 없습니다.", "No record is available for this account.", "このアカウントで表示できる記録はありません。")}</p>
        : !scenario ? <p>{l("이전 모듈의 기록입니다. 현재 재생은 지원하지 않습니다.", "This older module does not support replay.", "以前のモジュールの記録で、現在は再生に対応していません。")}</p>
        : <><TrainingShareControls key={`${auth.data?.id}:${record.id}`} id={record.id} language={language} /><section className="et-panel"><h2>{l(...scenario.title)}</h2><p>{new Date(record.createdAt).toLocaleString(language)}</p>
          <dl><dt>{l("주목한 항목", "Selected signal", "注目した項目")}</dt><dd>{record.signal === "none" ? l("차이 없음", "No deviation", "差異なし") : signals.find(s => s.id === record.signal)?.name ?? record.signal}</dd>
            <dt>{l("내 변화 시작 판단", "My estimated onset", "自分の変化開始の判断")}</dt><dd>{record.onset < 0 ? l("해당 없음", "Not applicable", "該当なし") : clock(record.onset)}</dd>
            <dt>{l("내가 표시한 시점", "My selected marker", "自分が印を付けた時点")}</dt><dd>{record.marker === null ? l("없음", "None", "なし") : clock(record.marker)}</dd>
            <dt>{l("선택한 비교 기준", "Selected comparison", "選んだ比較基準")}</dt><dd>{record.comparison === "whole-run" ? l("전체 기록", "Whole run", "全体の記録") : l("같은 단계·조건의 정상 참고", "Normal reference under the same phase/conditions", "同じ段階・条件の正常参照")}</dd>
            <dt>{l("원인 확정 여부 판단", "Cause certainty choice", "原因の確定についての判断")}</dt><dd>{record.certainty === "uncertain" ? l("추가 확인 필요", "Further comparison needed", "追加の比較が必要") : l("확정 가능을 선택함", "Selected: can confirm", "確定可能を選択")}</dd></dl>
          <p className="et-caption">{l("표시 시점은 내가 선택한 가상 시점이며 당시 발견했다는 뜻이 아닙니다. 서술형 답안은 서버에 저장하지 않았으므로 이 화면에서 복원할 수 없습니다.", "The marker is a selected virtual time, not evidence of discovery at that moment. Written answers were not saved on the server and cannot be recovered here.", "印は選択した仮想時点であり、その時点で発見した意味ではありません。記述回答はサーバーに保存していないため、ここでは復元できません。")}</p>
        </section><section className="et-panel"><h2 ref={replayHeading} tabIndex={-1}>{l("기록의 타임라인 다시 보기", "Replay the record timeline", "記録のタイムラインを振り返る")}</h2>
          <label>{l("관측 항목", "Observation", "観測項目")} <select value={signalId} onChange={e => setSelected(e.target.value)}>{signals.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
          <div role="img" aria-label={l("가상 기록과 정상 참고 비교. 정확한 값은 아래 표에 있습니다.", "Synthetic record versus normal reference. Exact values are in the table below.", "仮想記録と正常参照の比較。正確な値は下の表にあります。")}>
            <ResponsiveContainer width="100%" height={260}><LineChart data={chart}><XAxis dataKey="time" type="number" domain={[0, duration]} tickFormatter={clock} stroke="#b5c7d8" /><YAxis domain={["auto", "auto"]} stroke="#b5c7d8" /><Line dataKey="value" stroke="#8ed0c3" dot={false} isAnimationActive={false} /><Line dataKey="reference" stroke="#b5c7d8" strokeDasharray="5 5" dot={false} isAnimationActive={false} /><ReferenceLine x={time} stroke="#71b7f0" strokeDasharray="3 3" />{record.marker !== null ? <ReferenceLine x={record.marker} stroke="#e4aa55" /> : null}{scenario.changeTime !== null ? <ReferenceLine x={scenario.changeTime} stroke="#c4aad7" /> : null}</LineChart></ResponsiveContainer>
          </div><p className="et-caption">{l("실선: 가상 기록 / 점선: 정상 참고 / 파랑: 현재 비교 시점 / 주황: 내 표시 / 보라: 구성상 편차 시작. 실제 장비 고장 기준이 아닙니다.", "Solid: synthetic record / dashed: reference / blue: current comparison time / orange: my marker / purple: designed deviation onset, not a real fault limit.", "実線：仮想記録／破線：正常参照／青：現在の比較時点／オレンジ：自分の印／紫：構成上の偏差開始。実装置の故障基準ではありません。")}</p>
          <div className="et-actions" role="group" aria-label={l("저장된 판단 시점으로 이동", "Navigate to saved reasoning times", "保存した判断時点へ移動")}>
            {replay?.targets.map(target => <button key={target.source} className="et-linkbutton" type="button" onClick={() => { setComparisonTime(target.time); if (target.source !== "start" && replay) setSelected(replay.signalId); }}>{target.source === "onset" ? l(`내 시작 판단 ${clock(target.time)} 보기`, `View my onset choice ${clock(target.time)}`, `自分の開始判断 ${clock(target.time)} を見る`) : target.source === "marker" ? l(`내 표시 ${clock(target.time)} 보기`, `View my marker ${clock(target.time)}`, `自分の印 ${clock(target.time)} を見る`) : l("기록 처음 보기", "View record start", "記録の最初を見る")}</button>)}
          </div>
          <p className="et-caption">{l("내 시작 판단·내 표시 버튼은 저장된 관측 항목과 가상 시점으로 이동합니다. 아래 값은 선택한 비교 시점의 값이며, 저장된 답안을 바꾸지 않습니다.", "My onset and marker buttons open the saved signal and virtual time. Values below reflect the comparison time; your saved answer is unchanged.", "開始判断・印のボタンで保存した観測項目と仮想時点へ移動します。下の値は比較時点の値であり、保存済みの回答は変わりません。")}</p>
          <label htmlFor="history-time">{l("비교 시점", "Comparison time", "比較時点")} {clock(time)}</label><input id="history-time" type="range" min={0} max={duration} value={time} aria-valuetext={clock(time)} onChange={e => setComparisonTime(Number(e.target.value))} />
          <ProcessRecordContext scenario={scenario} time={time} language={language} />
          <div className="et-table"><table><caption aria-live="polite">{l(`비교 시점 ${clock(time)} · 모든 값은 교육용 상대지수`, `Comparison time ${clock(time)} · All values are educational relative indices`, `比較時点 ${clock(time)}・すべて教育用の相対指数`)}</caption><thead><tr><th>{l("항목", "Signal", "項目")}</th><th>{l("관측값", "Current", "観測値")}</th><th>{l("정상 참고", "Reference", "正常参照")}</th><th>{l("차이", "Difference", "差")}</th></tr></thead><tbody>{signals.map(s => { const p = sample(s.id, time); return <tr key={s.id} aria-current={s.id === signalId ? "true" : undefined}><th>{s.name}{s.id === signalId ? l(" · 그래프 표시", " · In graph", "・グラフ表示") : ""}</th><td>{p.value.toFixed(1)}</td><td>{p.reference.toFixed(1)}</td><td>{(p.value - p.reference).toFixed(1)}</td></tr>; })}</tbody></table></div>
          <h3>{l("저장된 선택형 비교 결과", "Saved choice-criteria results", "保存された選択基準との比較")}</h3>
          <ul>{[record.signalMatched, record.onsetMatched, record.comparisonMatched, record.certaintyMatched].map((match, index) => <li key={index}>{[l("관측 항목", "Signal", "観測項目"), l("시작 시점", "Onset", "開始時点"), l("비교 기준", "Reference", "比較基準"), l("사실과 추정", "Fact versus inference", "事実と推測")][index]} · {match ? l("구성 기준 일치", "Matches teaching criterion", "構成基準と一致") : l("다시 비교", "Revisit", "再度比較")}</li>)}</ul>
          <p className="et-caption">{l("실제 현장 역량 점수가 아닙니다. 다시 보기로 저장된 답안이 바뀌지 않습니다.", "Not a workplace competency score. Replay does not change your saved answer.", "現場能力の点数ではありません。振り返っても保存済みの回答は変わりません。")}</p>
          <ProcessEvidenceReview scenario={scenario} language={language} onReviewPoint={reviewEvidencePoint} />
        </section>{practiceHref ? <section className="et-panel"><h2>{l("복기한 모듈에서 다시 연습하기", "Practise the reviewed module again", "振り返ったモジュールで再練習")}</h2>
          <p>{l("같은 모듈을 열어도 저장된 완료 기록과 현재 탭 답안은 바뀌지 않습니다. 이어서 관찰하거나, 연습 화면에서 ‘새 시도로 다시 연습’을 선택해 확인 후 시작할 수 있습니다. 계정 중간 저장본은 별도로 불러올 수 있으며 서술형 답안은 복원되지 않습니다.", "Opening the same module does not change saved records or this tab\'s answer. Continue observing, or choose ‘Practice with a new attempt’ in the exercise and confirm. Account checkpoints can be loaded separately; written answers are not restored.", "同じモジュールを開いても保存済みの完了記録とこのタブの回答は変わりません。観察を続けるか、練習画面で「新しい試行で再練習」を選び、確認して開始できます。アカウントの中間保存は別途読み込めますが、記述回答は復元されません。")}</p>
          <Link className="et-linkbutton" href={practiceHref}>{l("이 모듈 다시 열기", "Open this module again", "このモジュールをもう一度開く")}</Link>
        </section> : null}</>}
    </main></div>;
}
