import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { validateCoachOutput } from "./judgmentCoach";

const answer = { signal: "pressure", onset: "70", comparison: "same-phase" as const, certainty: "uncertain" as const,
  facts: "단계 B의 압력 추이가 정상 참고보다 높아졌습니다.", checks: "같은 시점의 유량과 RF 가상 기록을 먼저 비교하겠습니다." };
const feedback = () => ({ reflections: [
  { dimension: "reference", evidenceId: "phase-reference", answerSource: "facts", focusQuote: "정상 참고보다 높아졌습니다",
    analysis: "압력과 정상 참고의 차이를 관찰하셨습니다. 다만 어느 구간을 같은 단계의 참고와 비교했는지는 이 문장만으로 알 수 없습니다.",
    question: "단계 B의 앞뒤 압력 기록에서 어떤 비교 결과가 이 관찰을 뒷받침하나요?" },
  { dimension: "checks", evidenceId: "record-comparison", answerSource: "checks", focusQuote: "같은 시점의 유량과 RF",
    analysis: "같은 시점의 다른 신호를 비교하는 계획은 적혀 있습니다. 비교 후 압력만 달라지는지 함께 달라지는지를 어떻게 판단에 반영할지는 아직 쓰지 않았습니다.",
    question: "유량과 RF가 참고 띠 안에 있을 때 압력의 관찰과 원인 추정을 어떻게 구분하겠습니까?" },
] });

describe("personalized coaching feedback", () => {
  it("returns model-authored analysis and a verbatim answer excerpt, not just a generic question", () => {
    const result = validateCoachOutput(JSON.stringify(feedback()), answer);
    expect(result.reflections[0]).toMatchObject({ analysis: feedback().reflections[0].analysis,
      focusQuote: feedback().reflections[0].focusQuote, answerQuote: answer.facts });
  });
  it("does not accept the old question-only response as personalized coaching", () => {
    const old = { reflections: feedback().reflections.map(({ analysis, focusQuote, ...item }) => item) };
    expect(() => validateCoachOutput(JSON.stringify(old), answer)).toThrow();
  });
  it("rejects an invented or cross-field answer excerpt instead of fabricating a replacement", () => {
    for (const focusQuote of ["압력은 완전히 정상입니다", "같은 시점의 유량과 RF"]) {
      const data = feedback(); data.reflections[0].focusQuote = focusQuote;
      expect(() => validateCoachOutput(JSON.stringify(data), answer)).toThrow("Invalid answer excerpt");
    }
  });
  it("applies the existing safety and causal-exclusion checks to analysis too", () => {
    for (const analysis of ["장비를 분해하고 부품을 교체하세요.", "가상 기록만으로 고장 원인을 배제할 수 있습니다."]) {
      const data = feedback(); data.reflections[0].analysis = analysis;
      expect(() => validateCoachOutput(JSON.stringify(data), answer)).toThrow();
    }
  });
  it("rejects analysis in a different language without rewriting it", () => {
    const data = feedback(); data.reflections[0].analysis = "The supplied answer still needs a condition-matched comparison result.";
    expect(() => validateCoachOutput(JSON.stringify(data), answer, "ko")).toThrow("Unexpected coaching language");
  });
  it("rejects empty or unbounded analysis rather than substituting fixed text", () => {
    for (const analysis of ["", " ", "가".repeat(451)]) {
      const data = feedback(); data.reflections[0].analysis = analysis;
      expect(() => validateCoachOutput(JSON.stringify(data), answer)).toThrow();
    }
  });
  it("rejects duplicate answer sources even when the dimensions differ", () => {
    const data = feedback(); data.reflections[1].answerSource = "facts"; data.reflections[1].focusQuote = "정상 참고";
    expect(() => validateCoachOutput(JSON.stringify(data), answer)).toThrow("Invalid answer excerpt");
  });
  it("can quote a learner's misconception for critique without treating it as model advice", () => {
    const data = feedback(); data.reflections[0].focusQuote = "고장 확정";
    const mistaken = { ...answer, facts: "단계 B의 압력이 높아져서 고장 확정이라고 적었습니다." };
    expect(validateCoachOutput(JSON.stringify(data), mistaken).reflections[0].focusQuote).toBe("고장 확정");
  });
  it("renders the analysis as plain text separately from the follow-up question", () => {
    const ui = readFileSync("client/src/components/ScenarioJudgmentCoach.tsx", "utf8");
    expect(ui).toContain("{item.analysis}");
    expect(ui).toContain("{item.focusQuote}");
    expect(ui).not.toContain("dangerouslySetInnerHTML");
  });
});
