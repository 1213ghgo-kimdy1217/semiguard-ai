import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { etchSample, type EtchSignal } from "../shared/etchScenario";
import { getProcessScenario, processSample, processScenarios } from "../shared/processScenarios";
import type { JudgmentCoachRequest } from "../shared/judgmentCoach";
import { ENV } from "./_core/env";
import { invokeLLM } from "./_core/llm";
import { createJudgmentCoach, scenarioCoachContext, validateCoachOutput } from "./judgmentCoach";
import { coachRangeEvidence, hasUnsupportedRangeQuestion } from "./coachRangeEvidence";

vi.mock("./_core/llm", () => ({ invokeLLM: vi.fn() }));
const original = { ...ENV };
const request = (processId = "wafer", language: "ko" | "en" | "ja" = "ko"): JudgmentCoachRequest => {
  const scenario = getProcessScenario(processId)!;
  return { consent: true, scenarioId: scenario.id, language, elapsed: scenario.duration, submitted: true, marker: null,
    answer: { signal: scenario.expectedSignal, onset: scenario.changeTime === null ? "none" : String(scenario.changeTime),
      comparison: processId === "etch" ? "same-phase" : "same-condition", certainty: "uncertain",
      facts: "가상 기록을 같은 조건의 정상 참고와 비교해서 관찰한 사실을 작성했습니다.",
      checks: "같은 시점의 다른 가상 기록을 비교할 계획이며 아직 그 결과를 기록하지 않았습니다." } };
};
const feedback = (input: JudgmentCoachRequest, question: string) => ({ reflections: [
  { answerSource: "facts", focusQuote: input.answer.facts,
    analysis: input.language === "en" ? "Compare the named signal with its matching virtual reference before interpreting the observation."
      : input.language === "ja" ? "観察内容を解釈する前に、該当する仮想信号を同じ条件の参考記録と比較してください。"
        : "관찰 내용을 해석하기 전에 해당 가상 신호와 같은 조건의 정상 참고를 함께 비교해야 합니다.", question },
  { answerSource: "checks", focusQuote: input.answer.checks,
    analysis: input.language === "en" ? "The written comparison is a plan; it is not yet an observed comparison result."
      : input.language === "ja" ? "記載された比較は計画であり、まだ観察された比較結果ではありません。"
        : "작성한 비교는 계획이며 아직 관찰된 비교 결과가 아니므로 그 결과를 확인할 근거가 필요합니다.",
    question: input.language === "en" ? "Which virtual comparison result would support or revise your judgment?"
      : input.language === "ja" ? "どの仮想比較結果が判断を裏付け、または見直す根拠になりますか？"
        : "어떤 가상 비교 결과가 현재 판단을 뒷받침하거나 수정할 근거가 되나요?" },
] });
beforeEach(() => {
  Object.assign(ENV, original, { aiProvider: "nvidia", nvidiaApiKey: "synthetic-qa-key", nvidiaModel: "nvidia/qa" });
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});
afterEach(() => { Object.assign(ENV, original); vi.restoreAllMocks(); vi.clearAllMocks(); });

