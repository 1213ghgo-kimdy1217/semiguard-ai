import { describe, expect, it } from "vitest";
import { emptyEtchAttempt, etchBaseline, etchEvidence, etchFeedback, etchSample, etchSamples, etchSignals, restoreEtchAttempt, setEtchMarker, toggleEtchMarker, validEtchAnswer } from "../shared/etchScenario";
const answer = { signal: "pressure", onset: "70", comparison: "same-phase", certainty: "uncertain", facts: "같은 단계의 압력 기록에서 지속 편차가 관찰되었습니다.", checks: "측정 기록과 같은 단계의 운전 맥락을 추가로 확인합니다." };
describe("etch scenario", () => {
  it("marks a chosen past time, moves and cancels it without changing answers", () => {
    const initial = { ...emptyEtchAttempt(), elapsed: 100, answer };
    const marked = setEtchMarker(initial, 30);
    expect(marked.marker).toBe(30);
    expect(marked.elapsed).toBe(100);
    expect(marked.answer).toBe(answer);
    expect(restoreEtchAttempt(JSON.stringify(marked))?.marker).toBe(30);
    expect(setEtchMarker(marked, 50).marker).toBe(50);
    expect(setEtchMarker(marked, 100).marker).toBe(100);
    expect(setEtchMarker(marked, 0).marker).toBe(0);
    expect(setEtchMarker(marked, null).marker).toBeNull();
    for (const invalid of [-1, 101, 1.5, NaN]) expect(setEtchMarker(marked, invalid)).toBe(marked);
    const submitted = { ...marked, submitted: true };
    expect(setEtchMarker(submitted, 20)).toBe(submitted);
    expect(setEtchMarker(submitted, null)).toBe(submitted);
  });
  it("compares all sensors at the same observed time without leaking future samples", () => {
    const rows = etchEvidence(140, 80);
    expect(rows).toHaveLength(4);
    expect(rows.every(row => row.time === 80 && row.phase === "B")).toBe(true);
    for (const row of rows) {
      expect(row.value).toBe(etchSample(row.id, 80).value);
      expect(row.difference).toBe(row.value - row.reference);
      expect(row.low).toBe(96);
      expect(row.high).toBe(104);
    }
    expect(etchEvidence(39, 180).every(row => row.phase === "A" && row.low === 76)).toBe(true);
    expect(etchEvidence(-5, 180)[0].time).toBe(0);
    expect(etchEvidence(999, 999)[0].time).toBe(180);
    expect(etchEvidence(NaN, 180)[0].time).toBe(0);
  });
  it("records, cancels and re-records a discovery without changing the answer", () => {
    const initial = { ...emptyEtchAttempt(), elapsed: 0, answer: { ...answer, onset: "0" } };
    const marked = toggleEtchMarker(initial);
    expect(marked.marker).toBe(0);
    expect(initial.marker).toBeNull();
    const canceled = toggleEtchMarker({ ...marked, elapsed: 20 });
    expect(canceled.marker).toBeNull();
    expect(restoreEtchAttempt(JSON.stringify(canceled))?.marker).toBeNull();
    const recordedAgain = toggleEtchMarker({ ...canceled, elapsed: 45 });
    expect(recordedAgain.marker).toBe(45);
    expect(recordedAgain.answer).toBe(initial.answer);
    expect(restoreEtchAttempt(JSON.stringify(recordedAgain))?.marker).toBe(45);
    const submitted = { ...recordedAgain, elapsed: 180, submitted: true };
    expect(toggleEtchMarker(submitted)).toBe(submitted);
  });
  it("reproduces samples and exposes no future observations", () => {
    expect(etchSamples("pressure", 12)).toHaveLength(13);
    expect(etchSamples("pressure", 12)).toEqual(etchSamples("pressure", 12));
    expect(etchSamples("pressure", 12).at(-1)?.time).toBe(12);
    expect(etchSamples("pressure", 999)).toHaveLength(181);
  });
  it("changes the phase baseline without creating a normal transition anomaly", () => {
    expect(etchBaseline(39)).toBe(80); expect(etchBaseline(40)).toBe(100);
    for (const s of etchSignals) { const p = etchSample(s.id, 40); expect(p.value).toBeGreaterThan(p.low); expect(p.value).toBeLessThan(p.high); }
  });
  it("makes only pressure drift later", () => {
    expect(etchSample("pressure", 140).value).toBeGreaterThan(etchSample("pressure", 140).high);
    for (const s of etchSignals.filter(s => s.id !== "pressure")) expect(etchSamples(s.id, 180).every(p => p.value >= p.low && p.value <= p.high)).toBe(true);
  });
  it("validates structured answers but does not grade prose semantics", () => {
    expect(validEtchAnswer(answer)).toBe(true); expect(etchFeedback(answer).every(r => r.ok)).toBe(true);
    expect(validEtchAnswer({ ...answer, onset: "999" })).toBe(false);
    expect(validEtchAnswer({ ...answer, facts: " " })).toBe(false);
    expect(etchFeedback({ ...answer, certainty: "certain" }).at(-1)?.ok).toBe(false);
  });
  it("restores only bounded versioned attempts and complete submissions", () => {
    expect(restoreEtchAttempt("bad")).toBeNull();
    expect(restoreEtchAttempt(JSON.stringify({ ...emptyEtchAttempt(), elapsed: -1 }))).toBeNull();
    expect(restoreEtchAttempt(JSON.stringify({ ...emptyEtchAttempt(), marker: 20 }))).toBeNull();
    expect(restoreEtchAttempt(JSON.stringify({ ...emptyEtchAttempt(), submitted: true }))?.submitted).toBe(false);
    expect(restoreEtchAttempt(JSON.stringify({ version: 1, elapsed: 180, marker: 90, answer, submitted: true }))?.submitted).toBe(true);
    expect(restoreEtchAttempt(JSON.stringify({ version: 1, elapsed: 50, marker: null, answer, submitted: true }))).toBeNull();
  });
});
