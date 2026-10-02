import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ENV } from "./_core/env";
import { finalAnswerOnly, invokeLLM, listLLMModels } from "./_core/llm";

const original = { ...ENV };
const fetchMock = vi.fn();
const complete = (content = "관찰된 사실: 가상 진동이 비교 기준을 초과했습니다.", finish_reason = "stop") => new Response(JSON.stringify({
  id: "qa", created: 1, model: "nvidia/test-model",
  choices: [{ index: 0, message: { role: "assistant", content }, finish_reason }],
}), { status: 200 });
const params = { model: "gpt-5-mini", messages: [{ role: "user" as const, content: "Synthetic evidence question" }] };

beforeEach(() => {
  Object.assign(ENV, original, { aiProvider: "", nvidiaApiKey: "qa-private-nvidia-key", nvidiaModel: "nvidia/nemotron-3-super-120b-a12b", forgeApiKey: "", forgeApiUrl: "" });
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
});
afterEach(() => { Object.assign(ENV, original); vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.useRealTimers(); });

describe("server-only NVIDIA explanation provider", () => {
  it("routes legacy callers to the configured NVIDIA model with a bounded non-streaming request", async () => {
    fetchMock.mockResolvedValue(complete());
    const result = await invokeLLM(params);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://integrate.api.nvidia.com/v1/chat/completions");
    expect(init.headers.authorization).toBe("Bearer qa-private-nvidia-key");
    expect(init.redirect).toBe("error");
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(JSON.parse(init.body)).toMatchObject({ model: ENV.nvidiaModel, stream: false, max_tokens: 2048, chat_template_kwargs: { enable_thinking: false } });
    expect(result.provider).toBe("nvidia");
    expect(JSON.stringify(result)).not.toContain("qa-private-nvidia-key");
  });

  it("uses verified JSON mode and retains the requested schema in the instructions", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(complete('{"details":"Synthetic evidence"}')));
    const schema = { type: "object", properties: { details: { type: "string" } }, required: ["details"] };
    await invokeLLM({ ...params, response_format: { type: "json_schema", json_schema: { name: "qa", schema } } });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.response_format).toEqual({ type: "json_object" });
    expect(body.messages[0].content).toContain(JSON.stringify(schema));
    await invokeLLM({ ...params, messages: [{ role: "system", content: "Evidence only" }, ...params.messages], response_format: { type: "json_schema", json_schema: { name: "qa", schema } } });
    const merged = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(merged.messages.filter((message: { role: string }) => message.role === "system")).toHaveLength(1);
    expect(merged.messages[0].content).toContain("Evidence only");
  });

  it("still supports the legacy provider without silently switching when explicitly selected", async () => {
    Object.assign(ENV, { aiProvider: "manus", forgeApiKey: "qa-forge", forgeApiUrl: "https://forge.manus.im" });
    fetchMock.mockResolvedValue(complete());
    expect((await invokeLLM(params)).provider).toBe("manus");
    expect(fetchMock.mock.calls[0][0]).toBe("https://forge.manus.im/v1/chat/completions");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).model).toBe("gpt-5-mini");
  });

  it("fails clearly without a key and does not transmit requests to another provider", async () => {
    Object.assign(ENV, { aiProvider: "nvidia", nvidiaApiKey: "", forgeApiKey: "qa-forge" });
    await expect(invokeLLM(params)).rejects.toThrow("NVIDIA_API_KEY is not configured");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([401, 403, 429, 500])("does not retry NVIDIA HTTP %s or expose upstream body text", async status => {
    fetchMock.mockResolvedValue(new Response("secret-or-user-prompt", { status }));
    await expect(invokeLLM(params)).rejects.toThrow(`LLM nvidia request failed (HTTP ${status})`);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each(["length", "content_filter", "tool_calls"])("rejects incomplete/unexpected %s output", async reason => {
    fetchMock.mockResolvedValue(complete("partial", reason));
    await expect(invokeLLM(params)).rejects.toThrow("incomplete or invalid response");
  });

  it.each(["", "   ", "<think>unfinished trace"])("rejects empty or unfinished reasoning output", async text => {
    fetchMock.mockResolvedValue(complete(text));
    await expect(invokeLLM(params)).rejects.toThrow("no complete final answer");
  });

  it("removes reasoning traces even when the opening delimiter is missing", () => {
    expect(finalAnswerOnly("untrusted internal trace</think>Final explanation")).toBe("Final explanation");
    expect(finalAnswerOnly("<think>hidden</think>Final explanation")).toBe("Final explanation");
  });

  it("times out a stalled provider instead of waiting past the function budget", async () => {
    // Native AbortSignal.timeout uses real time; supply a deterministic equivalent.
    vi.useFakeTimers();
    vi.spyOn(AbortSignal, "timeout").mockImplementation(ms => {
      const controller = new AbortController();
      setTimeout(() => controller.abort(new DOMException("Timed out", "TimeoutError")), ms);
      return controller.signal;
    });
    fetchMock.mockImplementation((_url, init) => new Promise((_resolve, reject) => {
      init.signal.addEventListener("abort", () => reject(init.signal.reason), { once: true });
    }));
    const rejected = expect(invokeLLM(params)).rejects.toThrow("Timed out");
    await vi.advanceTimersByTimeAsync(40_000);
    await rejected;
    vi.restoreAllMocks();
  });

  it("lists models using the same authenticated provider", async () => {
    fetchMock.mockResolvedValue(new Response('{"data":[]}'));
    await listLLMModels();
    expect(fetchMock.mock.calls[0][0]).toBe("https://integrate.api.nvidia.com/v1/models");
  });
});
