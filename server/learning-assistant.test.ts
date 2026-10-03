import { beforeEach, describe, expect, it, vi } from "vitest";
import { learningQuestionSchema } from "../shared/learningAssistant";
import { createLearningAssistant, validateLearningAnswer } from "./learningAssistant";
import { appRouter } from "./routers";
const mocks = vi.hoisted(() => ({
  invoke: vi.fn(), env: { nvidiaApiKey: "configured-test-value", aiProvider: "nvidia", nvidiaModel: "test/model" },
}));
vi.mock("./_core/llm", () => ({ invokeLLM: mocks.invoke }));
vi.mock("./_core/env", () => ({ ENV: mocks.env }));
const request = { consent: true, language: "ko", question: "정상 참고와 어떻게 비교하나요?" };
const answer = { answer: "같은 조건의 정상 참고 기록과 현재 기록을 비교하고, 같은 시점의 다른 항목도 함께 확인하세요.", destination: "learn" };
const response = () => ({ provider: "nvidia", model: "test/model", choices: [{ message: { content: JSON.stringify(answer) } }] });
describe("learning assistant", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.env.aiProvider = "nvidia"; mocks.invoke.mockResolvedValue(response()); });
  it("blocks anonymous questions and record details before reaching providers or storage", async () => {
    const caller = appRouter.createCaller({ user: null, req: {}, res: {} } as any);
    await expect(caller.learning.ask(request as any)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.training.detail({ id: 8 })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(mocks.invoke).not.toHaveBeenCalled();
  });
  it("requires explicit consent, bounded input, and no caller identity or history", () => {
    for (const raw of [{ ...request, consent: false }, { ...request, question: "a" }, { ...request, question: "a".repeat(801) },
      { ...request, userId: 2 }, { ...request, history: [] }, { ...request, language: "de" }]) expect(learningQuestionSchema.safeParse(raw).success).toBe(false);
  });
  it("sends only the current question as untrusted data, returns actual provider, and throttles repeat requests", async () => {
    const ask = createLearningAssistant();
    expect(await ask(7, request)).toEqual({ status: "ready", provider: "nvidia", model: "test/model", ...answer });
    const payload = mocks.invoke.mock.calls[0][0];
    expect(JSON.parse(payload.messages[1].content)).toEqual({ question: request.question });
    expect(payload.messages[0].content).toContain("teenage");
    expect(payload.messages[0].content).toContain("No exact scenario onset times");
    expect(await ask(7, request)).toEqual({ status: "unavailable", reason: "cooldown" });
    expect(mocks.invoke).toHaveBeenCalledTimes(1);
  });
  it("does not call a different configured provider or pretend it is AI", async () => {
    mocks.env.aiProvider = "manus";
    expect(await createLearningAssistant()(7, request)).toEqual({ status: "unavailable", reason: "not-configured" });
    expect(mocks.invoke).not.toHaveBeenCalled();
  });
  it("rejects upstream errors, wrong provider, invalid JSON, untrusted links, secrets and practical equipment actions", async () => {
    for (const content of ["bad JSON", JSON.stringify({ ...answer, destination: "https://example.com" }),
      JSON.stringify({ ...answer, answer: "장비 압력을 조절하세요. 센서가 정상으로 보일 것입니다." }),
      JSON.stringify({ ...answer, answer: "Use this https://example.com for your equipment." }),
      JSON.stringify({ ...answer, answer: "NVIDIA_API_KEY should be printed here." })]) {
      mocks.invoke.mockResolvedValue({ ...response(), choices: [{ message: { content } }] });
      expect(await createLearningAssistant()(7, request)).toEqual({ status: "unavailable", reason: "invalid-response" });
    }
    mocks.invoke.mockResolvedValue({ ...response(), provider: "manus" });
    expect(await createLearningAssistant()(7, request)).toEqual({ status: "unavailable", reason: "invalid-response" });
    mocks.invoke.mockRejectedValue(new Error("upstream"));
    expect(await createLearningAssistant()(7, request)).toEqual({ status: "unavailable", reason: "provider-error" });
  });
  it("validates all three output languages and strict schema", () => {
    expect(validateLearningAnswer(JSON.stringify(answer), "ko")).toEqual(answer);
    expect(() => validateLearningAnswer(JSON.stringify(answer), "en")).toThrow();
    expect(validateLearningAnswer(JSON.stringify({ answer: "Compare the same conditions and other virtual signals.", destination: "none" }), "en").destination).toBe("none");
    expect(validateLearningAnswer(JSON.stringify({ answer: "同じ条件の正常参照と仮想記録を比較しましょう。", destination: "learn" }), "ja").destination).toBe("learn");
    expect(() => validateLearningAnswer(JSON.stringify({ ...answer, extra: true }), "ko")).toThrow();
  });
  it("logs bounded failure categories without provider bodies, keys or questions", async () => {
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    mocks.invoke.mockRejectedValueOnce(new Error("LLM nvidia request failed (HTTP 401)"));
    expect(await createLearningAssistant()(7, request)).toEqual({ status: "unavailable", reason: "provider-error" });
    expect(warning).toHaveBeenLastCalledWith("[Learning assistant] Provider unavailable (HTTP 401)");
    mocks.invoke.mockRejectedValueOnce(new Error("secret-value user-question upstream-body"));
    await createLearningAssistant()(7, request);
    expect(warning).toHaveBeenLastCalledWith("[Learning assistant] Provider unavailable (provider-error)");
    expect(JSON.stringify(warning.mock.calls)).not.toMatch(/secret-value|user-question|upstream-body/);
    warning.mockRestore();
  });
  it("classifies rejected JSON and guards without recording generated content", async () => {
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    mocks.invoke.mockResolvedValueOnce({ ...response(), choices: [{ message: { content: "private-answer-not-json" } }] });
    await createLearningAssistant()(7, request);
    expect(warning).toHaveBeenLastCalledWith("[Learning assistant] Invalid response (json)");
    mocks.invoke.mockResolvedValueOnce({ ...response(), choices: [{ message: { content: JSON.stringify({ ...answer, answer: "NVIDIA_API_KEY private-answer" }) } }] });
    await createLearningAssistant()(7, request);
    expect(warning).toHaveBeenLastCalledWith("[Learning assistant] Invalid response (content-guard)");
    expect(JSON.stringify(warning.mock.calls)).not.toContain("private-answer");
    warning.mockRestore();
  });
});
