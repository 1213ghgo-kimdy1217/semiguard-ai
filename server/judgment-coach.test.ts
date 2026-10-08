import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { ENV } from "./_core/env";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { createJudgmentCoach, scenarioCoachContext, validateCoachOutput } from "./judgmentCoach";
import { judgmentCoachRequestSchema, toJudgmentCoachRequest, toProcessJudgmentCoachRequest } from "../shared/judgmentCoach";
import { emptyEtchAttempt } from "../shared/etchScenario";
import { emptyProcessAttempt, processSample, processScenarios, type ProcessScenario } from "../shared/processScenarios";

const original = { ...ENV };
const input = () => ({ consent: true as const, scenarioId: "etch-chamber-a-01" as const, language: "ko" as const,
  elapsed: 180 as const, submitted: true as const, marker: 80,
  answer: { signal: "pressure" as const, onset: "70", comparison: "same-phase" as const, certainty: "uncertain" as const,
    facts: "단계 B의 압력 추이가 정상 참고보다 높아졌습니다.", checks: "같은 시점의 유량과 RF 가상 기록을 먼저 비교하겠습니다." } });
const processInput = (scenario: ProcessScenario) => toProcessJudgmentCoachRequest({ ...emptyProcessAttempt(scenario),
  elapsed: scenario.duration, submitted: true, marker: 45, saveKey: "must-not-be-transmitted",
  answer: { signal: scenario.expectedSignal, onset: scenario.changeTime === null ? "none" : String(scenario.changeTime),
    comparison: "same-condition", certainty: "uncertain", facts: "같은 조건의 여러 가상 기록을 비교해 관찰 내용을 작성했습니다.",
    checks: "기존 가상 참고 기록과 같은 시점의 다른 항목을 차례로 비교합니다." } }, "ko");
