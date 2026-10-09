import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ENV } from "./_core/env";
import { createJudgmentCoach } from "./judgmentCoach";
import { getProcessScenario } from "../shared/processScenarios";
import type { JudgmentCoachRequest } from "../shared/judgmentCoach";

const original = { ...ENV };
const lightning = "nvidia/nemotron-3.5-lightning-30b-a3b";
const fetchMock = vi.fn();
const input = (language: "ko" | "en" | "ja" = "ko"): JudgmentCoachRequest => ({
  consent: true, scenarioId: getProcessScenario("wafer")!.id, language, elapsed: 90, submitted: true, marker: null,
  answer: { signal: "surface", onset: "45", comparison: "same-condition", certainty: "uncertain",
    facts: "가상 표면 기록은 참고보다 높아졌고 두께 기록은 참고 범위 안에 있었습니다.",
    checks: "같은 조건과 위치의 가상 표면 참고 기록과 같은 시점의 두께 기록을 비교하겠습니다." },
});
const output = (request: JudgmentCoachRequest) => ({ reflections: [
  { answerSource: "facts", focusQuote: request.answer.facts.slice(0, 20),
    analysis: request.language === "ko" ? "표면 편차 지수와 두께 검사 지수의 서로 다른 관찰 결과를 구분했으며 같은 조건의 정상 참고가 그 근거입니다."
      : request.language === "ja" ? "表面偏差指数と厚さ検査指数の異なる観察結果を区別しています。同じ条件の参考記録が根拠です。"
        : "You distinguish the surface observation from thickness staying in range; the matching virtual reference supports that distinction.",
    question: request.language === "ko" ? "두께 검사 지수가 참고 범위 안에서 유지되는지 어떤 가상 기록으로 확인할까요?"
      : request.language === "ja" ? "厚さ検査指数が参考範囲内に維持されたか、どの仮想記録で確認しますか？"
        : "Which virtual records show whether Thickness inspection index stayed within the reference range?" },
  { answerSource: "checks", focusQuote: request.answer.checks.slice(0, 20),
    analysis: request.language === "ko" ? "같은 시점의 표면과 두께 기록을 비교하는 계획을 세웠지만 계획과 실제로 확인한 결과는 구분해야 합니다."
      : request.language === "ja" ? "同じ時点の記録を比較する計画がありますが、計画と確認済みの結果を区別する必要があります。"
        : "You plan a same-time comparison; keep that plan separate from an observed comparison result.",
    question: request.language === "ko" ? "어떤 가상 비교 결과가 지금 판단을 뒷받침하거나 수정할 근거가 될까요?"
      : request.language === "ja" ? "どの仮想比較結果が判断を裏付け、または見直す根拠になりますか？"
        : "Which virtual comparison result would support or revise your judgment?" },
] });
const response = (content: string, finish_reason = "stop") => new Response(JSON.stringify({
  id: "synthetic-qa", created: 1, model: ENV.nvidiaModel,
  choices: [{ index: 0, message: { role: "assistant", content }, finish_reason }],
}), { status: 200 });
beforeEach(() => {
  Object.assign(ENV, original, { aiProvider: "nvidia", nvidiaApiKey: "synthetic-transport-key", nvidiaModel: lightning });
  fetchMock.mockReset(); vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});
afterEach(() => { Object.assign(ENV, original); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });

describe("judgment coach Lightning transport without hosted JSON mode", () => {
  it.each(["ko", "en", "ja"] as const)("keeps the %s contract and trusted evidence through the real provider adapter", async language => {
    const request = input(language); const before = structuredClone(request);
    fetchMock.mockResolvedValue(response(JSON.stringify(output(request))));
    const result = await createJudgmentCoach()(27, request);
    expect(result).toMatchObject({ status: "ready", provider: "nvidia", model: lightning, language });
    expect(request).toEqual(before); expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]; const body = JSON.parse(init.body);
    expect(url).toBe("https://integrate.api.nvidia.com/v1/chat/completions");
    expect(body).not.toHaveProperty("response_format");
    expect(body).toMatchObject({ model: lightning, stream: false, max_tokens: 1800, temperature: 0.1, chat_template_kwargs: { enable_thinking: false } });
    expect(init.redirect).toBe("error"); expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(body.messages[0].content).toContain("exactly four keys");
    expect(body.messages[0].content).toContain('"hasReferenceRangeExcursion":false');
    const user = JSON.parse(body.messages[1].content);
    expect(user.learnerAnswer).not.toHaveProperty("onset");
    expect(user.learnerAnswer.facts).toBe(request.answer.facts);
    expect(user.reflectionFields).toEqual(["answerSource", "focusQuote", "analysis", "question"]);
    expect(JSON.stringify(result)).not.toContain("synthetic-transport-key");
    expect(console.warn).not.toHaveBeenCalled();
  });
  it("preserves the existing JSON mode for another configured model", async () => {
    ENV.nvidiaModel = "nvidia/qa-other"; const request = input();
    fetchMock.mockResolvedValue(response(JSON.stringify(output(request))));
    expect((await createJudgmentCoach()(27, request)).status).toBe("ready");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).response_format).toEqual({ type: "json_object" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it.each(["not JSON", '{"reflections":[]}', JSON.stringify({ reflections: output(input()).reflections, extra: "not allowed" })])("rejects invalid plain output without a fallback or retry", async text => {
    fetchMock.mockResolvedValue(response(text)); const request = input(); const before = structuredClone(request);
    expect(await createJudgmentCoach()(27, request)).toEqual({ status: "unavailable", reason: "invalid-response" });
    expect(fetchMock).toHaveBeenCalledTimes(1); expect(request).toEqual(before);
    expect(JSON.stringify(vi.mocked(console.warn).mock.calls)).not.toContain(text);
  });
  it("retains the range-premise backstop in plain mode", async () => {
    const request = input(); const data = output(request);
    data.reflections[0].question = "두께 검사 지수가 참고 범위를 벗어난 시점은 언제인가요?";
    fetchMock.mockResolvedValue(response(JSON.stringify(data)));
    expect(await createJudgmentCoach()(27, request)).toEqual({ status: "unavailable", reason: "invalid-response" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(console.warn).toHaveBeenCalledWith(JSON.stringify({ event: "judgment_coach_unavailable", reason: "invalid-response", category: "range-premise" }));
  });
  it("retains the original timeout and per-account cooldown without automatic provider retries", async () => {
    vi.useFakeTimers(); const timeout = vi.spyOn(AbortSignal, "timeout").mockImplementation(ms => {
      const controller = new AbortController(); setTimeout(() => controller.abort(new DOMException("Timed out", "TimeoutError")), ms); return controller.signal;
    });
    fetchMock.mockImplementation((_url, init) => new Promise((_resolve, reject) => init.signal.addEventListener("abort", () => reject(init.signal.reason), { once: true })));
    const read = createJudgmentCoach(); const request = input(); const pending = read(27, request);
    await vi.advanceTimersByTimeAsync(40_000);
    expect(await pending).toEqual({ status: "unavailable", reason: "provider-error" });
    expect(timeout).toHaveBeenCalledWith(40_000); expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(await read(27, request)).toEqual({ status: "unavailable", reason: "cooldown", retryAfterSeconds: 20 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(console.warn).toHaveBeenCalledWith(JSON.stringify({ event: "judgment_coach_unavailable", reason: "provider-error", category: "timeout" }));
  });
});
