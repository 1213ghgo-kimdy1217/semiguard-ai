import { useState } from "react";
import { Link } from "wouter";
import { trpc } from "../lib/trpc";
import { kstDay, measurementPeriodSchema } from "../../../shared/practiceMeasurement";
import PracticeMeasurementConsent from "../components/PracticeMeasurement";
import "./etch-training.css";

export default function PracticeMetrics() {
  const auth = trpc.auth.me.useQuery(undefined, { retry: false });
  const admin = auth.data?.role === "admin";
  const [start, setStart] = useState(kstDay);
  const [end, setEnd] = useState(kstDay);
  const [period, setPeriod] = useState({ start: kstDay(), end: kstDay() });
  const valid = measurementPeriodSchema.safeParse({ start, end }).success;
  const storage = trpc.practiceMeasurement.storage.useQuery(undefined, { enabled: admin, retry: false });
  const report = trpc.practiceMeasurement.report.useQuery(period, { enabled: admin && storage.data?.ready === true, retry: false, refetchOnWindowFocus: false });
  const data = report.data;
  return <div className="et-app"><main className="et-main">
    <Link href="/training" className="et-back">← 학습·연습 선택</Link>
    <h1>연습 이용 측정 · 운영자 전용</h1>
    <p className="et-lead">동의한 브라우저의 집계입니다. 실제 사람 수·학습 효과·현장 숙련도를 뜻하지 않습니다.</p>
    {!admin ? <p role="status">{auth.isLoading ? "운영자 권한을 확인하고 있습니다." : "운영자 계정으로 로그인해야 집계를 볼 수 있습니다."}</p> : <>
      <p role="status">운영 DB 준비: {storage.isLoading ? "확인 중" : storage.data?.ready ? "열·인덱스 확인 완료" : "확인되지 않음 — 측정 시작 불가"}</p>
      <PracticeMeasurementConsent />
      <form className="sg-metrics-form" onSubmit={e => { e.preventDefault(); if (!valid) return; setPeriod({ start, end }); if (period.start === start && period.end === end) void report.refetch(); }}>
        <label>시작일 (한국 시간)<input aria-label="시작일" type="date" value={start} onChange={e => setStart(e.target.value)} /></label>
        <label>종료일 (포함)<input aria-label="종료일" type="date" value={end} onChange={e => setEnd(e.target.value)} /></label>
        <button className="et-linkbutton" disabled={!valid || !storage.data?.ready || report.isFetching}>집계 확인</button>
      </form>
      {!valid ? <p role="alert">시작일부터 종료일까지 1–31일의 올바른 날짜를 선택하세요.</p> : null}
      {report.isError ? <p role="status">집계를 확인하지 못했습니다. 0명으로 표시하지 않습니다.</p> : data ? <section className="et-panel">
        <h2>{period.start} ~ {period.end} · 동의 브라우저</h2>
        <table className="sg-metrics-table"><thead><tr><th scope="col">단계</th><th scope="col">중복 제외 브라우저 수</th></tr></thead><tbody>
          <tr><th scope="row">방문</th><td>{data.visits}</td></tr><tr><th scope="row">관찰 재생 시작</th><td>{data.starts}</td></tr><tr><th scope="row">판단 제출 후 복기 표시</th><td>{data.completions}</td></tr>
        </tbody></table>
        <p>시작 대비 완료: {data.starts ? `${data.completions} / ${data.starts} (${Math.round(data.completions / data.starts * 100)}%)` : "시작 기록 없음 · 비율 미측정"}</p>
        <p>같은 기간에 시작하고 복기까지 표시한 브라우저만 완료로 셉니다. AI 응답 성공이나 계정 저장 성공을 뜻하지 않습니다. 재접속·다른 공정의 반복은 브라우저 기준으로 중복 제거합니다.</p>
        <h2>첫 주 시작 → 다음 주 다시 연습</h2>
        <p>선택한 시작일부터 7일 안에 처음 관찰 재생을 시작한 브라우저 {data.cohort}개 중, 그다음 7일에 다시 재생한 브라우저 {data.returned}개.</p>
        <p>{data.retentionMature ? data.cohort ? `다음 주 재연습률: ${Math.round(data.returned / data.cohort * 100)}%` : "첫 주 대상 없음 · 재연습률 미측정" : "두 번째 주 관찰이 아직 끝나지 않았습니다. 최종 재연습률은 미측정입니다."}</p>
        <p>다음 주 범위: {kstDay(new Date(data.week2Start).getTime())} ~ {kstDay(new Date(data.week2End).getTime() - 1)} (Asia/Seoul). 이 코호트 범위는 종료일 선택과 별개로 시작일에 맞춰 고정됩니다.</p>
        <p>팀·테스트 제외 확인: 방문 {data.qa.visits} / 시작 {data.qa.starts} / 완료 {data.qa.completions}. 위 참여 지표에는 포함하지 않습니다.</p>
        <p className="et-caption">조회: {new Date(data.observedAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}. 동의 거절자는 미포함. 기기·쿠키 변경은 중복될 수 있으며 팀·테스트 제외는 본인의 선택에 따릅니다. 실제 참여자 수와 인터뷰 증거는 별도로 확인하세요.</p>
      </section> : report.isFetching ? <p role="status">집계 확인 중…</p> : null}
    </>}
  </main></div>;
}