const output = (language: "ko" | "en" | "ja" = "ko", answer = input().answer as { facts: string; checks: string }) => ({ reflections: [
  { dimension: "reference", evidenceId: "phase-reference", answerSource: "facts" as const, focusQuote: answer.facts.slice(0, 32),
    analysis: language === "ko" ? "관찰 내용을 작성했지만 같은 단계의 참고와 어떤 결과를 비교했는지 더 살펴볼 필요가 있습니다." : language === "ja" ? "観察内容は記載されていますが、同じ段階の参照とどの結果を比較したかを確認する必要があります。" : "Your observation needs an explicit comparison result against the matching phase reference.",
    question: language === "ko" ? "같은 시점의 어떤 정상 참고 기록을 비교하겠습니까?" : language === "ja" ? "同じ時点のどの正常参照を比較しますか？" : "Which normal reference point would you compare at that time?" },
  { dimension: "checks", evidenceId: "record-comparison", answerSource: "checks" as const, focusQuote: answer.checks.slice(0, 32),
    analysis: language === "ko" ? "비교 계획을 관찰 결과와 구분하고 그 결과가 판단을 어떻게 바꾸는지 연결할 필요가 있습니다." : language === "ja" ? "比較計画と観察結果を区別し、その結果が判断をどう変えるかを確認する必要があります。" : "Separate the proposed comparison from its result and consider how that result could revise your judgment.",
    question: language === "ko" ? "비교 순서를 정할 때 어떤 가상 기록을 확인하겠습니까?" : language === "ja" ? "比較順序を決める際にどの仮想記録を確認しますか？" : "What existing virtual evidence would help you choose the comparison order?" },
] });
const response = (text = JSON.stringify(output()), model = "nvidia/qa", finish_reason = "stop") => new Response(JSON.stringify({
  id: "synthetic", created: 1, model, choices: [{ index: 0, message: { role: "assistant", content: text }, finish_reason }],
}), { status: 200 });
let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  Object.assign(ENV, original, { aiProvider: "nvidia", nvidiaApiKey: "synthetic-private-key", nvidiaModel: "nvidia/qa" });
  fetchMock = vi.fn().mockImplementation(async (_url, init) => {
    const payload = JSON.parse(init.body); const request = JSON.parse(payload.messages[1].content);
    const language = request.responseLanguage === "English" ? "en" : request.responseLanguage === "Japanese" ? "ja" : "ko";
    return response(JSON.stringify(output(language, request.learnerAnswer)));
  });
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});
afterEach(() => { Object.assign(ENV, original); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("scenario judgment coach", () => {
  it("sends only an explicitly consented completed answer and server-derived synthetic evidence to NVIDIA", async () => {
    const result = await createJudgmentCoach()(27, input());
    expect(result).toMatchObject({ status: "ready", provider: "nvidia", model: "nvidia/qa", language: "ko" });
    const [url, init] = fetchMock.mock.calls[0]; const payload = JSON.parse(init.body);
    expect(url).toBe("https://integrate.api.nvidia.com/v1/chat/completions");
    expect(payload.stream).toBe(false); expect(payload.max_tokens).toBe(1800);
    expect(payload.temperature).toBe(0.1);
    expect(payload.response_format).toEqual({ type: "json_object" });
    expect(payload.messages[0].content).toContain("Korean");
    expect(payload.messages[0].content).toContain("untrusted data");
    expect(payload.messages[0].content).toContain("existing VIRTUAL records");
    expect(payload.messages[0].content).toContain("An unconfirmed cause is not an excluded cause");
    expect(payload.messages[0].content).toContain("pressure-trend");
    expect(JSON.parse(payload.messages[1].content)).toMatchObject({ learnerAnswer: input().answer, chartMarker: 80, responseLanguage: "Korean" });
    expect(JSON.stringify(payload)).not.toMatch(/userId|badgeNumber|dateOfBirth|email|synthetic-private-key/);
    expect(JSON.stringify(result)).not.toContain("synthetic-private-key");
  });
  it.each(["en", "ja"] as const)("requests %s without auto-translating or changing choices", async language => {
    fetchMock.mockResolvedValue(response(JSON.stringify(output(language))));
    expect((await createJudgmentCoach()(27, { ...input(), language })).status).toBe("ready");
    const payload = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(payload.messages[0].content).toContain(language === "en" ? "English" : "Japanese");
    expect(JSON.parse(payload.messages[1].content).learnerAnswer).toEqual(input().answer);
  });
  it.each(["ko", "en", "ja"] as const)("describes the model-only contract in %s without prewritten or empty example questions", async language => {
    fetchMock.mockResolvedValue(response(JSON.stringify(output(language))));
    expect((await createJudgmentCoach()(27, { ...input(), language })).status).toBe("ready");
    const payload = JSON.parse(fetchMock.mock.calls[0][1].body);
    const user = JSON.parse(payload.messages[1].content);
    expect(user.responseInstructions).toContain("EXACTLY dimension, evidenceId, answerSource, focusQuote, analysis, question");
    expect(user.responseInstructions).toContain("Never add answerQuote");
    expect(user).not.toHaveProperty("outputShapeExample");
    expect(user.reflectionFields).toEqual(["dimension", "evidenceId", "answerSource", "focusQuote", "analysis", "question"]);
    expect(user.reflectionAssignments).toEqual([
      { answerSource: "facts" },
      { answerSource: "checks" },
    ]);
    expect(user.reflectionAssignments.every((item: object) => !Object.hasOwn(item, "question"))).toBe(true);
    expect(user.allowedDimensionEvidencePairs).toEqual({ reference: "phase-reference", onset: "pressure-trend", "cross-sensor": "other-signals", uncertainty: "cause-unknown", checks: "record-comparison" });
    expect(user.outputCount).toContain("Exactly two reflections");
    expect(payload.messages[0].content).toContain("Only the server computes the fixed choice-criterion labels");
    expect(user.questionTask).toContain(language === "ko" ? "비교 결과" : language === "ja" ? "比較結果" : "comparison result");
    expect(payload.messages[0].content).toContain("Do not presume a deviation or an onset");
    expect(payload.messages[0].content).toContain("If the field is uninterpretable");
    expect(user.outputCount).toContain("Choose two distinct dimensions based on the actual answer");
    expect(JSON.stringify(payload)).not.toContain(output(language).reflections[0].question);
    expect(user.learnerAnswer).toEqual(input().answer);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("still rejects extra reflection fields instead of silently stripping them", () => {
    for (const field of ["answerQuote", "reasoning", "extra"]) {
      const result = { ...output(), reflections: output().reflections.map(item => ({ ...item, [field]: "extra model text" })) };
      expect(() => validateCoachOutput(JSON.stringify(result), input().answer, "ko")).toThrow();
    }
  });
  it.each([
    ["ko", "어떤 기존 가상 기록을 확인할지 묻습니다."],
    ["en", "Ask which existing virtual record supports the comparison."],
    ["ja", "どの既存の仮想記録を比較するかを尋ねます。"],
    ["ko", "어떤 가상 기록을 비교하나요? 어떤 결과를 보나요?"],
  ] as const)("rejects non-question or multiple-question output in %s without fabricating a replacement", async (language, question) => {
    const data = output(language); data.reflections[0].question = question;
    expect(() => validateCoachOutput(JSON.stringify(data), input().answer, language)).toThrow("Invalid question form");
    fetchMock.mockResolvedValue(response(JSON.stringify(data)));
    expect(await createJudgmentCoach()(27, { ...input(), language })).toEqual({ status: "unavailable", reason: "invalid-response" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(vi.mocked(console.warn).mock.calls).toEqual([[JSON.stringify({ event: "judgment_coach_unavailable", reason: "invalid-response", category: "question-form" })]]);
  });
  it.each(["en", "ja"] as const)("rejects Korean questions when %s coaching was requested", async language => {
    fetchMock.mockResolvedValue(response(JSON.stringify(output())));
    expect(await createJudgmentCoach()(27, { ...input(), language })).toEqual({ status: "unavailable", reason: "invalid-response" });
  });
  it("requires login before any model request", async () => {
    const caller = appRouter.createCaller({ user: null, req: {}, res: {} } as TrpcContext);
    await expect(caller.training.coach(input())).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("requires login for all-time completion progress", async () => {
    const caller = appRouter.createCaller({ user: null, req: {}, res: {} } as TrpcContext);
    await expect(caller.training.progress()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
  it.each([
    { consent: false }, { elapsed: 30 }, { submitted: false }, { scenarioId: "other" },
    { marker: 181 }, { userId: 1 }, { language: "fr" },
  ])("rejects invalid or unconsented request %j before calling the provider", async change => {
    await expect(createJudgmentCoach()(27, { ...input(), ...change })).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("bounds written text and rejects extra answer fields", async () => {
    const read = createJudgmentCoach();
    for (const answer of [{ ...input().answer, facts: "x".repeat(1201) }, { ...input().answer, checks: " " }, { ...input().answer, email: "synthetic" }]) {
      await expect(read(27, { ...input(), answer })).rejects.toThrow();
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("does not silently switch to another provider", async () => {
    ENV.aiProvider = "manus";
    expect(await createJudgmentCoach()(27, input())).toEqual({ status: "unavailable", reason: "not-configured" });
    ENV.aiProvider = "nvidia"; ENV.nvidiaApiKey = "";
    expect(await createJudgmentCoach()(27, input())).toEqual({ status: "unavailable", reason: "not-configured" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("keeps choices unchanged and derives comparative samples on the server", () => {
    const context = scenarioCoachContext(input());
    expect(context.samples.map(row => row.time)).toEqual([39, 40, 60, 80, 125, 180]);
    expect(context.samples[1].signals.every(s => s.phase === "B")).toBe(true);
    expect(context.samples.at(-1)?.signals[0].current).toBeGreaterThan(120);
    expect(context.evidence["cause-unknown"]).toContain("No component fault");
  });
  it.each(processScenarios.filter(scenario => scenario.processId !== "etch"))("uses the $processId scenario's own trusted records and original quotes", async scenario => {
    const request = processInput(scenario);
    const context = scenarioCoachContext(request);
    expect(context.scope).toContain(scenario.title[1]);
    expect(context.objective).toBe(scenario.objective[1]);
    expect(context.signalDefinitions).toEqual(scenario.signals.map(({ id, name, location }) => ({ id, name: name[1], location: location[1] })));
    expect(context.scope).toContain("relative indices");
    expect(context.evidence["phase-reference"]).toContain(scenario.referenceRule[1]);
    expect(context.samples.flatMap(row => row.signals.map(signal => signal.id))).toEqual(
      context.samples.flatMap(() => scenario.signals.map(signal => signal.id)));
    const finalSample = processSample(scenario, scenario.signals[0].id, scenario.duration);
    expect(context.samples.at(-1)?.signals[0].current).toBe(Number(finalSample.value.toFixed(1)));
    expect(context.supportedStrengths).toEqual(["signal", "reference", "uncertainty"]);
    const result = await createJudgmentCoach()(27, request);
    expect(result.status).toBe("ready");
    if (result.status === "ready") expect(result.feedback.reflections[0].answerQuote).toBe(request.answer.facts);
    const payload = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(JSON.parse(payload.messages[1].content).learnerAnswer).toEqual(request.answer);
    expect(JSON.stringify(payload)).not.toMatch(/must-not-be-transmitted|userId|badgeNumber|email|synthetic-private-key/);
  });
  it.each(processScenarios.filter(scenario => scenario.processId !== "etch"))("bounds $processId evidence gaps without supplying an exact-time answer key", scenario => {
    const context = scenarioCoachContext(processInput(scenario));
    const times = context.samples.map(row => row.time);
    expect(times).toEqual(Array.from({ length: scenario.duration / 5 + 1 }, (_, index) => index * 5));
    expect(context.scope).toContain("5-second intervals");
    expect(context.scope).toContain("not the complete one-second record");
    expect(context.evidence["pressure-trend"]).not.toContain("complete");
    expect(context).not.toHaveProperty("changeTime");
    expect(context).not.toHaveProperty("events");
  });
  it("preserves photo evidence before, during and after the brief deviation in the actual AI request", async () => {
    const scenario = processScenarios.find(item => item.processId === "photo")!;
    await createJudgmentCoach()(27, processInput(scenario));
    const payload = JSON.parse(fetchMock.mock.calls[0][1].body);
    const context = JSON.parse(payload.messages[0].content.split("Trusted scenario context: ")[1].split("\n")[0]);
    const position = (time: number) => context.samples.find((row: { time: number }) => row.time === time).signals.find((signal: { id: string }) => signal.id === "position");
    for (const time of [30, 45, 90]) {
      const sample = position(time);
      expect(sample.current).toBeGreaterThanOrEqual(sample.range[0]);
      expect(sample.current).toBeLessThanOrEqual(sample.range[1]);
    }
    for (const time of [35, 40]) {
      const sample = position(time);
      expect(sample.current).toBeGreaterThan(sample.range[1]);
    }
    expect(context.samples.every((row: { signals: { id: string; current: number; range: number[] }[] }) => {
      const shape = row.signals.find(signal => signal.id === "shape")!;
      return shape.current >= shape.range[0] && shape.current <= shape.range[1];
    })).toBe(true);
  });
  it("retains recurring interconnect differences and packaging recovery, not only endpoints", () => {
    const metal = processScenarios.find(item => item.processId === "metal")!;
    const connection = scenarioCoachContext(processInput(metal)).samples.filter(row => row.time >= 40).map(row => {
      const signal = row.signals.find(item => item.id === "connection")!;
      return signal.current > signal.range[1];
    });
    expect(connection.slice(0, 5)).toEqual([false, true, false, true, false]);
    const packaging = processScenarios.find(item => item.processId === "packaging")!;
    const samples = scenarioCoachContext(processInput(packaging)).samples;
    const at = (time: number) => samples.find(row => row.time === time)!.signals.find(item => item.id === "connection")!;
    expect(at(60).current).toBeLessThan(at(60).range[0]);
    expect(at(70).current).toBeLessThan(at(60).current);
    expect(at(80).current).toBeGreaterThan(at(70).current);
    expect(at(90).current).toBeGreaterThanOrEqual(at(90).range[0]);
    expect(at(90).current).toBeLessThanOrEqual(at(90).range[1]);
  });
  it("handles reference-consistent observations without inventing a pressure anomaly", () => {
    const scenario = processScenarios.find(item => item.processId === "oxidation")!;
    const request = processInput(scenario);
    expect(request.answer).toMatchObject({ signal: "none", onset: "none" });
    const context = scenarioCoachContext(request);
    expect(context.evidence["pressure-trend"]).toContain("No-change is a valid evidence-based choice");
    expect(context.evidence["pressure-trend"]).not.toContain("synthetic pressure trend develops");
    expect(context.samples.every(row => row.signals.every(signal => signal.current >= signal.range[0] && signal.current <= signal.range[1]))).toBe(true);
    const valid = validateCoachOutput(JSON.stringify(output("ko", request.answer)), request.answer, "ko", scenario.id);
    expect(valid.strengths).toEqual(["signal", "reference"]);
    expect(validateCoachOutput(JSON.stringify(output("ko", request.answer)), { ...request.answer, signal: "film", onset: "30" }, "ko", scenario.id).strengths).toEqual(["reference", "uncertainty"]);
  });
  it("rejects process aliases, unknown signals, incomplete observation, and incoherent no-change choices before transmission", async () => {
    const scenario = processScenarios.find(item => item.processId === "wafer")!;
    const request = processInput(scenario);
    const changes = [{ scenarioId: "unknown" }, { scenarioId: "wafer" }, { elapsed: 180 }, { marker: 91 }, { submitted: false },
      { answer: { ...request.answer, signal: "pressure" } }, { answer: { ...request.answer, onset: "none" } },
      { answer: { ...request.answer, signal: "none" } }, { answer: { ...request.answer, onset: "91" } },
      { answer: { ...request.answer, comparison: "same-phase" } }, { answer: { ...request.answer, facts: "" } }];
    for (const change of changes) await expect(createJudgmentCoach()(27, { ...request, ...change })).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(JSON.stringify(request)).not.toContain("must-not-be-transmitted");
  });
  it("serializes concurrent requests and applies user-scoped cooldown without sharing answers", async () => {
    const now = vi.spyOn(Date, "now").mockReturnValue(1000);
    let release!: (response: Response) => void;
    fetchMock.mockReturnValueOnce(new Promise<Response>(resolve => { release = resolve; }));
    const read = createJudgmentCoach(); const first = read(27, input());
    expect(await read(27, input())).toMatchObject({ status: "unavailable", reason: "cooldown" });
    expect((await read(28, input())).status).toBe("ready");
    release(response()); await first;
    expect(await read(27, input())).toMatchObject({ reason: "cooldown", retryAfterSeconds: 60 });
    now.mockReturnValue(61_001); expect((await read(27, input())).status).toBe("ready");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
  it.each([401, 429, 500])("fails visibly on HTTP %s without retry or upstream-body logs", async status => {
    fetchMock.mockResolvedValue(new Response("private-user-answer", { status }));
    expect(await createJudgmentCoach()(27, input())).toEqual({ status: "unavailable", reason: "provider-error" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(vi.mocked(console.warn).mock.calls)).not.toMatch(/private-user-answer|synthetic-private-key/);
    expect(vi.mocked(console.warn).mock.calls).toEqual([[JSON.stringify({ event: "judgment_coach_unavailable", reason: "provider-error",
      category: status === 401 ? "authentication" : status === 429 ? "rate-limit" : "http" })]]);
  });
  it.each(["TimeoutError", "AbortError", "Error"])("logs only a fixed classification for %s, never the error body", async name => {
    const error = new Error(`private-user-answer ${ENV.nvidiaApiKey} account@example.com`); error.name = name;
    fetchMock.mockRejectedValue(error);
    expect(await createJudgmentCoach()(27, input())).toEqual({ status: "unavailable", reason: "provider-error" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(vi.mocked(console.warn).mock.calls).toEqual([[JSON.stringify({ event: "judgment_coach_unavailable", reason: "provider-error",
      category: name === "Error" ? "connection" : "timeout" })]]);
  });
  it.each([
    ["invalid JSON private-user-answer", "json"], ["{}", "schema"], ["x".repeat(7001), "output-shape"],
    [JSON.stringify({ ...output(), strengths: ["reference", "reference"] }), "schema"],
    [JSON.stringify({ ...output(), reflections: output().reflections.map(item => ({ ...item, question: ENV.nvidiaApiKey })) }), "safety"],
    [JSON.stringify({ ...output(), reflections: [{ ...output().reflections[0], evidenceId: "record-comparison" }, output().reflections[1]] }), "evidence"],
    [JSON.stringify(output("en")), "language"],
    [JSON.stringify({ ...output(), reflections: [{ ...output().reflections[0], question: "어떤 비교로 원인을 배제했습니까?" }, output().reflections[1]] }), "causal-exclusion"],
  ])("logs validation classification %s without copying output", async (text, category) => {
    fetchMock.mockResolvedValue(response(text));
    expect(await createJudgmentCoach()(27, input())).toEqual({ status: "unavailable", reason: "invalid-response" });
    expect(vi.mocked(console.warn).mock.calls).toEqual([[JSON.stringify({ event: "judgment_coach_unavailable", reason: "invalid-response", category })]]);
  });
  it("logs configuration and metadata failures without key, model or user identifiers", async () => {
    ENV.nvidiaApiKey = "";
    await createJudgmentCoach()(27, input());
    ENV.nvidiaApiKey = "synthetic-private-key";
    fetchMock.mockResolvedValue(response(JSON.stringify(output()), ENV.nvidiaApiKey));
    await createJudgmentCoach()(27, input());
    expect(vi.mocked(console.warn).mock.calls).toEqual([
      [JSON.stringify({ event: "judgment_coach_unavailable", reason: "not-configured", category: "configuration" })],
      [JSON.stringify({ event: "judgment_coach_unavailable", reason: "invalid-response", category: "metadata" })],
    ]);
  });
  it("does not log successful answers or invalid unconsented input", async () => {
    expect((await createJudgmentCoach()(27, input())).status).toBe("ready");
    await expect(createJudgmentCoach()(27, { ...input(), consent: false })).rejects.toThrow();
    expect(console.warn).not.toHaveBeenCalled();
  });
  it.each(["length", "content_filter"])("rejects incomplete %s responses", async reason => {
    fetchMock.mockResolvedValue(response(JSON.stringify(output()), "nvidia/qa", reason));
    expect((await createJudgmentCoach()(27, input())).status).toBe("unavailable");
  });
  it("rejects unexpected model metadata instead of exposing it", async () => {
    fetchMock.mockResolvedValue(response(JSON.stringify(output()), ENV.nvidiaApiKey));
    expect(await createJudgmentCoach()(27, input())).toEqual({ status: "unavailable", reason: "invalid-response" });
  });
  it.each(["invalid JSON", "{}", "x".repeat(7001)])("rejects malformed or unbounded output", async text => {
    fetchMock.mockResolvedValue(response(text));
    expect(await createJudgmentCoach()(27, input())).toEqual({ status: "unavailable", reason: "invalid-response" });
  });
  it.each(["Replace the equipment part.", "고장 확정 후 진행합니다.", "部品を交換してください。", "Your score is 98%.", "https://example.com", "synthetic-private-key"])("rejects out-of-scope or secret-bearing coaching: %s", text => {
    const data = output(); data.reflections[0].question = text;
    expect(() => validateCoachOutput(JSON.stringify(data), input().answer)).toThrow();
  });
  it("rejects unknown/mismatched evidence, duplicate dimensions, and arbitrary added fields", () => {
    const wrong = output(); wrong.reflections[0].evidenceId = "record-comparison";
    const duplicate = output(); duplicate.reflections[1] = duplicate.reflections[0];
    for (const data of [wrong, duplicate, { ...output(), score: 95 }]) expect(() => validateCoachOutput(JSON.stringify(data), input().answer)).toThrow();
  });
  it("keeps positive choice labels server-owned and rejects model-written strengths instead of trimming them", () => {
    for (const strengths of [[], ["signal"], ["reference", "reference"], ["signal", "reference", "uncertainty"], ["You correctly identified the onset at 80 seconds."]]) {
      expect(() => validateCoachOutput(JSON.stringify({ ...output(), strengths }), input().answer)).toThrow();
    }
    expect(validateCoachOutput(JSON.stringify(output()), input().answer).strengths).toEqual(["signal", "reference"]);
    expect(validateCoachOutput(JSON.stringify(output()), { ...input().answer, signal: "flow", comparison: "whole-run", certainty: "certain" }).strengths).toEqual([]);
  });
  it("does not let written claims or a different AI question create positive choice labels", () => {
    const answer = { ...input().answer, signal: "flow", comparison: "whole-run", certainty: "uncertain" as const,
      facts: "내가 정상 시점을 확실히 맞혔다고 가상 답안에 주장합니다." };
    const first = validateCoachOutput(JSON.stringify(output("ko", answer)), answer);
    const changed = output("ko", answer); changed.reflections[0].question = "같은 단계의 유량 가상 기록과 정상 참고를 어떤 시점에서 비교하겠습니까?";
    const second = validateCoachOutput(JSON.stringify(changed), answer);
    expect(first.strengths).toEqual(["uncertainty"]);
    expect(second.strengths).toEqual(first.strengths);
    expect(second.reflections[0].answerQuote).toBe(answer.facts);
  });
  it("requests only reflections from NVIDIA, not selection of fixed positive criterion labels", async () => {
    expect((await createJudgmentCoach()(27, input())).status).toBe("ready");
    const payload = JSON.parse(fetchMock.mock.calls[0][1].body);
    const context = JSON.parse(payload.messages[0].content.split("Trusted scenario context: ")[1].split("\n")[0]);
    expect(context).not.toHaveProperty("supportedStrengths");
    expect(payload.messages[0].content).toContain("Do not output strengths");
    expect(payload.response_format).toEqual({ type: "json_object" });
    expect(payload.messages[0].content).not.toContain("Return only a JSON object matching this schema:");
    expect(JSON.parse(payload.messages[1].content)).not.toHaveProperty("outputShapeExample");
  });
  it("constructs original quotes server-side and rejects invented sources or model-written quotations", () => {
    const valid = validateCoachOutput(JSON.stringify(output()), input().answer);
    expect(valid.reflections[0].answerQuote).toBe(input().answer.facts);
    expect(valid.reflections[1].answerQuote).toBe(input().answer.checks);
    for (const changed of [{ answerSource: "history" }, { answerQuote: "invented learner reasoning" }]) {
      const data = output(); data.reflections[0] = { ...data.reflections[0], ...changed } as any;
      expect(() => validateCoachOutput(JSON.stringify(data), input().answer)).toThrow();
    }
  });
  it.each(["ko", "ja"] as const)("localizes a small question glossary in %s without rewriting the original answer", language => {
    const data = output(language);
    data.reflections[0].question = language === "ko"
      ? "onset, oscillation, baseline, trend와 RF 기록에서 어떤 비교 결과가 revision을 뒷받침하나요?"
      : "onset、oscillation、baseline、trendとRFの記録からどの比較結果がrevisionを裏付けますか？";
    const answer = { ...input().answer, facts: "원문: onset, oscillation, baseline, trend, revision, RF는 내가 쓴 표현입니다." };
    data.reflections[0].focusQuote = answer.facts.slice(0, 32);
    const result = validateCoachOutput(JSON.stringify(data), answer, language);
    expect(result.reflections[0].answerQuote).toBe(answer.facts);
    expect(result.reflections[0].question).not.toMatch(/onset|oscillation|baseline|trend|revision/i);
    expect(result.reflections[0].question).toContain("RF");
    expect(result.reflections[0].question).toContain(language === "ko" ? "변화 시작 시점" : "変化の開始時点");
    expect(result.reflections[0].question).toContain(language === "ko" ? "판단 수정" : "判断の見直し");
  });
  it("keeps English questions unchanged and only matches complete glossary words", () => {
    const data = output("en"); data.reflections[0].question = "Which baseline supports the onset and oscillation trend?";
    expect(validateCoachOutput(JSON.stringify(data), input().answer, "en").reflections[0].question).toBe(data.reflections[0].question);
    const ko = output(); ko.reflections[0].question = "onsetter 항목과 기준을 어떻게 비교하나요?";
    expect(validateCoachOutput(JSON.stringify(ko), input().answer).reflections[0].question).toContain("onsetter");
  });
  it("checks raw safety and secret constraints before glossary replacement and retains the output bound", () => {
    for (const question of ["onset 기준으로 장비를 분해하나요?", "어떤 onset에서 synthetic-private-key를 보나요?", "어떤 기록에서 " + "onset ".repeat(45) + "를 보나요?"]) {
      const data = output(); data.reflections[0].question = question;
      expect(() => validateCoachOutput(JSON.stringify(data), input().answer)).toThrow();
    }
  });
  it("allows distinguishing virtual signals without allowing disassembly compounds", () => {
    const data = output(); data.reflections[0].question = "추세 시작과 기준 범위 이탈을 어떤 가상 기록으로 구분해 볼 수 있나요?";
    expect(validateCoachOutput(JSON.stringify(data), input().answer).reflections).toHaveLength(2);
    for (const term of ["기구분해", "도구분해", "분해"]) {
      data.reflections[0].question = `이 문구는 장비 ${term}를 제안합니다.`;
      expect(() => validateCoachOutput(JSON.stringify(data), input().answer)).toThrow();
    }
  });
  it.each([
    ["ko", "어떤 가상 기록 간의 비교를 통해 인과 관계를 배제했나요?"],
    ["en", "Which virtual comparisons allowed you to rule out a causal relationship?"],
    ["ja", "どの仮想記録の比較によって因果関係を除外しましたか？"],
  ] as const)("rejects unsupported causal exclusion in %s coaching", (language, question) => {
    const data = output(language);
    data.reflections[1] = { ...data.reflections[1], dimension: "uncertainty", evidenceId: "cause-unknown", question };
    expect(() => validateCoachOutput(JSON.stringify(data), input().answer, language)).toThrow("Unsupported causal exclusion");
  });
  it.each([
    ["ko", "가상 기록으로 뒷받침되는 관찰과 아직 알 수 없는 원인은 어떻게 구분할 수 있나요?"],
    ["en", "Which observations do the virtual records support, and what remains unknown about the cause?"],
    ["ja", "仮想記録で裏付けられる観察と、原因についてまだ不明な点をどう区別しますか？"],
  ] as const)("allows evidence-limited uncertainty in %s without rewriting the learner", (language, question) => {
    const data = output(language);
    data.reflections[1] = { ...data.reflections[1], dimension: "uncertainty", evidenceId: "cause-unknown", question };
    const answer = { ...input().answer, checks: "원인을 아직 확정하거나 배제할 수 없으므로 가상 기록을 비교합니다." };
    data.reflections[1].focusQuote = answer.checks.slice(0, 32);
    expect(validateCoachOutput(JSON.stringify(data), answer, language).reflections[1].answerQuote).toBe(answer.checks);
  });
  it("creates a separate minimal coaching payload without the save key or identity", () => {
    const attempt = { ...emptyEtchAttempt(), elapsed: 180, submitted: true, saveKey: "do-not-transmit", marker: 80, answer: input().answer };
    const request = toJudgmentCoachRequest(attempt, "ko");
    expect(judgmentCoachRequestSchema.parse(request)).toEqual(input());
    expect(JSON.stringify(request)).not.toContain("do-not-transmit");
    expect(() => toJudgmentCoachRequest(emptyEtchAttempt(), "ko")).toThrow();
  });
  it("keeps explicit UI consent, manual-only requests, account/language isolation and plain text rendering", () => {
    const ui = readFileSync("client/src/components/ScenarioJudgmentCoach.tsx", "utf8");
    const page = readFileSync("client/src/pages/EtchTraining.tsx", "utf8");
    expect(ui).toContain("if (!consent || !userId || !attempt.submitted || pending.current) return");
    expect(ui).toContain("useMutation({ retry: false })");
    expect(ui).not.toMatch(/useEffect|dangerouslySetInnerHTML|sessionStorage|localStorage/);
    expect(ui).toContain("NVIDIA에 두 서술형 답안");
    expect(page).toContain('key={`${expectedStorageKey}:${attempt.saveKey}:${language}`}');
    expect(page).toContain("toTrainingSubmission(completed)");
    expect(readFileSync("server/judgmentCoach.ts", "utf8")).not.toMatch(/from ["']\.\/db|console\.log|console\.error/);
  });
});
