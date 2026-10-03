import { ENV } from "./env";

export type Role = "system" | "user" | "assistant" | "tool" | "function";

export type TextContent = {
  type: "text";
  text: string;
};

export type ImageContent = {
  type: "image_url";
  image_url: {
    url: string;
    detail?: "auto" | "low" | "high";
  };
};

export type FileContent = {
  type: "file_url";
  file_url: {
    url: string;
    mime_type?: "audio/mpeg" | "audio/wav" | "application/pdf" | "audio/mp4" | "video/mp4" ;
  };
};

export type MessageContent = string | TextContent | ImageContent | FileContent;

export type Message = {
  role: Role;
  content: MessageContent | MessageContent[];
  name?: string;
  tool_call_id?: string;
};

export type Tool = {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
};

export type ToolChoicePrimitive = "none" | "auto" | "required";
export type ToolChoiceByName = { name: string };
export type ToolChoiceExplicit = {
  type: "function";
  function: {
    name: string;
  };
};

export type ToolChoice =
  | ToolChoicePrimitive
  | ToolChoiceByName
  | ToolChoiceExplicit;

export type InvokeParams = {
  messages: Message[];
  tools?: Tool[];
  toolChoice?: ToolChoice;
  tool_choice?: ToolChoice;
  maxTokens?: number;
  max_tokens?: number;
  temperature?: number;
  outputSchema?: OutputSchema;
  output_schema?: OutputSchema;
  responseFormat?: ResponseFormat;
  response_format?: ResponseFormat;
  model?: string;
  thinking?: Record<string, unknown>;
  reasoning?: Record<string, unknown>;
};

export type ToolCall = {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
};

export type InvokeResult = {
  provider?: "nvidia" | "manus";
  id: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: Role;
      content: string | Array<TextContent | ImageContent | FileContent>;
      tool_calls?: ToolCall[];
    };
    finish_reason: string | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
};

export type JsonSchema = {
  name: string;
  schema: Record<string, unknown>;
  strict?: boolean;
};

export type OutputSchema = JsonSchema;

export type ResponseFormat =
  | { type: "text" }
  | { type: "json_object" }
  | { type: "json_schema"; json_schema: JsonSchema };

const ensureArray = (
  value: MessageContent | MessageContent[]
): MessageContent[] => (Array.isArray(value) ? value : [value]);

const normalizeContentPart = (
  part: MessageContent
): TextContent | ImageContent | FileContent => {
  if (typeof part === "string") {
    return { type: "text", text: part };
  }

  if (part.type === "text") {
    return part;
  }

  if (part.type === "image_url") {
    return part;
  }

  if (part.type === "file_url") {
    return part;
  }

  throw new Error("Unsupported message content part");
};

const normalizeMessage = (message: Message) => {
  const { role, name, tool_call_id } = message;

  if (role === "tool" || role === "function") {
    const content = ensureArray(message.content)
      .map(part => (typeof part === "string" ? part : JSON.stringify(part)))
      .join("\n");

    return {
      role,
      name,
      tool_call_id,
      content,
    };
  }

  const contentParts = ensureArray(message.content).map(normalizeContentPart);

  // If there's only text content, collapse to a single string for compatibility
  if (contentParts.length === 1 && contentParts[0].type === "text") {
    return {
      role,
      name,
      content: contentParts[0].text,
    };
  }

  return {
    role,
    name,
    content: contentParts,
  };
};

const normalizeToolChoice = (
  toolChoice: ToolChoice | undefined,
  tools: Tool[] | undefined
): "none" | "auto" | ToolChoiceExplicit | undefined => {
  if (!toolChoice) return undefined;

  if (toolChoice === "none" || toolChoice === "auto") {
    return toolChoice;
  }

  if (toolChoice === "required") {
    if (!tools || tools.length === 0) {
      throw new Error(
        "tool_choice 'required' was provided but no tools were configured"
      );
    }

    if (tools.length > 1) {
      throw new Error(
        "tool_choice 'required' needs a single tool or specify the tool name explicitly"
      );
    }

    return {
      type: "function",
      function: { name: tools[0].function.name },
    };
  }

  if ("name" in toolChoice) {
    return {
      type: "function",
      function: { name: toolChoice.name },
    };
  }

  return toolChoice;
};

const resolveProvider = () => {
  const provider = ENV.aiProvider.trim() || (ENV.nvidiaApiKey.trim() ? "nvidia" : "manus");
  if (provider !== "nvidia" && provider !== "manus") throw new Error("Unsupported AI_PROVIDER");
  const apiKey = (provider === "nvidia" ? ENV.nvidiaApiKey : ENV.forgeApiKey).trim();
  if (!apiKey) throw new Error(`${provider === "nvidia" ? "NVIDIA_API_KEY" : "BUILT_IN_FORGE_API_KEY"} is not configured`);
  return {
    provider,
    apiKey,
    baseUrl: provider === "nvidia" ? "https://integrate.api.nvidia.com/v1"
      : `${(ENV.forgeApiUrl.trim() || "https://forge.manus.im").replace(/\/$/, "")}/v1`,
  } as const;
};

