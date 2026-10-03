import { useEffect, useState } from "react";
import { Link } from "wouter";
import { trpc } from "../lib/trpc";
import { tr, useProductLanguage } from "../lib/productLanguage";
import ProductLanguageSelect from "../components/ProductLanguageSelect";
import { getProcessScenario, scenarioHref } from "../../../shared/processScenarios";
import { etchSignalName } from "../lib/etchLanguage";
import "./etch-training.css";

export default function SharedTraining() {
  const [language, setLanguage] = useProductLanguage();
  const l = (ko: string, en: string, ja: string) => tr(language, ko, en, ja);
  const [token, setToken] = useState(() => window.location.hash.slice(1));
  useEffect(() => { const update = () => setToken(window.location.hash.slice(1)); window.addEventListener("hashchange", update); return () => window.removeEventListener("hashchange", update); }, []);
  useEffect(() => { document.title = l("SemiGuard — 공유된 판단 결과", "SemiGuard — Shared reasoning", "SemiGuard — 共有された判断結果"); }, [language]);
  const valid = token.length >= 100 && token.length <= 3000;
  const query = trpc.training.shared.useQuery({ token }, { enabled: valid, retry: false, staleTime: 0 });
  const record = query.data?.record;
  const scenario = record ? getProcessScenario(record.scenarioId) : undefined;
  const signalName = record && scenario ? record.signal === "none" ? l("차이 없음", "No deviation", "差異なし") : scenario.processId === "etch" ? etchSignalName(language, record.signal as "pressure" | "flow" | "rf" | "temperature") : l(...scenario.signals.find(s => s.id === record.signal)!.name) : "";
  return <div className="et-app"><header className="et-header"><Link className="et-brand" href="/training"><b>SG</b> SemiGuard</Link><ProductLanguageSelect language={language} onChange={setLanguage} /></header><main className="et-main">
    <p className="et-eyebrow">SHARED CHOICES / READ ONLY</p><h1>{l("공유된 판단 결과", "Shared reasoning result", "共有された判断結果")}</h1>
    {!valid || query.isError ? <p role="alert">{l("유효하지 않거나 만료된 공유 링크입니다.", "This share link is invalid or expired.", "共有リンクが無効か、有効期限が切れています。")}</p> : query.isLoading ? <p role="status">{l("불러오는 중…", "Loading…", "読み込み中…")}</p> : record && scenario ? <section className="et-panel"><h2>{l(...scenario.title)}</h2>
      <dl><dt>{l("선택한 관측 항목", "Chosen observation", "選択した観測項目")}</dt><dd>{signalName}</dd><dt>{l("판단한 변화 시작", "Estimated onset", "判断した変化開始")}</dt><dd>{record.onset < 0 ? l("해당 없음", "Not applicable", "該当なし") : `${record.onset}${l("초", "s", "秒")}`}</dd>
        <dt>{l("선택한 표시 시점", "Selected marker", "選択した印の時点")}</dt><dd>{record.marker === null ? l("없음", "None", "なし") : `${record.marker}${l("초", "s", "秒")}`}</dd>
        <dt>{l("비교 기준", "Comparison basis", "比較基準")}</dt><dd>{record.comparison === "whole-run" ? l("전체 기록", "Whole record", "全体の記録") : l("같은 단계·조건의 정상 참고", "Same-phase/condition normal reference", "同じ段階・条件の正常参照")}</dd>
        <dt>{l("원인 확정 판단", "Cause certainty", "原因確定の判断")}</dt><dd>{record.certainty === "uncertain" ? l("추가 비교 필요", "Further comparison needed", "追加比較が必要") : l("확정 가능을 선택함", "Selected: can confirm", "確定可能を選択")}</dd></dl>
      <h3>{l("선택형 구성 기준과 비교", "Comparison with teaching criteria", "選択式の構成基準との比較")}</h3><ul>{[record.signalMatched, record.onsetMatched, record.comparisonMatched, record.certaintyMatched].map((value, i) => <li key={i}>{[l("관측 항목", "Observation", "観測項目"), l("시작 시점", "Onset", "開始時点"), l("비교 기준", "Reference", "比較基準"), l("사실과 추정", "Fact / inference", "事実と推測")][i]} · {value ? l("일치", "Matches", "一致") : l("다시 비교", "Revisit", "再度比較")}</li>)}</ul>
      <p className="et-caption">{l("공유자가 선택한 답안의 복사본입니다. 계정 정보나 서술형 답변은 없으며 원본을 수정할 수 없습니다. 현장 역량 인증이나 실제 고장 진단이 아닙니다.", "A snapshot of selected answers. No account or written-answer information is included, and the original cannot be edited. Not a proficiency certification or actual diagnosis.", "共有者が選択した回答のコピーです。アカウント情報・記述回答を含まず、原本は編集できません。現場能力の認定や実際の故障診断ではありません。")}</p>
      <p>{l("만료", "Expires", "有効期限")} · {new Date(query.data!.expiresAt).toLocaleString(language)}</p><Link className="et-linkbutton" href={scenarioHref(scenario)}>{l("나도 이 공정 연습하기", "Try this process exercise", "自分もこの工程を練習")}</Link>
    </section> : null}
  </main></div>;
}
