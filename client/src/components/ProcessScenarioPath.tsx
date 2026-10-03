import { Link } from "wouter";
import { processScenarios, scenarioHref } from "../../../shared/processScenarios";
import { tr, type ProductLanguage } from "../lib/productLanguage";
import { trpc } from "../lib/trpc";
import "./process-scenario-path.css";

export default function ProcessScenarioPath({ language, userId, onEtch }: {
  language: ProductLanguage; userId: number | null; onEtch: () => void;
}) {
  const l = (ko: string, en: string, ja: string) => tr(language, ko, en, ja);
  const progress = trpc.training.progress.useQuery(undefined, { enabled: userId !== null, retry: false });
  // Query caches may still contain another account's result during an account change.
  const savedIds = progress.data?.userId === userId ? progress.data.scenarioIds : [];
  const completed = processScenarios.filter(scenario => savedIds.includes(scenario.id)).length;
  return <section className="process-path" aria-labelledby="process-path-heading">
    <div className="process-path-head"><div>
      <p className="et-eyebrow">EIGHT PROCESSES / EIGHT JUDGMENT TASKS</p>
      <h2 id="process-path-heading">{l("8개 공정을 따라 판단을 연습하세요.", "Practice judgment across eight processes.", "8つの工程で判断を練習しましょう。")}</h2>
    </div>{userId !== null && progress.data?.userId === userId ? <p className="process-path-count">{completed}/8 <span>{l("공정 제출 완료", "processes submitted", "工程を提出済み")}</span></p> : null}</div>
    <p>{l("순서대로 배우거나 필요한 공정부터 선택할 수 있습니다. 모든 단계가 고장 상황인 것은 아닙니다. 실제 제조는 여러 공정을 반복하며, 아래 순서는 입문용 학습 경로입니다.", "Follow the order or choose any process. Not every task is a fault situation. Real manufacturing repeats processes; this is an introductory learning path.", "順番に学ぶことも、必要な工程から選ぶこともできます。すべてが故障の状況ではありません。実際の製造では工程が繰り返され、この順序は入門用の学習経路です。")}</p>
    <ol className="process-path-grid">{processScenarios.map(scenario => <li className="et-panel process-path-card" key={scenario.id}>
      <div className="process-path-number"><span>{String(scenario.order).padStart(2, "0")}</span><span>{savedIds.includes(scenario.id) ? l("제출 완료", "Submitted", "提出済み") : l("자유 선택", "Open to choose", "自由に選択")}</span></div>
      <h3>{l(...scenario.title)}</h3><p className="et-caption">{l(...scenario.equipment)}</p><p>{l(...scenario.objective)}</p>
      {scenario.processId === "etch" ? <button className="et-linkbutton" type="button" onClick={onEtch}>{l("공정 훈련 열기 →", "Open process training →", "工程訓練へ →")}</button> : <Link className="et-linkbutton" href={scenarioHref(scenario)}>{l("공정 훈련 열기 →", "Open process training →", "工程訓練へ →")}</Link>}
    </li>)}</ol>
    <p className="et-caption">{l("제출 완료는 학습 기록일 뿐 현장 역량 인증이 아닙니다. 데이터·참고 범위·시간축은 SemiGuard가 만든 교육용 가상 기록입니다.", "Submission is a learning record, not professional certification. Data, reference ranges and timelines are synthetic teaching records created by SemiGuard.", "提出完了は学習記録であり、現場能力の認定ではありません。データ、参照範囲、時間軸はSemiGuardが作成した教育用仮想記録です。")}</p>
    {userId === null ? <p className="et-caption">{l("비로그인 상태에서도 훈련할 수 있습니다. 계정별 완료 기록은 로그인 후 제출한 훈련만 저장됩니다.", "You can practice as a guest. Account completion records include only exercises submitted while signed in.", "ログインせずに練習できます。アカウントの完了記録にはログイン中に提出した訓練のみ保存します。")}</p> : progress.isError ? <p role="status">{l("완료 기록을 불러오지 못했지만 모든 훈련은 선택할 수 있습니다.", "Completion records could not load, but all exercises remain available.", "完了記録を読み込めませんでしたが、すべての訓練を選択できます。")}</p> : null}
  </section>;
}