// Some providers return a reasoning trace in content rather than a separate field.
// Never display or save that trace, and reject an unfinished trace or empty answer.
export const finalAnswerOnly = (content: string): string => {
  const closing = content.lastIndexOf("</think>");
  const answer = (closing >= 0 ? content.slice(closing + 8) : content).trim();
  if (!answer || /<think>/i.test(answer)) throw new Error("LLM returned no complete final answer");
  return answer;
};

const normalizeResponseFormat = ({
  responseFormat,
  response_format,
  outputSchema,
  output_schema,
}: {
  responseFormat?: ResponseFormat;
  response_format?: ResponseFormat;
  outputSchema?: OutputSchema;
  output_schema?: OutputSchema;
}):
  | { type: "json_schema"; json_schema: JsonSchema }
  | { type: "text" }
  | { type: "json_object" }
  | undefined => {
  const explicitFormat = responseFormat || response_format;
  if (explicitFormat) {
    if (
      explicitFormat.type === "json_schema" &&
      !explicitFormat.json_schema?.schema
    ) {
      throw new Error(
        "responseFormat json_schema requires a defined schema object"
      );
    }
    return explicitFormat;
  }

  const schema = outputSchema || output_schema;
  if (!schema) return undefined;

  if (!schema.name || !schema.schema) {
    throw new Error("outputSchema requires both name and schema");
  }

  return {
    type: "json_schema",
    json_schema: {
      name: schema.name,
      schema: schema.schema,
      ...(typeof schema.strict === "boolean" ? { strict: schema.strict } : {}),
    },
  };
};

const RETRY_MAX_RETRIES = 4;
const RETRY_BASE_DELAY_MS = 500;
const RETRY_MAX_DELAY_MS = 30_000;

type FetchInit = NonNullable<Parameters<typeof fetch>[1]>;

const sleep = (ms: number, signal?: AbortSignal | null) =>
  new Promise<void>((resolve, reject) => {
    signal?.throwIfAborted();
    const onAbort = () => { clearTimeout(timer); reject(signal?.reason); };
    const timer = setTimeout(() => { signal?.removeEventListener("abort", onAbort); resolve(); }, ms);
    signal?.addEventListener("abort", onAbort, { once: true });
  });

const parseRetryAfter = (value: string | null): number | undefined => {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const at = Date.parse(value);
  return Number.isNaN(at) ? undefined : Math.max(0, at - Date.now());
};

// Equal-jitter exponential backoff. The cap/2 floor guarantees a minimum
// delay so a misbehaving caller loop slows down instead of hammering the
// upstream while it keeps returning errors.
const computeBackoffDelay = (
  attempt: number,
  retryAfterMs?: number
): number => {
  const cap = Math.min(RETRY_BASE_DELAY_MS * 2 ** attempt, RETRY_MAX_DELAY_MS);
  const jittered = cap / 2 + Math.random() * (cap / 2);
  return Math.min(Math.max(jittered, retryAfterMs ?? 0), RETRY_MAX_DELAY_MS);
};

export const isRetriableStatus = (status: number) =>
  status === 408 || status === 429 || status >= 500;

