import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createJudgmentCoach } from "./judgmentCoach";
import { ENV } from "./_core/env";

const original = { ...ENV };
const fetchMock = vi.fn();
const request = {
  consent: true, scenarioId: "etch-chamber-a-01", language: "ko", elapsed: 180,
  submitted: true, marker: 70,
  answer: { signal: "pressure", onset: "70", comparison: "same-phase", certainty: "uncertain",
    facts: "압력이 20에서 25로 올라간 것 같지만 같은 단계의 정상 참고인지 확인해야 합니다.",
    checks: "40초와 60초 기록을 정상 참고와 비교하고 RF와 유량도 함께 보겠습니다." },
};
const draft = () => ({ reflections: [
  { answerSource: "facts", focusQuote: "압력이 20에서 25로 올라간 것 같지만",
    analysis: "압력이 20에서 25로 변했다고 적었지만 같은 단계의 정상 참고와 비교할 근거가 더 필요합니다.",
    question: "같은 단계의 압력과 정상 참고를 비교하면 어떤 차이가 보이나요?" },
  { answerSource: "checks", focusQuote: "40초와 60초 기록을 정상 참고와 비교하고",
    analysis: "40초와 60초 기록을 비교할 계획이 있지만 같은 조건에서 비교한 결과가 아직 적혀 있지 않습니다.",
    question: "같은 시점의 유량과 RF를 비교하면 어떤 근거를 더 찾을 수 있나요?" },
] });
const corrected = () => ({ reflections: draft().reflections.map(({ focusQuote: _quote, ...item }) => ({
  ...item, analysis: "같은 단계의 정상 참고와 비교해야 한다고 적으셨습니다. 관찰과 비교 계획을 구분해서 가상 기록을 다시 살펴볼 수 있습니다.",
})) });
function response(content: unknown) {
  return new Response(JSON.stringify({ id: "synthetic", created: 1, model: ENV.nvidiaModel,
    choices: [{ index: 0, message: { role: "assistant", content: JSON.stringify(content) }, finish_reason: "stop" }],
  }));
}
beforeEach(() => {
  Object.assign(ENV, original, { aiProvider: "nvidia", nvidiaApiKey: "synthetic-repair-key" });
  fetchMock.mockReset(); vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});
afterEach(() => { Object.assign(ENV, original); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("bounded correction of numeric coaching prose", () => {
  it("repairs the production failure and restores original excerpts only on the server", async () => {
    fetchMock.mockResolvedValueOnce(response(draft())).mockResolvedValueOnce(response(corrected()));
    const before = structuredClone(request);
    const result = await createJudgmentCoach()(19, request);
    expect(result.status).toBe("ready"); expect(request).toEqual(before);
    if (result.status !== "ready") throw new Error("Expected validated feedback");
    expect(result.feedback.reflections.map(item => item.focusQuote)).toEqual(draft().reflections.map(item => item.focusQuote));
    expect(result.feedback.reflections.map(item => item.answerQuote)).toEqual([request.answer.facts, request.answer.checks]);
    const repair = JSON.parse(fetchMock.mock.calls[1][1].body);
    const draftInput = JSON.parse(repair.messages[1].content);
    expect(draftInput.reflections).toHaveLength(2);
    expect(JSON.stringify(draftInput)).not.toMatch(/[0-9０-９]|focusQuote|\[quantity\]/);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const logs = JSON.stringify(vi.mocked(console.warn).mock.calls);
    expect(logs).not.toContain(request.answer.facts); expect(logs).not.toContain("synthetic-repair-key");
  });
  it.each(["numeric", "unsafe", "range", "quote", "language"])("fully validates the %s correction and never makes a third request", async failure => {
    const data = corrected();
    if (failure === "numeric") data.reflections[0].analysis = "같은 단계의 압력은 80초부터 이상이 시작된 것으로 확정할 수 있습니다.";
    if (failure === "unsafe") data.reflections[0].question = "장비를 정지하고 부품을 교체할까요?";
    if (failure === "range") data.reflections[0].question = "가스 유량이 정상 참고 범위를 벗어난 때는 언제인가요?";
    if (failure === "quote") Object.assign(data.reflections[0], { focusQuote: "invented" });
    if (failure === "language") data.reflections[0].analysis = "You should compare the existing virtual reference before drawing a conclusion.";
    fetchMock.mockResolvedValueOnce(response(draft())).mockResolvedValueOnce(response(data));
    expect(await createJudgmentCoach()(19, request)).toEqual({ status: "unavailable", reason: "invalid-response" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
  it("bounds correction time and releases pending state when correction times out", async () => {
    const spy = vi.spyOn(AbortSignal, "timeout");
    fetchMock.mockResolvedValueOnce(response(draft())).mockRejectedValueOnce(new DOMException("timeout", "TimeoutError"));
    const coach = createJudgmentCoach();
    expect(await coach(19, request)).toEqual({ status: "unavailable", reason: "provider-error" });
    expect(spy).toHaveBeenCalledWith(20_000);
    expect(await coach(19, request)).toMatchObject({ status: "unavailable", reason: "cooldown" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
