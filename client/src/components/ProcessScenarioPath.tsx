import React, { useState } from "react";
import { Link } from "wouter";
import { processEquipment } from "../../../shared/processEquipment";
import { processScenarios, scenarioHref } from "../../../shared/processScenarios";
import { processProgress } from "../../../shared/processProgress";
import { tr, type ProductLanguage } from "../lib/productLanguage";
import { trpc } from "../lib/trpc";
import "./process-scenario-path.css";

export default function ProcessScenarioPath({ language, userId, onEtch }: {
  language: ProductLanguage; userId: number | null; onEtch: () => void;
}) {
  const l = (ko: string, en: string, ja: string) => tr(language, ko, en, ja);
  const progress = trpc.training.progress.useQuery(undefined, { enabled: userId !== null, retry: false });
  // Query caches may still contain another account's result during an account change.
  const saved = progress.isError ? null : processProgress(userId, progress.data);
  const [pendingOnly, setPendingOnly] = useState(false);
  const visible = saved && pendingOnly ? saved.unsubmitted : processScenarios;
  const next = saved?.next;
  return <section className="process-path" aria-labelledby="process-path-heading">
    <div className="process-path-head"><div>
      <p className="et-eyebrow">EIGHT PROCESSES / EIGHT JUDGMENT TASKS</p>
      <h2 id="process-path-heading">{l("8개 공정을 따라 판단을 연습하세요.", "Practice judgment across eight processes.", "8つの工程で判断を練習しましょう。")}</h2>
    </div>{saved ? <p className="process-path-count">{saved.completed}/{saved.total} <span>{l("공정 제출 완료", "processes submitted", "工程を提出済み")}</span></p> : null}</div>
    <p>{l("순서대로 배우거나 필요한 공정부터 선택할 수 있습니다. 모든 단계가 고장 상황인 것은 아닙니다. 실제 제조는 여러 공정을 반복하며, 아래 순서는 입문용 학습 경로입니다.", "Follow the order or choose any process. Not every task is a fault situation. Real manufacturing repeats processes; this is an introductory learning path.", "順番に学ぶことも、必要な工程から選ぶこともできます。すべてが故障の状況ではありません。実際の製造では工程が繰り返され、この順序は入門用の学習経路です。")}</p>
    {saved ? <section className="process-path-progress et-panel" aria-label={l("내 공정 학습 경로", "My process learning path", "自分の工程学習経路")}>
      <progress value={saved.completed} max={saved.total} aria-label={l("제출한 공정 수 · 숙련도 아님", "Submitted process count · not proficiency", "提出した工程数・熟練度ではありません")}>{saved.completed}/{saved.total}</progress>
      {next ? <><h3>{l("다음 미제출 공정", "Next unsubmitted process", "次の未提出工程")}</h3><p>{String(next.order).padStart(2, "0")} · {l(...next.title)}</p><p className="et-caption">{l("제출 기록에 없는 첫 공정입니다. 학습 순서에 따른 제안일 뿐이며, 다른 공정도 자유롭게 선택할 수 있습니다. 중간 저장본은 그대로 유지됩니다.", "This is the first process without a saved submission. It is a learning-order suggestion, not a requirement. You may choose any other process; checkpoints remain unchanged.", "保存された提出記録がない最初の工程です。学習順に沿った提案であり、必須ではありません。他の工程も自由に選べ、中間保存はそのまま残ります。")}</p>
        {next.processId === "etch" ? <button className="et-linkbutton process-path-next" type="button" onClick={onEtch}>{l("이 공정 열기 →", "Open this process →", "この工程を開く →")}</button> : <Link className="et-linkbutton process-path-next" href={scenarioHref(next)}>{l("이 공정 열기 →", "Open this process →", "この工程を開く →")}</Link>}</>
        : <><h3>{l("8개 공정의 제출 기록이 있어요.", "You have submitted all eight processes.", "8つの工程の提出記録があります。")}</h3><p>{l("제출은 숙련도 인증이 아닙니다. 원하는 공정을 다시 열거나, 연습 방식 선택 화면의 ‘내 학습 기록’에서 판단을 복기하세요.", "Submission is not proficiency certification. Reopen any process, or review your reasoning in My practice history on the practice-options screen.", "提出は熟練度の認定ではありません。好きな工程を開き直すか、練習方法の選択画面の「自分の練習記録」で判断を振り返ってください。")}</p></>}
      <div className="process-path-filters" role="group" aria-label={l("공정 제출 상태로 모듈 보기", "View modules by submission status", "提出状況でモジュールを表示")}>
        <button className="et-linkbutton" type="button" aria-pressed={!pendingOnly} aria-controls="process-path-modules" onClick={() => setPendingOnly(false)}>{l("모든 공정", "All processes", "すべての工程")} · {saved.total}</button>
        <button className="et-linkbutton" type="button" aria-pressed={pendingOnly} aria-controls="process-path-modules" onClick={() => setPendingOnly(true)}>{l("미제출 공정만", "Unsubmitted only", "未提出の工程のみ")} · {saved.unsubmitted.length}</button>
      </div>
      <p role="status" aria-live="polite">{pendingOnly ? l(`미제출 공정 ${visible.length}개`, `Unsubmitted processes: ${visible.length}`, `未提出の工程 ${visible.length}件`) : l(`전체 공정 ${visible.length}개`, `All processes: ${visible.length}`, `すべての工程 ${visible.length}件`)}</p>
    </section> : userId !== null ? <div className="process-path-load"><p role="status">{progress.isError ? l("완료 기록을 불러오지 못했지만 모든 훈련은 선택할 수 있습니다.", "Completion records could not load, but all exercises remain available.", "完了記録を読み込めませんでしたが、すべての訓練を選択できます。") : l("제출 기록을 확인하는 중… 기록 확인 전에도 모든 공정을 선택할 수 있습니다.", "Checking submission records… You can choose any process while records load.", "提出記録を確認中…確認中でもすべての工程を選べます。")}</p>{progress.isError ? <button type="button" className="et-linkbutton" disabled={progress.isFetching} onClick={() => { void progress.refetch(); }}>{l("제출 기록 다시 불러오기", "Reload submission records", "提出記録を再読み込み")}</button> : null}</div> : null}
    <ol id="process-path-modules" className="process-path-grid">{visible.map(scenario => <li className="et-panel process-path-card" key={scenario.id}>
      <div className="process-path-number"><span>{String(scenario.order).padStart(2, "0")}</span><span>{saved ? saved.scenarioIds.includes(scenario.id) ? l("제출 완료", "Submitted", "提出済み") : l("미제출", "Unsubmitted", "未提出") : l("자유 선택", "Open to choose", "自由に選択")}</span></div>
      <h3>{l(...scenario.title)}</h3><p className="et-caption">{l(...scenario.equipment)}</p><p>{l(...scenario.objective)}</p>
      <p className="et-caption">{l("공개 장비 사례", "Public equipment example", "公開装置の例")} · {processEquipment[scenario.processId].name}</p>
      {scenario.processId === "etch" ? <button className="et-linkbutton" type="button" onClick={onEtch}>{l("공정 훈련 열기 →", "Open process training →", "工程訓練へ →")}</button> : <Link className="et-linkbutton" href={scenarioHref(scenario)}>{l("공정 훈련 열기 →", "Open process training →", "工程訓練へ →")}</Link>}
    </li>)}</ol>
    {saved && pendingOnly && !visible.length ? <p>{l("미제출 공정이 없습니다. ‘모든 공정’을 선택하면 원하는 연습을 다시 열 수 있습니다.", "No unsubmitted processes remain. Select All processes to reopen any exercise.", "未提出の工程はありません。「すべての工程」を選ぶと好きな練習を開き直せます。")}</p> : null}
    <p className="et-caption">{l("제출 완료는 학습 기록일 뿐 현장 역량 인증이 아닙니다. 데이터·참고 범위·시간축은 SemiGuard가 만든 교육용 가상 기록입니다.", "Submission is a learning record, not professional certification. Data, reference ranges and timelines are synthetic teaching records created by SemiGuard.", "提出完了は学習記録であり、現場能力の認定ではありません。データ、参照範囲、時間軸はSemiGuardが作成した教育用仮想記録です。")}</p>
    {userId === null ? <p className="et-caption">{l("비로그인 상태에서도 훈련할 수 있습니다. 계정별 완료 기록은 로그인 후 제출한 훈련만 저장됩니다.", "You can practice as a guest. Account completion records include only exercises submitted while signed in.", "ログインせずに練習できます。アカウントの完了記録にはログイン中に提出した訓練のみ保存します。")}</p> : null}
  </section>;
}
