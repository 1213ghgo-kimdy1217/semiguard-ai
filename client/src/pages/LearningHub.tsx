import { useEffect, useState } from "react";
import { Link } from "wouter";
import { processLessons, processOverviewSource } from "../../../shared/learningHub";
import EtchEquipmentReference from "../components/EtchEquipmentReference";
import "./etch-training.css";
import "./learning-hub.css";

export default function LearningHub() {
  useEffect(() => { document.title = "SemiGuard — 8대 공정 학습"; }, []);
  const [query, setQuery] = useState("");
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const lessons = processLessons.filter(p => (p.title + p.english + p.equipment).toLowerCase().includes(query.trim().toLowerCase()));
  return <div className="et-app lh-app">
    <header className="et-header"><Link className="et-brand" href="/training"><b>SG</b> SemiGuard</Link><nav aria-label="제품 메뉴"><Link href="/training">시나리오 훈련</Link><Link href="/live">자유 관찰</Link></nav></header>
    <main id="learning-main" className="et-main">
      <p className="et-eyebrow">PROCESS FIELD GUIDE</p>
      <h1>공정을 이해하면,<br />신호를 읽는 맥락이 생깁니다.</h1>
      <p>8대 공정은 입문용 분류입니다. 실제 제조에서는 여러 단계가 반복되며, 이 순서대로 한 번씩만 진행되는 것은 아닙니다.</p>
      <div className="et-panel"><h2>필요한 만큼 읽고 관찰로 이동하세요.</h2><p>장비 운전 지침이 아닌 개념 학습입니다. 관찰 질문과 자가 확인은 SemiGuard가 구성한 학습 보조이며 실제 작업 자격이나 숙련도 평가가 아닙니다.</p><Link className="et-linkbutton" href="/training">학습을 건너뛰고 Scenario 01 시작 →</Link></div>
      <label className="lh-search">공정·장비 검색<input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="예: 식각, Etch, 노광" /></label>
      <p role="status">{lessons.length}개 공정</p>
      <div className="lh-grid">{lessons.map(p => <article className="et-panel" key={p.id} id={p.id}>
        <p className="et-eyebrow">{String(processLessons.indexOf(p) + 1).padStart(2, "0")} / {p.english}</p>
        <h2>{p.title}</h2><p>{p.concept}</p>
        <details><summary>{p.title} 더 알아보기</summary>
          <h3>대표 장비 유형</h3><p>{p.equipment}</p>
          <h3>관찰할 때 던질 질문</h3><p>{p.observe}</p>
          <h3>구분해야 할 점</h3><p>{p.misconception}</p>
          <fieldset><legend>{p.question}</legend>{p.options.map((option, index) => <label className="lh-option" key={option}><input type="radio" name={p.id} checked={answers[p.id] === index} onChange={() => setAnswers(a => ({ ...a, [p.id]: index }))} />{option}</label>)}</fieldset>
          <div aria-live="polite">{answers[p.id] !== undefined && <p className="lh-feedback">{answers[p.id] === p.answer ? "맞습니다. " : "다시 생각해 보세요. "}{p.misconception}</p>}</div>
          {p.id === "etch" ? <Link className="et-linkbutton" href="/training">식각 Scenario 01에서 관찰하기 →</Link> : <p className="et-caption">개념 학습만 제공 · 이 공정의 관찰 시나리오는 아직 없습니다.</p>}
        </details>
      </article>)}</div>
      {!lessons.length && <p>검색 결과가 없습니다. 다른 공정명으로 검색해 주세요.</p>}
      <EtchEquipmentReference />
      <section className="et-panel"><h2>원문과 학습 범위</h2><p>공정 개념은 삼성반도체의 8대 공정 공개 자료를 바탕으로 요약했습니다. 개별 공정의 상세 원문은 아래 공식 안내에서 확인할 수 있습니다. 실제 운전 조건·정비 절차·위험 물질 취급법은 제공하지 않습니다.</p><a href={processOverviewSource} target="_blank" rel="noopener noreferrer">삼성반도체 8대 공정 공식 자료 ↗ (새 탭)</a></section>
    </main>
  </div>;
}