// Retries non-2xx responses and network errors with exponential backoff, then
// returns the final Response so callers keep their existing error handling.
const fetchWithBackoff = async (
  url: string,
  init: FetchInit
): Promise<Response> => {
  let lastError: unknown;

  for (let attempt = 0; attempt <= RETRY_MAX_RETRIES; attempt++) {
    init.signal?.throwIfAborted();
    try {
      const response = await fetch(url, init);
      if (response.ok || !isRetriableStatus(response.status) || attempt === RETRY_MAX_RETRIES) {
        return response;
      }

      const retryAfterMs = parseRetryAfter(
        response.headers.get("retry-after")
      );
      try {
        await response.body?.cancel();
      } catch {
        // Body already settled; nothing to clean up.
      }
      console.warn(
        `LLM request retry ${attempt + 1}/${RETRY_MAX_RETRIES} after status ${response.status}`
      );
      await sleep(computeBackoffDelay(attempt, retryAfterMs), init.signal);
    } catch (error) {
      lastError = error;
      init.signal?.throwIfAborted();
      if (attempt === RETRY_MAX_RETRIES) throw error;
      console.warn(
        `LLM request retry ${attempt + 1}/${RETRY_MAX_RETRIES} after network error`
      );
      await sleep(computeBackoffDelay(attempt), init.signal);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("LLM request failed after exhausting retries");
};

export async function invokeLLM(params: InvokeParams): Promise<InvokeResult> {
  const config = resolveProvider();
  // Budget includes response-body reading; stay below the 60s function limit.
  const signal = AbortSignal.timeout(40_000);

  const {
    messages,
    tools,
    toolChoice,
    tool_choice,
    outputSchema,
    output_schema,
    responseFormat,
    response_format,
    model,
    thinking,
    reasoning,
    maxTokens,
    max_tokens,
  } = params;

  const payload: Record<string, unknown> = {
    messages: messages.map(normalizeMessage),
  };
  if (params.temperature !== undefined) {
    if (!Number.isFinite(params.temperature) || params.temperature < 0 || params.temperature > 2) throw new Error("Invalid temperature");
    payload.temperature = params.temperature;
  }

  if (model) {
    payload.model = model;
  }
  if (config.provider === "nvidia") {
    // Callers retain their legacy model names; NVIDIA uses its own verified model.
    payload.model = ENV.nvidiaModel;
    payload.stream = false;
    payload.max_tokens = max_tokens ?? maxTokens ?? 2048;
    payload.chat_template_kwargs = { enable_thinking: false };
  }

  if (tools && tools.length > 0) {
    payload.tools = tools;
  }

  const normalizedToolChoice = normalizeToolChoice(
    toolChoice || tool_choice,
    tools
  );
  if (normalizedToolChoice) {
    payload.tool_choice = normalizedToolChoice;
  }

  const resolvedMaxTokens = max_tokens ?? maxTokens;
  if (typeof resolvedMaxTokens === "number") {
    payload.max_tokens = resolvedMaxTokens;
  }

  if (thinking && config.provider !== "nvidia") {
    payload.thinking = thinking;
  }
  if (reasoning && config.provider !== "nvidia") {
    payload.reasoning = reasoning;
  }

  const normalizedResponseFormat = normalizeResponseFormat({
    responseFormat,
    response_format,
    outputSchema,
    output_schema,
  });

  if (normalizedResponseFormat) {
    // Keep schema instructions and caller-side strict validation. The hosted
    // Lightning endpoint timed out with JSON mode in live checks, while the
    // same schema in plain completion instructions produced valid final JSON.
    if (config.provider === "nvidia" && normalizedResponseFormat.type === "json_schema") {
      if (ENV.nvidiaModel !== "nvidia/nemotron-3.5-lightning-30b-a3b") {
        payload.response_format = { type: "json_object" };
      }
      const schemaInstruction = `Return only a JSON object matching this schema: ${JSON.stringify(normalizedResponseFormat.json_schema.schema)}`;
      const normalizedMessages = payload.messages as ReturnType<typeof normalizeMessage>[];
      if (normalizedMessages[0]?.role === "system" && typeof normalizedMessages[0].content === "string") {
        normalizedMessages[0].content += `\n${schemaInstruction}`;
      } else {
        normalizedMessages.unshift(normalizeMessage({ role: "system", content: schemaInstruction }));
      }
    } else {
      payload.response_format = normalizedResponseFormat;
    }
  }

  const fetcher = config.provider === "nvidia" ? fetch : fetchWithBackoff;
  const response = await fetcher(`${config.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify(payload),
    redirect: "error",
    signal,
  });

  if (!response.ok) {
    // Do not log upstream bodies: they may echo credentials or user prompts.
    await response.body?.cancel();
    throw new Error(`LLM ${config.provider} request failed (HTTP ${response.status})`);
  }

  const result = await response.json() as InvokeResult;
  const choice = result.choices?.[0];
  if (!choice || typeof result.model !== "string" || !result.model.trim()) {
    throw new Error("LLM returned an incomplete or invalid response");
  }
  if (choice.finish_reason === "tool_calls" && tools?.length && choice.message?.tool_calls?.length) {
    return { ...result, provider: config.provider };
  }
  if (choice.finish_reason !== "stop" || typeof choice.message?.content !== "string") {
    throw new Error("LLM returned an incomplete or invalid response");
  }
  choice.message.content = finalAnswerOnly(choice.message.content);
  return { ...result, provider: config.provider };
}

export type ModelInfo = {
  id: string;
  object: string;
  created: number;
  owned_by: string;
};

export type ModelsResponse = {
  object: string;
  data: ModelInfo[];
};

export async function listLLMModels(): Promise<ModelsResponse> {
  const config = resolveProvider();
  const url = `${config.baseUrl}/models`;

  const response = await fetchWithBackoff(url, {
    headers: { authorization: `Bearer ${config.apiKey}` },
    redirect: "error",
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(`List LLM models failed (HTTP ${response.status})`);
  }

  return (await response.json()) as ModelsResponse;
}
