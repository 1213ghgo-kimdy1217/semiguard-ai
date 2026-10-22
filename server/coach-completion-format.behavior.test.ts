import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ENV } from "./_core/env";
import { createJudgmentCoach } from "./judgmentCoach";
import type { JudgmentCoachRequest } from "../shared/judgmentCoach";
import { getProcessScenario } from "../shared/processScenarios";

const original = { ...ENV };
const syntheticModel = "nvidia/nemotron-3.5-lightning-30b-a3b";
const request: JudgmentCoachRequest = {
  consent: true, scenarioId: "etch-chamber-a-01", language: "ko", elapsed: 180,
  submitted: true, marker: 80,
  answer: { signal: "pressure", onset: "70", comparison: "same-phase", certainty: "uncertain",
    facts: "단계 B의 압력 추이가 정상 참고보다 높아졌습니다.",
    checks: "같은 시점의 유량과 RF 가상 기록을 먼저 비교하겠습니다." },
};
const feedback = () => ({ reflections: [
  { answerSource: "facts", focusQuote: request.answer.facts.slice(0, 16),
    analysis: "압력 추이와 같은 단계의 정상 참고를 연결했지만 변화가 지속되는지 기존 기록에서 비교할 필요가 있습니다.",
    question: "압력과 같은 단계의 정상 참고를 비교하면 어떤 차이가 보이나요?" },
  { answerSource: "checks", focusQuote: request.answer.checks.slice(0, 16),
    analysis: "같은 시점의 다른 기록을 비교하는 계획이 있으며 실제 비교 결과와 계획을 구분할 필요가 있습니다.",
    question: "어떤 가상 비교 결과가 지금 판단을 뒷받침하거나 바꿀까요?" },
] });
const fence = (json: string) => "```json\n" + json + "\n```";
const fetchMock = vi.fn();
beforeEach(() => {
  Object.assign(ENV, original, { aiProvider: "nvidia", nvidiaApiKey: "synthetic-format-key", nvidiaModel: syntheticModel });
  vi.stubGlobal("fetch", fetchMock); fetchMock.mockReset();
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});
afterEach(() => { Object.assign(ENV, original); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

async function run(content: string) {
  fetchMock.mockResolvedValue(new Response(JSON.stringify({ id: "synthetic-format-response", created: 1,
    model: syntheticModel, choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }],
  }), { status: 200 }));
  return createJudgmentCoach()(900001, structuredClone(request));
}

describe("plain completion formatting through the real coach/provider boundary", () => {
  it.each(["plain", "json-fence", "crlf-fence"])("accepts %s without altering validated feedback or learner text", async format => {
    const data = feedback(); const json = JSON.stringify(data);
    const content = format === "plain" ? json : format === "crlf-fence"
      ? " \r\n```JSON\r\n" + json + "\r\n```\r\n " : fence(json);
    const before = structuredClone(request);
    const result = await run(content);
    expect(result).toMatchObject({ status: "ready", provider: "nvidia", model: syntheticModel,
      feedback: { reflections: data.reflections.map(item => ({ analysis: item.analysis, question: item.question, focusQuote: item.focusQuote.trim() })) } });
    expect(request).toEqual(before);
    if (result.status === "ready") expect(result.feedback.reflections.map(item => item.answerQuote))
      .toEqual([request.answer.facts, request.answer.checks]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).not.toHaveProperty("response_format");
    expect(console.warn).not.toHaveBeenCalled();
  });

  it.each(["extra-field", "wrong-quote", "unsafe", "numeric-claim", "wrong-language", "third-reflection", "range-premise"])("still rejects fenced %s", async failure => {
    const data = feedback();
    if (failure === "extra-field") Object.assign(data.reflections[0], { answerQuote: "not server owned" });
    if (failure === "wrong-quote") data.reflections[0].focusQuote = "not in the learner answer";
    if (failure === "unsafe") data.reflections[0].question = "장비 정지 후 교체 작업을 진행할까요?";
    if (failure === "numeric-claim") data.reflections[0].analysis = "가상 압력은 80초에 반드시 변화하기 시작했으므로 관찰 기록과 일치합니다.";
    if (failure === "wrong-language") data.reflections[0].question = "Which matching virtual record would you compare?";
    if (failure === "third-reflection") data.reflections.push({ ...data.reflections[0] });
    if (failure === "range-premise") data.reflections[0].question = `${getProcessScenario("etch")!.signals.find(signal => signal.id === "flow")!.name[0]}가 정상 참고 범위를 벗어난 때는 언제인가요?`;
    expect(await run(fence(JSON.stringify(data)))).toEqual({ status: "unavailable", reason: "invalid-response" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const logs = JSON.stringify(vi.mocked(console.warn).mock.calls);
    expect(logs).not.toContain(request.answer.facts);
    expect(logs).not.toContain(data.reflections[0].question);
    expect(logs).not.toContain("synthetic-format-key");
  });

  it.each([
    (json: string) => "Here is the response:\n" + fence(json),
    (json: string) => fence(json) + "\nFurther explanation",
    (json: string) => fence(json) + "\n" + fence(json),
    (json: string) => "```json\n" + json,
    () => fence('{"reflections": [}'),
    () => fence(JSON.stringify({ reflections: [{ ...feedback().reflections[0], analysis: "가상 기록 비교 ".repeat(1000) }, feedback().reflections[1]] })),
  ])("does not extract, repair, retry or substitute malformed/mixed output %#", async wrap => {
    expect(await run(wrap(JSON.stringify(feedback())))).toEqual({ status: "unavailable", reason: "invalid-response" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(vi.mocked(console.warn).mock.calls)).not.toContain(request.answer.facts);
  });
});
