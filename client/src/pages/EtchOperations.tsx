import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ETCH_DURATION, etchPhase, etchSignals, type EtchSignal } from "../../../shared/etchScenario";
import { operationsStorageKey, emptyOperationsSession, firstPersistentOutside, nextOperationsTime, operationsEvidence, restoreOperationsSession, validOperationsNote, type OperationsNote } from "../../../shared/etchOperations";
import { SignalChart } from "./EtchTraining";
import ProductLanguageSelect from "../components/ProductLanguageSelect";
import { etchSignalLocation, etchSignalName } from "../lib/etchLanguage";
import { tr, useProductLanguage } from "../lib/productLanguage";
import "./etch-training.css";
import "./etch-operations.css";

const clock = (time: number) => `${Math.floor(time / 60).toString().padStart(2, "0")}:${(time % 60).toString().padStart(2, "0")}`;
const linkedProvider = new URLSearchParams(window.location.search).get("social_linked");

export default function EtchOperations({ userId }: { userId: number }) {
  const [language, setLanguage] = useProductLanguage();
  const l = (ko: string, en: string, ja: string) => tr(language, ko, en, ja);
  const storageKey = operationsStorageKey(userId);
  const [session, setSession] = useState(() => {
    try { return restoreOperationsSession(sessionStorage.getItem(storageKey)) ?? emptyOperationsSession(); }
    catch { return emptyOperationsSession(); }
  });
  const [running, setRunning] = useState(false);
  const [fact, setFact] = useState("");
  const [possibility, setPossibility] = useState("");
  const [nextCheck, setNextCheck] = useState("");
  const [notice, setNotice] = useState("");
  const [storageWarning, setStorageWarning] = useState("");
  const [resetPrompt, setResetPrompt] = useState(false);
  const active = running && session.elapsed < ETCH_DURATION;
  const viewedTime = session.inspection ?? session.elapsed;
  const rows = operationsEvidence(viewedTime, session.elapsed);
  const selected = etchSignals.find(signal => signal.id === session.selected)!;
  const onset = firstPersistentOutside("pressure", session.elapsed);
  const socialLinked = ["google", "naver", "kakao"].includes(linkedProvider || "");

  useEffect(() => { document.title = l("SemiGuard — 식각 챔버 관찰 작업대", "SemiGuard — Etch-chamber observation workspace", "SemiGuard — エッチングチャンバー観察ワークスペース"); }, [language]);
  useEffect(() => {
    try { sessionStorage.setItem(storageKey, JSON.stringify(session)); }
    catch { setStorageWarning(l("이 브라우저에서는 임시 저장을 사용할 수 없습니다. 필요한 기록은 파일로 내려받으세요.", "Temporary storage is unavailable. Download important records.", "このブラウザーでは一時保存できません。必要な記録はダウンロードしてください。")); }
  }, [session, storageKey]);
  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => setSession(current => ({ ...current, elapsed: nextOperationsTime(current.elapsed) })), 3000);
    return () => window.clearInterval(timer);
  }, [active]);
  useEffect(() => {
    if (!active) return;
    const pause = () => {
      if (document.hidden) { setRunning(false); setNotice(l("다른 탭으로 이동해 가상 관찰을 일시정지했습니다.", "Synthetic observation paused when you switched tabs.", "別のタブに移動したため仮想観察を一時停止しました。")); }
    };
    document.addEventListener("visibilitychange", pause);
    return () => document.removeEventListener("visibilitychange", pause);
  }, [active]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (fact.trim() || possibility.trim() || nextCheck.trim()) { event.preventDefault(); event.returnValue = ""; }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [fact, possibility, nextCheck]);

  function addNote() {
    if (session.notes.length >= 30) { setNotice(l("한 실행에는 최대 30개까지 기록할 수 있습니다.", "Up to 30 notes per run.", "1回の実行では最大30件まで記録できます。")); return; }
    const note: OperationsNote = {
      id: crypto.randomUUID(), time: viewedTime, signal: session.selected,
      fact: fact.trim(), possibility: possibility.trim(), nextCheck: nextCheck.trim(),
    };
    if (!validOperationsNote(note, session.elapsed)) { setNotice(l("관찰 사실을 10–600자로 작성하세요. 다른 항목은 각각 600자 이내입니다.", "Write observed facts in 10–600 characters; other fields must be at most 600 characters each.", "観察事実を10～600文字で入力してください。他の項目はそれぞれ600文字以内です。")); return; }
    setSession(current => ({ ...current, notes: [...current.notes, note] }));
    setFact(""); setPossibility(""); setNextCheck("");
    setNotice(`${clock(viewedTime)} ${l("의 관찰을 기록했습니다. 과거 시점을 선택한 경우 당시 발견했다는 뜻은 아닙니다.", "observation recorded. Choosing a past point does not mean you discovered it then.", "の観察を記録しました。過去の時点を選んでも、当時発見した意味ではありません。")}`);
  }

  function exportSession() {
    const payload = { kind: "semiguard-etch-operations", simulated: true, ...session };
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }));
    const link = document.createElement("a"); link.href = url; link.download = "semiguard-etch-observation.json"; link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice(l("가상 관찰 기록을 파일로 내려받았습니다.", "Synthetic observation record downloaded.", "仮想観察記録をダウンロードしました。"));
  }

  return <div className="et-app op-app">
    <a className="et-skip" href="#operations-main">{l("관찰 작업대로 이동", "Skip to observation workspace", "観察ワークスペースへ移動")}</a>
    <header className="et-header"><Link className="et-brand" href="/dashboard"><b>SG</b> SemiGuard <small>SIMULATION</small></Link><nav aria-label={l("제품 메뉴", "Product navigation", "製品メニュー")}><Link href="/dashboard">{l("4센서 대시보드", "Four-sensor dashboard", "4センサーダッシュボード")}</Link><Link href="/live">{l("자유 관찰", "Free observation", "自由観察")}</Link><Link href="/training">{l("시나리오 훈련", "Scenario training", "シナリオ訓練")}</Link><Link href="/learn">{l("8대 공정 학습", "Eight processes", "8大工程の学習")}</Link><ProductLanguageSelect language={language} onChange={setLanguage} /></nav></header>
    <main id="operations-main" className="et-main">
      <div className="et-meta"><span>CHAMBER A / OBSERVATION WORKSPACE</span><span>{l("가상 신호 · 실제 설비 연결 및 제어 없음", "Synthetic signals · no real-equipment connection or control", "仮想信号・実際の装置への接続・制御なし")}</span></div>
      <div className="et-workhead"><div><p className="et-eyebrow">OPERATIONAL OBSERVATION / NOT A QUIZ</p><h1>{l("식각 챔버 관찰 작업대", "Etch-chamber observation workspace", "エッチングチャンバー観察ワークスペース")}</h1><p className="et-lead">{l("한 대의 가상 장비에서 무엇이 달라졌는지 확인하고, 사실과 가능한 설명을 분리해 기록합니다.", "See what changed in one synthetic piece of equipment, then record facts separately from possible explanations.", "一台の仮想装置で何が変わったかを確認し、事実と考えられる説明を分けて記録します。")}</p></div><div className="et-clock"><strong>{clock(session.elapsed)}</strong><span>{session.elapsed === ETCH_DURATION ? l("가상 실행 완료", "Synthetic run complete", "仮想実行完了") : active ? l("3초마다 관측 중", "Observing every 3 seconds", "3秒ごとに観測中") : session.elapsed === 0 ? l("시작 전", "Not started", "開始前") : l("일시정지", "Paused", "一時停止")}</span></div></div>
      <p className="et-storage">{l("이 화면은 실제 장비 스트림이 아니라 180초로 압축한 교육용 가상 실행입니다. 값은 물리 단위가 아닌 상대지수이며 실제 공정 시간·레시피·성능을 뜻하지 않습니다. 관찰 기록은 이 브라우저 탭에 임시 저장되고 계정·기기 간 동기화되지 않습니다.", "This is a 180-second compressed teaching run, not a real equipment stream. Values are relative indices, not physical units or real process timing, recipes, or performance. Notes are temporarily stored in this tab, without account or device synchronization.", "これは実際の装置ストリームではなく、180秒に圧縮した教育用の仮想実行です。値は物理単位ではなく相対指数で、実際の工程時間・レシピ・性能を示しません。記録はこのタブに一時保存され、アカウントや端末間では同期されません。")}</p>
      {socialLinked ? <p role="status" className="op-message">{l("소셜 계정 연결이 완료되었습니다.", "Social account connected.", "ソーシャルアカウントを連携しました。")} <Link href="/dashboard">{l("4센서 대시보드에서 확인", "Check the four-sensor dashboard", "4センサーダッシュボードで確認")}</Link></p> : null}
      {storageWarning ? <p role="alert" className="et-alert">{storageWarning}</p> : null}
      <div className="et-actions"><Button className="et-primary" disabled={session.elapsed === ETCH_DURATION} onClick={() => setRunning(value => !value)}>{active ? l("관찰 일시정지", "Pause observation", "観察を一時停止") : session.elapsed === 0 ? l("가상 관찰 시작", "Start synthetic observation", "仮想観察を始める") : l("관찰 재개", "Resume observation", "観察を再開")}</Button><Button variant="outline" onClick={() => { setRunning(false); setResetPrompt(true); }}>{l("새 실행 준비", "Prepare a new run", "新しい実行を準備")}</Button><Button variant="outline" onClick={exportSession} disabled={!session.elapsed && !session.notes.length}>{l("기록 파일 내려받기", "Download record file", "記録ファイルをダウンロード")}</Button></div>
      {resetPrompt ? <section className="et-panel op-message" aria-label={l("새 실행 확인", "Confirm new run", "新しい実行の確認")}><p>{l(`현재 가상 실행과 임시 메모 ${session.notes.length}개를 지우고 처음부터 다시 시작할까요? 기존 계정 기록은 지워지지 않습니다.`, `Delete this synthetic run and ${session.notes.length} temporary notes, then start over? Existing account records will remain.`, `現在の仮想実行と一時メモ${session.notes.length}件を削除して最初からやり直しますか？既存のアカウント記録は削除されません。`)}</p><div className="et-actions"><Button onClick={() => { setSession(emptyOperationsSession()); setRunning(false); setResetPrompt(false); setNotice(l("새 가상 실행을 준비했습니다.", "New synthetic run ready.", "新しい仮想実行を準備しました。")); }}>{l("임시 실행 지우기", "Delete temporary run", "一時実行を削除")}</Button><Button variant="outline" onClick={() => setResetPrompt(false)}>{l("취소", "Cancel", "キャンセル")}</Button></div></section> : null}
      <section className="op-context" aria-label={l("장비 상태", "Equipment context", "装置の状態")}><div><span className="op-label">{l("관찰 대상", "Observation target", "観察対象")}</span><strong>Plasma Etch · Chamber A</strong><small>{l("공개 원리 기반 가상 구성 · 특정 제조사 장비 아님", "Synthetic configuration based on public concepts · not a specific manufacturer's equipment", "公開原理に基づく仮想構成・特定メーカーの装置ではありません")}</small></div><div><span className="op-label">{l("표시 중인 단계", "Displayed phase", "表示中の段階")}</span><strong>{l("단계", "Phase", "段階")} {etchPhase(viewedTime)}</strong><small>{l("같은 단계의 정상 참고 기록과 비교", "Compared with normal reference in the same phase", "同じ段階の正常参照記録と比較")}</small></div><div><span className="op-label">{l("현재 강조", "Current highlight", "現在の注目点")}</span><strong>{onset === null ? l("지속 편차 미확인", "No sustained deviation confirmed", "継続的な偏差は未確認") : l("압력 추세 확인 필요", "Check pressure trend", "圧力傾向の確認が必要")}</strong><small>{onset === null ? l("관측한 구간 기준", "Within observed interval", "観測した区間に基づく") : `${clock(onset)} ${l("부터 3회 연속 기준 밖 · 규칙 기반 표시", "onward: three consecutive points outside range · rule-based indicator", "から3回連続で基準外・ルールベースの表示")}`}</small></div></section>
      <div className="op-grid"><section className="et-monitor op-monitor" aria-label={l("가상 센서 관찰", "Synthetic sensor observation", "仮想センサー観察")}><div className="op-section-head"><div><p className="et-eyebrow">01 / SIGNALS</p><h2>{l("현재값과 같은 단계의 기준", "Current values and same-phase ranges", "現在値と同じ段階の基準")}</h2></div><span className="op-label">{session.inspection === null ? l("최신 관측", "Latest observation", "最新の観測") : `${l("과거", "Reviewing past", "過去") } ${clock(viewedTime)}`}</span></div><div className="et-sensors">{rows.map(row => <button key={row.id} className="et-sensor" aria-pressed={session.selected === row.id} onClick={() => setSession(current => ({ ...current, selected: row.id }))}><span>{etchSignalName(language, row.id)}</span><strong>{row.value.toFixed(1)} <small>{l("상대지수", "relative index", "相対指数")}</small></strong><span>{l("기준", "Range", "基準")} {row.low}–{row.high} · {l("차이", "Difference", "差")} {row.difference > 0 ? "+" : ""}{row.difference.toFixed(1)}</span><em className={row.outside ? "op-outside" : "op-within"}>{row.outside ? l("기준 밖", "Outside range", "基準外") : l("기준 안", "Within range", "基準内")}</em></button>)}</div><h2>{etchSignalName(language, selected.id)} {l("의 변화 추세", "trend", "の変化傾向")}</h2><p className="et-caption">{etchSignalLocation(language, selected.id)} · {l("현재 실행과 같은 단계·같은 시점의 정상 참고 기록을 비교합니다.", "Compare this run with normal reference at the same phase and time.", "今回の実行と同じ段階・同じ時点の正常参照記録を比較します。")}</p><SignalChart language={language} signal={session.selected} until={session.elapsed} marker={session.inspection} sampleStep={3} /><p className="et-caption">{l("실선: 이번 가상 실행 · 점선: 정상 참고 · 주황선: 선택한 과거 시점. 단일 값만으로 원인을 확정하지 않습니다.", "Solid: current synthetic run · dashed: normal reference · orange: selected past point. One value cannot establish a cause.", "実線：今回の仮想実行・破線：正常参照・オレンジ：選んだ過去の時点。単一の値だけで原因は確定できません。")}</p><div className="et-marker-picker"><label htmlFor="operations-inspection">{l("살펴볼 시점", "Point to inspect", "確認する時点")} {clock(viewedTime)} / {l("관측한 구간", "Observed interval", "観測した区間")} {clock(session.elapsed)}</label><input id="operations-inspection" type="range" min={0} max={session.elapsed} step={3} value={viewedTime} disabled={!session.elapsed} onChange={event => setSession(current => ({ ...current, inspection: Number(event.target.value) }))} /><Button variant="outline" onClick={() => setSession(current => ({ ...current, inspection: null }))}>{l("최신 시점 따라가기", "Follow latest point", "最新時点に戻る")}</Button></div></section>
      <aside className="et-panel op-evidence"><p className="et-eyebrow">02 / EVIDENCE</p><h2>{l("관찰된 사실", "Observed facts", "観察された事実")}</h2><p>{onset === null ? l("현재까지 규칙에 해당하는 지속 편차는 없습니다. 신호 추세를 계속 관찰하세요.", "No sustained deviation has met the rule yet. Continue observing the signal trend.", "現在までルールに該当する継続的な偏差はありません。信号の傾向を観察してください。") : l(`관측한 구간에서 압력이 ${clock(onset)}부터 세 번 연속으로 같은 단계의 가상 기준을 벗어났습니다.`, `In the observed interval, pressure was outside the synthetic same-phase range for three consecutive points starting at ${clock(onset)}.`, `観測した区間では、圧力が${clock(onset)}から3回連続で同じ段階の仮想基準を外れました。`)}</p><p className="et-caption">{l("이 표시는 학습된 AI 판단이 아닌 단순 비교 규칙입니다. 변화의 원인이나 장비 이상을 확정하지 않습니다.", "This indicator uses a simple comparison rule, not trained-AI judgment. It cannot confirm the cause of change or an equipment fault.", "この表示は学習済みAIの判断ではなく単純な比較ルールです。変化の原因や装置の異常は確定できません。")}</p><div className="et-table" role="region" aria-label={l("센서 근거표", "Sensor evidence table", "センサー根拠表")} tabIndex={0}><table><caption>{clock(viewedTime)} {l("의 가상 센서 근거 · 상대지수", "synthetic sensor evidence · relative indices", "の仮想センサー根拠・相対指数")}</caption><thead><tr><th scope="col">{l("센서", "Sensor", "センサー")}</th><th scope="col">{l("현재", "Current", "現在")}</th><th scope="col">{l("정상 참고", "Normal reference", "正常参照")}</th><th scope="col">{l("차이", "Difference", "差")}</th></tr></thead><tbody>{rows.map(row => <tr key={row.id}><th scope="row">{etchSignalName(language, row.id)}</th><td>{row.value.toFixed(1)}</td><td>{row.reference.toFixed(1)}</td><td>{row.difference > 0 ? "+" : ""}{row.difference.toFixed(1)}</td></tr>)}</tbody></table></div><h2>{l("다음 확인 순서", "Suggested next checks", "次の確認順序")}</h2><ol><li>{l("같은 공정 단계의 기준과 추세를 다시 비교", "Recompare the baseline and trend within the same phase", "同じ工程段階の基準と傾向を再比較")}</li><li>{l("다른 신호와 측정 기록의 일치 여부 확인", "Check consistency with other signals and records", "他の信号と測定記録の一致を確認")}</li><li>{l("관찰 사실·미확정 사항을 기록하고 담당자와 검토", "Record facts and unknowns, then review with the responsible person", "観察事実と未確定事項を記録し担当者と検討")}</li></ol><p className="et-caption">{l("설비 조작이나 현장 점검 절차를 지시하지 않습니다.", "This does not instruct equipment operation or field inspection procedures.", "装置操作や現場点検の手順を指示しません。")}</p></aside></div>
      <div className="et-columns op-notes"><form className="et-panel et-form" onSubmit={event => { event.preventDefault(); addNote(); }}><p className="et-eyebrow">03 / OBSERVATION LOG</p><h2>{l("판단 근거 기록", "Record reasoning evidence", "判断の根拠を記録")}</h2><p className="et-caption">{clock(viewedTime)} · {etchSignalName(language, selected.id)} · {session.inspection === null ? l("최신 관측", "Latest observation", "最新の観測") : l("과거 기록 검토", "Reviewing past record", "過去の記録を確認")}</p><label htmlFor="operations-fact">{l("관찰한 사실", "Observed facts", "観察した事実")}<textarea id="operations-fact" required minLength={10} maxLength={600} rows={3} value={fact} onChange={event => setFact(event.target.value)} placeholder={l("예: 같은 단계의 정상 참고 기록과 비교한 차이", "Example: difference from a same-phase normal reference", "例：同じ段階の正常参照記録との差")} /></label><label htmlFor="operations-possibility">{l("가능한 설명 후보 · 미확정", "Possible explanation · unconfirmed", "考えられる説明候補・未確定")}<textarea id="operations-possibility" maxLength={600} rows={2} value={possibility} onChange={event => setPossibility(event.target.value)} placeholder={l("확정하지 않은 가설만 기록", "Record only unconfirmed hypotheses", "未確定の仮説のみ記録")} /></label><label htmlFor="operations-next">{l("다음에 확인할 정보", "Information for the next check", "次に確認する情報")}<textarea id="operations-next" maxLength={600} rows={2} value={nextCheck} onChange={event => setNextCheck(event.target.value)} placeholder={l("비교할 다른 기록이나 담당자 검토 항목", "Other records to compare or items for responsible review", "比較する他の記録や担当者の確認項目")} /></label><p className="et-caption">{l("회사 비공개 정보나 개인정보는 입력하지 마세요. 과거 시점의 메모는 그때 발견했다는 뜻이 아닙니다.", "Do not enter confidential company or personal information. A note about a past point does not mean it was discovered then.", "会社の非公開情報や個人情報を入力しないでください。過去の時点のメモは当時発見した意味ではありません。")}</p><Button className="et-primary" type="submit" disabled={session.notes.length >= 30}>{l("관찰 기록 남기기", "Record observation", "観察を記録")} ({session.notes.length}/30)</Button></form><section className="et-panel et-report"><p className="et-eyebrow">SESSION HISTORY</p><h2>{l("이번 실행의 기록", "Records for this run", "今回の実行記録")}</h2>{session.notes.length === 0 ? <p>{l("시점과 신호를 고른 뒤 관찰 사실을 남기면 여기에 쌓입니다.", "Choose a point and signal, then record facts here.", "時点と信号を選び、観察事実を記録するとここに表示されます。")}</p> : <ol className="op-history">{session.notes.map(note => <li key={note.id}><h3>{clock(note.time)} · {etchSignalName(language, note.signal)}</h3><p><b>{l("사실", "Fact", "事実")}</b> {note.fact}</p><p><b>{l("가능한 설명", "Possible explanation", "考えられる説明")}</b> {note.possibility || l("미기재 · 원인 미확정", "Not provided · cause unconfirmed", "未記入・原因未確定")}</p><p><b>{l("다음 확인", "Next check", "次の確認")}</b> {note.nextCheck || l("미기재", "Not provided", "未記入")}</p><div className="et-actions"><Button variant="outline" onClick={() => setSession(current => ({ ...current, selected: note.signal, inspection: note.time }))}>{l("이 시점 비교", "Compare this point", "この時点を比較")}</Button><Button variant="ghost" aria-label={`${clock(note.time)} ${l("기록 취소", "remove note", "記録を取り消す")}`} onClick={() => setSession(current => ({ ...current, notes: current.notes.filter(item => item.id !== note.id) }))}>{l("기록 취소", "Remove note", "記録を取り消す")}</Button></div></li>)}</ol>}</section></div>
      <p role="status" aria-live="polite" className="et-notice">{notice}</p><footer className="et-footer">{l("이 화면은 기존 대시보드를 대체하지 않는 별도 식각 가상 실행입니다. 훈련 채점 없음 · 실제 팹 성능 미검증. 기존 차트·기록·계정 설정은", "This separate synthetic etch run does not replace the existing dashboard. No training grade or validated fab performance. Existing charts, logs, and account settings remain in the", "この画面は既存のダッシュボードを置き換えない別の仮想エッチング実行です。訓練採点はなく、実際の製造現場での性能は未検証です。既存のグラフ・記録・アカウント設定は")} <Link href="/dashboard">{l("4센서 대시보드", "four-sensor dashboard", "4センサーダッシュボード")}</Link>{l("에서 이용할 수 있습니다.", ".", "で利用できます。")}</footer>
    </main>
  </div>;
}
