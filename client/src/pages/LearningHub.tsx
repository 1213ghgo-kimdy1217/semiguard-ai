import { useEffect, useState } from "react";
import { Link } from "wouter";
import { processLessons, processOverviewSource } from "../../../shared/learningHub";
import EtchEquipmentReference from "../components/EtchEquipmentReference";
import ProductLanguageSelect from "../components/ProductLanguageSelect";
import { localizeLesson } from "../lib/learningLanguage";
import { tr, useProductLanguage } from "../lib/productLanguage";
import "./etch-training.css";
import "./learning-hub.css";

export default function LearningHub() {
  const [language, setLanguage] = useProductLanguage();
  const l = (ko: string, en: string, ja: string) => tr(language, ko, en, ja);
  useEffect(() => { document.title = l("SemiGuard — 8대 공정 학습", "SemiGuard — Eight semiconductor processes", "SemiGuard — 8大工程の学習"); }, [language]);
  const [query, setQuery] = useState("");
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const lessons = processLessons.map(p => localizeLesson(language, p)).filter(p => (p.title + p.english + p.equipment + processLessons.find(source => source.id === p.id)?.title).toLowerCase().includes(query.trim().toLowerCase()));
  return <div className="et-app lh-app">
    <header className="et-header"><Link className="et-brand" href="/training"><b>SG</b> SemiGuard</Link><nav aria-label={l("제품 메뉴", "Product navigation", "製品メニュー")}><Link href="/training">{l("시나리오 훈련", "Scenario training", "シナリオ訓練")}</Link><Link href="/live">{l("자유 관찰", "Free observation", "自由観察")}</Link><ProductLanguageSelect language={language} onChange={setLanguage} /></nav></header>
    <main id="learning-main" className="et-main">
      <p className="et-eyebrow">PROCESS FIELD GUIDE</p>
      <h1>{l("공정을 이해하면,", "Understand the process,", "工程を理解すると、")}<br />{l("신호를 읽는 맥락이 생깁니다.", "then interpret the signal in context.", "信号を読む文脈が見えてきます。")}</h1>
      <p>{l("8대 공정은 입문용 분류입니다. 실제 제조에서는 여러 단계가 반복되며, 이 순서대로 한 번씩만 진행되는 것은 아닙니다.", "The eight processes are an introductory grouping. Real manufacturing repeats many steps; they do not occur just once in this exact order.", "8大工程は入門用の分類です。実際の製造では多くの段階が繰り返され、この順序で一度ずつ進むわけではありません。")}</p>
      <div className="et-panel"><h2>{l("필요한 만큼 읽고 관찰로 이동하세요.", "Read what you need, then start observing.", "必要なところを読み、観察へ進みましょう。")}</h2><p>{l("장비 운전 지침이 아닌 개념 학습입니다. 관찰 질문과 자가 확인은 SemiGuard가 구성한 학습 보조이며 실제 작업 자격이나 숙련도 평가가 아닙니다.", "This is concept learning, not operating instruction. SemiGuard's observation prompts and self-checks do not assess workplace qualifications or proficiency.", "装置の運転指示ではなく概念学習です。観察質問と自己確認はSemiGuardが作成した学習補助であり、実作業の資格や熟練度評価ではありません。")}</p><Link className="et-linkbutton" href="/training">{l("학습을 건너뛰고 Scenario 01 시작 →", "Skip learning and start Scenario 01 →", "学習を飛ばしてScenario 01を始める →")}</Link></div>
      <label className="lh-search">{l("공정·장비 검색", "Search processes and equipment", "工程・装置を検索")}<input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder={l("예: 식각, Etch, 노광", "e.g., Etch, lithography", "例：エッチング、露光")} /></label>
      <p role="status">{lessons.length} {l("개 공정", "processes", "工程")}</p>
      <div className="lh-grid">{lessons.map(p => <article className="et-panel" key={p.id} id={p.id}>
        <p className="et-eyebrow">{String(processLessons.findIndex(source => source.id === p.id) + 1).padStart(2, "0")} / {p.english}</p>
        <h2>{p.title}</h2><p>{p.concept}</p>
        <details><summary>{p.title} {l("더 알아보기", "details", "詳細を見る")}</summary>
          <h3>{l("대표 장비 유형", "Typical equipment types", "代表的な装置の種類")}</h3><p>{p.equipment}</p>
          <h3>{l("관찰할 때 던질 질문", "Observation prompt", "観察時の問い")}</h3><p>{p.observe}</p>
          <h3>{l("구분해야 할 점", "Key distinction", "区別すべき点")}</h3><p>{p.misconception}</p>
          <fieldset><legend>{p.question}</legend>{p.options.map((option, index) => <label className="lh-option" key={option}><input type="radio" name={p.id} checked={answers[p.id] === index} onChange={() => setAnswers(a => ({ ...a, [p.id]: index }))} />{option}</label>)}</fieldset>
          <div aria-live="polite">{answers[p.id] !== undefined && <p className="lh-feedback">{answers[p.id] === p.answer ? l("맞습니다. ", "Correct. ", "正解です。") : l("다시 생각해 보세요. ", "Consider again. ", "もう一度考えてみましょう。")}{p.misconception}</p>}</div>
          {p.id === "etch" ? <Link className="et-linkbutton" href="/training">{l("식각 Scenario 01에서 관찰하기 →", "Observe in Etch Scenario 01 →", "エッチングScenario 01で観察する →")}</Link> : <p className="et-caption">{l("개념 학습만 제공 · 이 공정의 관찰 시나리오는 아직 없습니다.", "Concept learning only · no observation scenario for this process yet.", "概念学習のみ・この工程の観察シナリオはまだありません。")}</p>}
        </details>
      </article>)}</div>
      {!lessons.length && <p>{l("검색 결과가 없습니다. 다른 공정명으로 검색해 주세요.", "No results. Try another process name.", "検索結果がありません。別の工程名で検索してください。")}</p>}
      <EtchEquipmentReference language={language} />
      <section className="et-panel"><h2>{l("원문과 학습 범위", "Source and learning scope", "原文と学習範囲")}</h2><p>{l("공정 개념은 삼성반도체의 8대 공정 공개 자료를 바탕으로 요약했습니다. 개별 공정의 상세 원문은 아래 공식 안내에서 확인할 수 있습니다. 실제 운전 조건·정비 절차·위험 물질 취급법은 제공하지 않습니다.", "Process concepts are summarized from Samsung Semiconductor's public guide to the eight processes. See the official source below for details. We do not provide actual operating conditions, maintenance procedures, or hazardous-material handling instructions.", "工程の概念はSamsung Semiconductorの公開資料を基に要約しています。詳細な原文は下記の公式案内で確認できます。実際の運転条件、整備手順、危険物質の取扱方法は提供しません。")}</p><a href={processOverviewSource} target="_blank" rel="noopener noreferrer">{l("삼성반도체 8대 공정 공식 자료 ↗ (새 탭)", "Samsung Semiconductor's official eight-process guide ↗ (new tab)", "Samsung Semiconductorの8大工程公式資料 ↗（新しいタブ）")}</a></section>
    </main>
  </div>;
}