describe("full virtual record range evidence and question premises", () => {
  it.each(processScenarios)("derives $processId flags from all original chart records without an onset answer key", scenario => {
    const evidence = coachRangeEvidence(scenario.id);
    expect(evidence.scope).toContain("one-second synthetic chart");
    expect(evidence.signals).toEqual(scenario.signals.map(({ id }) => {
      const samples = Array.from({ length: scenario.duration + 1 }, (_, time) => scenario.processId === "etch"
        ? etchSample(id as EtchSignal, time) : processSample(scenario, id, time));
      const inside = (sample: typeof samples[number]) => sample.value >= sample.low && sample.value <= sample.high;
      return { id, hasReferenceRangeExcursion: samples.some(sample => !inside(sample)), endsWithinReferenceRange: inside(samples.at(-1)!) };
    }));
    expect(evidence).not.toHaveProperty("changeTime");
    expect(evidence).not.toHaveProperty("events");
    expect(JSON.stringify(evidence)).not.toMatch(/onsetMatched|signalMatched|focusQuote|question/);
  });
  it("does not confuse normal reference-stage changes or final recovery with an absent earlier excursion", () => {
    expect(coachRangeEvidence(getProcessScenario("oxidation")!.id).signals.every(signal => !signal.hasReferenceRangeExcursion && signal.endsWithinReferenceRange)).toBe(true);
    for (const processId of ["photo", "packaging"]) {
      const scenario = getProcessScenario(processId)!;
      expect(coachRangeEvidence(scenario.id).signals.find(signal => signal.id === scenario.expectedSignal))
        .toMatchObject({ hasReferenceRangeExcursion: true, endsWithinReferenceRange: true });
    }
    expect(coachRangeEvidence(getProcessScenario("etch")!.id).signals.find(signal => signal.id === "flow"))
      .toMatchObject({ hasReferenceRangeExcursion: false, endsWithinReferenceRange: true });
  });
  it.each(["ko", "en", "ja"] as const)("sends factual range flags in %s without changing original answers or adding model answer templates", async language => {
    const input = request("wafer", language); const before = structuredClone(input);
    const question = language === "en" ? "What reference comparison supports your observation?"
      : language === "ja" ? "どの参考比較が観察の根拠になりますか？" : "어떤 정상 참고 비교가 관찰을 뒷받침하나요?";
    vi.mocked(invokeLLM).mockResolvedValue({ provider: "nvidia", model: "nvidia/qa", choices: [{ message: { content: JSON.stringify(feedback(input, question)) } }] } as never);
    expect((await createJudgmentCoach()(27, input)).status).toBe("ready");
    expect(input).toEqual(before); expect(invokeLLM).toHaveBeenCalledTimes(1);
    const payload = vi.mocked(invokeLLM).mock.calls[0][0];
    const system = payload.messages[0].content as string;
    const context = JSON.parse(system.split("Trusted scenario context: ")[1]);
    expect(context.rangeEvidence).toEqual(coachRangeEvidence(input.scenarioId));
    expect(context.rangeEvidence.signals).toContainEqual({ id: "thickness", hasReferenceRangeExcursion: false, endsWithinReferenceRange: true });
    expect(system).toContain("never ask when it left or returned");
    expect(context).not.toHaveProperty("choiceCriteria");
    expect(system).not.toContain(question);
    expect(console.warn).not.toHaveBeenCalled();
  });
  it.each([
    ["ko", "두께 검사 지수가 참고 범위 밖으로 벗어난 시점은 언제인가요?"],
    ["ko", "표면 편차 지수가 정상 참고보다 높아진 시점과 두께 검사 지수가 참고 범위 밖으로 벗어난 시점은 각각 언제인가요?"],
    ["ko", "두께 검사 지수는 언제 참고 범위를 벗어났나요?"],
    ["ko", "두께 검사 지수가 참고 띠로 복귀한 시점은 언제인가요?"],
    ["en", "When did Thickness inspection index leave the reference range?"],
    ["en", "When did Surface deviation index cross the reference band and Thickness inspection index leave the reference range?"],
    ["en", "At what point did Thickness inspection index return to the normal band?"],
    ["ja", "厚さ検査指数が基準帯から外れた時点はいつですか？"],
    ["ja", "厚さ検査指数はいつ参考範囲を超えたのですか？"],
  ] as const)("rejects the unsupported %s excursion-time question instead of displaying or rewriting it: %s", async (language, question) => {
    const input = request("wafer", language); const before = structuredClone(input);
    const data = feedback(input, question);
    expect(hasUnsupportedRangeQuestion(question, language, input.scenarioId)).toBe(true);
    expect(() => validateCoachOutput(JSON.stringify(data), input.answer, language, input.scenarioId)).toThrow("Unsupported range premise");
    vi.mocked(invokeLLM).mockResolvedValue({ provider: "nvidia", model: "nvidia/qa", choices: [{ message: { content: JSON.stringify(data) } }] } as never);
    expect(await createJudgmentCoach()(27, input)).toEqual({ status: "unavailable", reason: "invalid-response" });
    expect(invokeLLM).toHaveBeenCalledTimes(1);
    expect(vi.mocked(console.warn).mock.calls).toEqual([[JSON.stringify({ event: "judgment_coach_unavailable", reason: "invalid-response", category: "range-premise" })]]);
    expect(input).toEqual(before);
  });
  it.each([
    ["ko", "두께 검사 지수가 같은 조건의 참고 범위 안에 유지되는지 어떤 가상 기록으로 확인하나요?"],
    ["ko", "두께 검사 지수가 참고 범위를 벗어났는지 확인하려면 어떤 가상 기록을 비교하나요?"],
    ["ko", "두께 검사 지수의 기록과 표면 편차 지수가 참고 범위를 벗어난 시점의 기록을 어떻게 비교하나요?"],
    ["en", "Did Thickness inspection index leave the reference range, and which virtual records support your answer?"],
    ["en", "Which records show whether Thickness inspection index stayed within the reference band?"],
    ["en", "When you compare Thickness inspection index with its matching reference, did it leave the reference range?"],
    ["ja", "厚さ検査指数が基準帯内に維持されたか、どの仮想記録で確認しますか？"],
  ] as const)("preserves %s evidence/whether questions without attributing another signal's event: %s", (language, question) => {
    const input = request("wafer", language);
    expect(hasUnsupportedRangeQuestion(question, language, input.scenarioId)).toBe(false);
    expect(validateCoachOutput(JSON.stringify(feedback(input, question)), input.answer, language, input.scenarioId).reflections[0].question).toBe(question);
  });
  it("keeps an incorrect original learner claim available for critique instead of treating its quote as generated guidance", () => {
    const input = request(); input.answer.facts = "두께 검사 지수가 참고 범위 밖으로 벗어난 시점은 언제인가요?";
    const result = validateCoachOutput(JSON.stringify(feedback(input, "두께 검사 지수가 참고 띠 안에 유지되는지 어떤 기록을 확인할까요?")), input.answer, "ko", input.scenarioId);
    expect(result.reflections[0].answerQuote).toBe(input.answer.facts);
    expect(result.reflections[0].focusQuote).toBe(input.answer.facts);
  });
  it("allows genuine excursion/recovery questions while rejecting a nonexistent oxidation excursion regardless of learner choices", () => {
    const photo = request("photo"); const question = "패턴 위치 지수가 참고 범위를 벗어난 시점과 복귀한 기록을 어떻게 비교하나요?";
    expect(hasUnsupportedRangeQuestion(question, "ko", photo.scenarioId)).toBe(false);
    expect(validateCoachOutput(JSON.stringify(feedback(photo, question)), photo.answer, "ko", photo.scenarioId).reflections[0].question).toBe(question);
    const oxidation = request("oxidation"); const name = getProcessScenario("oxidation")!.signals[0].name[0];
    expect(hasUnsupportedRangeQuestion(`${name}가 참고 범위를 벗어난 시점은 언제인가요?`, "ko", oxidation.scenarioId)).toBe(true);
    const context = scenarioCoachContext({ ...oxidation, answer: { ...oxidation.answer, signal: "film", onset: "30" } });
    expect(context.rangeEvidence).toEqual(coachRangeEvidence(oxidation.scenarioId));
  });
});
