import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { ENV } from "./_core/env";
import { createOgqLearningGuideReader, OGQ_GUIDE_ASSET_ID } from "./ogqLearningGuide";
import { appRouter } from "./routers";
import { learningCheckpoints } from "../shared/learningGuide";
import type { TrpcContext } from "./_core/context";

const originalKey = ENV.ogqApiKey;
const fixture = () => ({
  asset: { assetId: OGQ_GUIDE_ASSET_ID, type: "STICKER", title: "찌글찌글 OGQ프렌즈", creator: { nickname: "OGQ" }, free: true, animated: false, unusedSecret: "must-not-be-serialized" },
  images: ["5ca4008a62d23", "5ca4008a62d2e", "5ca4008a62d34"].map((imageId, i) => ({ imageId, imageUrl: `https://preview.files.api.ogq.me/v1/stickers/STICKER_IMAGE/fixture/${i + 1}.png?format=o240_240`, name: `${i + 1}.png` })),
  downloadUrl: "must-not-be-serialized",
});
const response = (data = fixture()) => new Response(JSON.stringify(data), { status: 200 });
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  ENV.ogqApiKey = "synthetic-fixture-key";
  fetchMock = vi.fn().mockImplementation(async () => response());
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});
afterEach(() => { ENV.ogqApiKey = originalKey; vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("OGQ learning guide boundary", () => {
  it("uses one fixed authenticated detail request and returns only reviewed preview fields", async () => {
    const result = await createOgqLearningGuideReader()();
    expect(fetchMock).toHaveBeenCalledWith(`https://4th-ai-ogq.competition.ogq.me/v1/assets/${OGQ_GUIDE_ASSET_ID}`, expect.objectContaining({ headers: { "X-OGQ-API-KEY": "synthetic-fixture-key" }, redirect: "error", signal: expect.any(AbortSignal) }));
    expect(result.status).toBe("ready");
    expect(result.images.map(item => item.checkpoint)).toEqual(learningCheckpoints.map(item => item.id));
    expect(JSON.stringify(result)).not.toMatch(/synthetic-fixture-key|must-not-be-serialized|downloadUrl/);
  });
  it("makes no external call when the key is absent", async () => {
    ENV.ogqApiKey = "";
    expect(await createOgqLearningGuideReader()()).toEqual({ status: "unconfigured", asset: null, images: [] });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("deduplicates concurrent requests and caches successful results for ten minutes", async () => {
    const now = vi.spyOn(Date, "now").mockReturnValue(1_000);
    const read = createOgqLearningGuideReader();
    const results = await Promise.all([read(), read(), read()]);
    expect(results.every(item => item.status === "ready")).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    now.mockReturnValue(600_999);
    await read();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    now.mockReturnValue(601_001);
    await read();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
  it.each([302, 401, 429, 503])("handles HTTP %s without upstream body exposure or retry loops", async status => {
    fetchMock.mockImplementation(async () => new Response("private upstream payload", { status }));
    const read = createOgqLearningGuideReader();
    expect((await read()).status).toBe("unavailable");
    await read();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(console.warn).toHaveBeenCalledWith(`[OGQ] Learning guide unavailable: HTTP ${status}`);
    expect(JSON.stringify(vi.mocked(console.warn).mock.calls)).not.toContain("private upstream payload");
  });
  it("recovers after the short failure cooldown", async () => {
    const now = vi.spyOn(Date, "now").mockReturnValue(1_000);
    fetchMock.mockResolvedValueOnce(new Response("", { status: 429 }));
    const read = createOgqLearningGuideReader();
    await read();
    now.mockReturnValue(61_001);
    expect((await read()).status).toBe("ready");
  });
  it.each(["http://preview.files.api.ogq.me/v1/stickers/STICKER_IMAGE/1.png", "https://example.com/1.png", "https://preview.files.api.ogq.me/v1/stickers/STICKER_IMAGE/1.png?token=private", "https://user:password@preview.files.api.ogq.me/v1/stickers/STICKER_IMAGE/1.png"])("rejects an unsafe preview URL: %s", async url => {
    const data = fixture(); data.images[0].imageUrl = url;
    fetchMock.mockResolvedValueOnce(response(data));
    expect((await createOgqLearningGuideReader()()).status).toBe("unavailable");
  });
  it.each(["creator", "free", "animated", "missing image", "invalid JSON"])("fails closed for %s", async problem => {
    const data = fixture();
    if (problem === "creator") data.asset.creator.nickname = "Another creator";
    if (problem === "free") data.asset.free = false;
    if (problem === "animated") data.asset.animated = true;
    if (problem === "missing image") data.images.pop();
    fetchMock.mockResolvedValueOnce(problem === "invalid JSON" ? new Response("invalid JSON") : response(data));
    expect((await createOgqLearningGuideReader()()).status).toBe("unavailable");
  });
  it("rejects a credential echoed in metadata", async () => {
    const data = fixture(); data.asset.title = ENV.ogqApiKey;
    fetchMock.mockResolvedValueOnce(response(data));
    expect((await createOgqLearningGuideReader()()).asset).toBeNull();
    expect(JSON.stringify(vi.mocked(console.warn).mock.calls)).not.toContain(ENV.ogqApiKey);
  });
  it("bounds an oversized response without trusting its content-length", async () => {
    fetchMock.mockResolvedValueOnce(new Response("x".repeat(128 * 1024 + 1)));
    expect((await createOgqLearningGuideReader()()).status).toBe("unavailable");
  });
  it("covers the response-body read with the same timeout", async () => {
    const controller = new AbortController();
    vi.spyOn(AbortSignal, "timeout").mockReturnValue(controller.signal);
    fetchMock.mockResolvedValueOnce(new Response(new ReadableStream({ start() { /* deliberately unfinished body */ } })));
    const result = createOgqLearningGuideReader()();
    const timer = setTimeout(() => controller.abort(), 10);
    try { expect((await result).status).toBe("unavailable"); }
    finally { clearTimeout(timer); }
    expect(AbortSignal.timeout).toHaveBeenCalledWith(8_000);
  });
  it("requires an authenticated session before querying OGQ", async () => {
    const anonymous = appRouter.createCaller({ user: null, req: {}, res: {} } as TrpcContext);
    await expect(anonymous.learning.guide()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("provides all three languages without transmitting answers to OGQ", () => {
    for (const checkpoint of learningCheckpoints) for (const lang of ["ko", "en", "ja"] as const) {
      expect(checkpoint.title[lang].length).toBeGreaterThan(4);
      expect(checkpoint.question[lang].length).toBeGreaterThan(40);
    }
    const source = readFileSync("client/src/components/OgqLearningGuide.tsx", "utf8");
    expect(source).toContain("trpc.learning.guide.useQuery(undefined");
    expect(source).toContain("staleTime: 10 * 60_000");
    expect(source).toContain("referrerPolicy=\"no-referrer\"");
    expect(source).toContain("onError=");
    expect(source).toContain("aria-pressed=");
    expect(source).toContain("AI 생성 답변·정답·기술 근거가 아닙니다");
    expect(source).not.toMatch(/OGQ_API_KEY|downloadUrl|X-OGQ-API-KEY/);
    expect(readFileSync("client/src/pages/LearningHub.tsx", "utf8")).toContain("<OgqLearningGuide language={language} />");
    expect(readFileSync("client/src/pages/EtchTraining.tsx", "utf8")).toContain("<OgqLearningGuide language={language} review />");
  });
});
