export const ETCH_STORAGE_KEY = "semiguard.etch.scenario01.v1";
export const ETCH_DURATION = 180;
export const etchSignals = [
  { id: "pressure", name: "챔버 압력", location: "챔버 내부 · 교육용 관측 위치" },
  { id: "flow", name: "가스 유량", location: "공급 계통 · 교육용 관측 위치" },
  { id: "rf", name: "RF 전력", location: "전력 계통 · 교육용 관측 위치" },
  { id: "temperature", name: "온도", location: "챔버 주변 · 웨이퍼 실측 온도 아님" },
] as const;
export type EtchSignal = typeof etchSignals[number]["id"];
export type EtchAnswer = { signal: string; onset: string; comparison: string; certainty: string; facts: string; checks: string };
export type EtchAttempt = { version: 1; elapsed: number; marker: number | null; answer: EtchAnswer; submitted: boolean };
export const emptyEtchAttempt = (): EtchAttempt => ({ version: 1, elapsed: 0, marker: null, submitted: false, answer: { signal: "", onset: "", comparison: "", certainty: "", facts: "", checks: "" } });
export function toggleEtchMarker(attempt: EtchAttempt): EtchAttempt {
  if (attempt.submitted) return attempt;
  return { ...attempt, marker: attempt.marker === null ? attempt.elapsed : null };
}
export function setEtchMarker(attempt: EtchAttempt, time: number | null): EtchAttempt {
  if (attempt.submitted || (time !== null && (!Number.isInteger(time) || time < 0 || time > attempt.elapsed))) return attempt;
  return { ...attempt, marker: time };
}
export function etchPhase(time: number) { return time < 40 ? "A" : "B"; }
export function etchBaseline(time: number) { return etchPhase(time) === "A" ? 80 : 100; }
export function etchSample(signal: EtchSignal, time: number) {
  const t = Math.max(0, Math.min(ETCH_DURATION, Math.floor(time)));
  const index = etchSignals.findIndex(s => s.id === signal);
  const reference = etchBaseline(t) + Math.sin(t * .3 + index) * .6;
  const drift = signal === "pressure" && t >= 70 ? Math.min(22, (t - 70) * .4) : 0;
  return { time: t, phase: etchPhase(t), reference, value: etchBaseline(t) + Math.sin(t * .35 + index) * .7 + drift, low: etchBaseline(t) - 4, high: etchBaseline(t) + 4 };
}
export function etchSamples(signal: EtchSignal, until: number) {
  return Array.from({ length: Math.floor(Math.max(0, Math.min(ETCH_DURATION, until))) + 1 }, (_, t) => etchSample(signal, t));
}
export function etchEvidence(time: number, observedUntil: number) {
  const boundedTime = Math.max(0, Math.min(ETCH_DURATION, Math.floor(Number.isFinite(observedUntil) ? observedUntil : 0), Math.floor(Number.isFinite(time) ? time : 0)));
  return etchSignals.map(signal => {
    const sample = etchSample(signal.id, boundedTime);
    return { ...signal, ...sample, difference: sample.value - sample.reference };
  });
}
export function validEtchAnswer(a: EtchAnswer) {
  return etchSignals.some(s => s.id === a.signal) && /^(0|[1-9]\d{0,2})$/.test(a.onset) && Number(a.onset) <= ETCH_DURATION &&
    ["same-phase", "whole-run"].includes(a.comparison) && ["uncertain", "certain"].includes(a.certainty) &&
    [a.facts, a.checks].every(t => t.trim().length >= 10 && t.length <= 1200);
}
export function restoreEtchAttempt(raw: string | null): EtchAttempt | null {
  try {
    const v = JSON.parse(raw || "null"); const a = v?.answer;
    if (v?.version !== 1 || !Number.isInteger(v.elapsed) || v.elapsed < 0 || v.elapsed > ETCH_DURATION ||
      !(v.marker === null || (Number.isInteger(v.marker) && v.marker >= 0 && v.marker <= v.elapsed)) ||
      !a || !["signal", "onset", "comparison", "certainty", "facts", "checks"].every(k => typeof a[k] === "string" && a[k].length <= 1200)) return null;
    if (a.signal && !etchSignals.some(s => s.id === a.signal)) return null;
    if (a.onset && (!/^(0|[1-9]\d{0,2})$/.test(a.onset) || Number(a.onset) > v.elapsed)) return null;
    if (a.comparison && !["same-phase", "whole-run"].includes(a.comparison)) return null;
    if (a.certainty && !["uncertain", "certain"].includes(a.certainty)) return null;
    return { version: 1, elapsed: v.elapsed, marker: v.marker, answer: a, submitted: v.submitted === true && v.elapsed === ETCH_DURATION && validEtchAnswer(a) };
  } catch { return null; }
}
export function etchFeedback(a: EtchAnswer) {
  if (!validEtchAnswer(a)) throw new Error("판단 항목을 모두 작성해 주세요.");
  return [
    { title: "signal", label: "주요 변화", ok: a.signal === "pressure", detail: "이 교육 시나리오에서는 단계 B를 유지하는 동안 압력의 지속 편차가 나타납니다." },
    { title: "onset", label: "변화 시작 구간", ok: Number(a.onset) >= 65 && Number(a.onset) <= 80, detail: "70초부터 추세 변화가 시작되도록 구성했습니다. 기준 범위 이탈과 추세 시작은 다른 시점입니다." },
    { title: "comparison", label: "같은 단계의 기준 비교", ok: a.comparison === "same-phase", detail: "40초의 단계 전환은 기준 자체가 바뀌는 정상 변화입니다. 같은 단계·같은 진행 위치의 기록끼리 비교합니다." },
    { title: "certainty", label: "사실과 추정 구분", ok: a.certainty === "uncertain", detail: "압력의 편차는 관찰 사실입니다. 이 데이터만으로 특정 부품의 고장을 확정할 수 없습니다." },
  ];
}
