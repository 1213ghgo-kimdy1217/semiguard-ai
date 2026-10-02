import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { ENV } from "./_core/env";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { createJudgmentCoach, scenarioCoachContext, validateCoachOutput } from "./judgmentCoach";
import { judgmentCoachRequestSchema, toJudgmentCoachRequest } from "../shared/judgmentCoach";
import { emptyEtchAttempt } from "../shared/etchScenario";

const original = { ...ENV };
const input = () => ({ consent: true as const, scenarioId: "etch-chamber-a-01" as const, language: "ko" as const,
  elapsed: 180 as const, submitted: true as const, marker: 80,
  answer: { signal: "pressure" as const, onset: "70", comparison: "same-phase" as const, certainty: "uncertain" as const,
    facts: "단계 B의 압력 추이가 정상 참고보다 높아졌습니다.", checks: "같은 시점의 유량과 RF 가상 기록을 먼저 비교하겠습니다." } });
const output = (language: "ko" | "en" | "ja" = "ko") => ({ strengths: ["uncertainty"] as ("signal" | "reference" | "uncertainty")[], reflections: [
  { dimension: "reference", evidenceId: "phase-reference", answerSource: "facts" as const, question: language === "ko" ? "같은 시점의 어떤 정상 참고 기록을 비교하겠습니까?" : language === "ja" ? "同じ時点のどの正常参照を比較しますか？" : "Which normal reference point would you compare at that time?" },
  { dimension: "checks", evidenceId: "record-comparison", answerSource: "checks" as const, question: language === "ko" ? "비교 순서를 정할 때 어떤 가상 기록을 확인하겠습니까?" : language === "ja" ? "比較順序を決める際にどの仮想記録を確認しますか？" : "What existing virtual evidence would help you choose the comparison order?" },
] });
const response = (text = JSON.stringify(output()), model = "nvidia/qa", finish_reason = "stop") => new Response(JSON.stringify({
  id: "synthetic", created: 1, model, choices: [{ index: 0, message: { role: "assistant", content: text }, finish_reason }],
}), { status: 200 });
let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  Object.assign(ENV, original, { aiProvider: "nvidia", nvidiaApiKey: "synthetic-private-key", nvidiaModel: "nvidia/qa" });
  fetchMock = vi.fn().mockImplementation(async () => response());
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
  it.each(["en", "ja"] as const)("rejects Korean questions when %s coaching was requested", async language => {
    expect(await createJudgmentCoach()(27, { ...input(), language })).toEqual({ status: "unavailable", reason: "invalid-response" });
  });
  it("requires login before any model request", async () => {
    const caller = appRouter.createCaller({ user: null, req: {}, res: {} } as TrpcContext);
    await expect(caller.training.coach(input())).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(fetchMock).not.toHaveBeenCalled();
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
  it("rejects model-written praise or positive labels unsupported by the actual choices", () => {
    const data = { ...output(), strengths: ["You correctly identified the onset at 80 seconds."] };
    expect(() => validateCoachOutput(JSON.stringify(data), input().answer)).toThrow();
    expect(() => validateCoachOutput(JSON.stringify(output()), { ...input().answer, certainty: "certain" })).toThrow("Unsupported strength");
    expect(() => validateCoachOutput(JSON.stringify({ ...output(), strengths: ["reference", "reference"] }), input().answer)).toThrow("Unsupported strength");
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
