import { z } from "zod";
import { ENV } from "./_core/env";
import type { LearningCheckpoint } from "../shared/learningGuide";

// Only this official, non-animated pack is used. No arbitrary search/download proxy.
export const OGQ_GUIDE_ASSET_ID = "58f1f5bf4517a";
const selectedImages: Record<LearningCheckpoint, string> = {
  reference: "5ca4008a62d23",
  compare: "5ca4008a62d2e",
  uncertainty: "5ca4008a62d34",
};
const CACHE_MS = 10 * 60_000;
const FAILURE_CACHE_MS = 60_000;
const MAX_BODY_BYTES = 128 * 1024;

const previewUrl = z.string().max(2048).refine(value => {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "preview.files.api.ogq.me"
      && !url.port && !url.username && !url.password && !url.hash
      && url.pathname.startsWith("/v1/stickers/STICKER_IMAGE/")
      && Array.from(url.searchParams.keys()).every(key => key === "format");
  } catch { return false; }
});
const detailSchema = z.object({
  asset: z.object({
    assetId: z.literal(OGQ_GUIDE_ASSET_ID), type: z.literal("STICKER"),
    title: z.string().min(1).max(160), free: z.literal(true), animated: z.literal(false),
    creator: z.object({ nickname: z.literal("OGQ") }),
  }),
  images: z.array(z.object({ imageId: z.string().max(80), imageUrl: previewUrl })).max(100),
});

export type OgqLearningGuide = {
  status: "ready" | "unconfigured" | "unavailable";
  asset: { assetId: string; title: string; creator: string } | null;
  images: { checkpoint: LearningCheckpoint; imageUrl: string }[];
};
const unavailable = (status: "unconfigured" | "unavailable"): OgqLearningGuide => ({ status, asset: null, images: [] });

async function readBoundedJson(response: Response, signal: AbortSignal): Promise<unknown> {
  if (!response.body || Number(response.headers.get("content-length")) > MAX_BODY_BYTES) {
    await response.body?.cancel();
    throw new Error("Invalid body size");
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  const abort = () => { void reader.cancel().catch(() => undefined); };
  signal.addEventListener("abort", abort, { once: true });
  try {
    while (true) {
      signal.throwIfAborted();
      const { done, value } = await reader.read();
      signal.throwIfAborted();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) { await reader.cancel(); throw new Error("Invalid body size"); }
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } finally {
    signal.removeEventListener("abort", abort);
    reader.releaseLock();
  }
}

/** Cache and in-flight deduplication are per warm instance, not a global quota guarantee. */
export function createOgqLearningGuideReader() {
  let cache: { expires: number; value: OgqLearningGuide } | undefined;
  let pending: Promise<OgqLearningGuide> | undefined;
  return async (): Promise<OgqLearningGuide> => {
    if (!ENV.ogqApiKey) return unavailable("unconfigured");
    if (cache && cache.expires > Date.now()) return cache.value;
    if (pending) return pending;
    pending = (async () => {
      let value: OgqLearningGuide;
      let failure = "Invalid response";
      try {
        const signal = AbortSignal.timeout(8_000);
        const response = await fetch(`https://4th-ai-ogq.competition.ogq.me/v1/assets/${OGQ_GUIDE_ASSET_ID}`, {
          headers: { "X-OGQ-API-KEY": ENV.ogqApiKey }, redirect: "error", signal,
        });
        if (!response.ok) {
          failure = `HTTP ${response.status}`;
          await response.body?.cancel();
          throw new Error("Upstream unavailable");
        }
        const detail = detailSchema.parse(await readBoundedJson(response, signal));
        // Never serialize the upstream response wholesale or return download credentials.
        if (detail.asset.title.includes(ENV.ogqApiKey)) throw new Error("Invalid title");
        const images = Object.entries(selectedImages).map(([checkpoint, imageId]) => {
          const image = detail.images.find(item => item.imageId === imageId);
          if (!image || image.imageUrl.includes(ENV.ogqApiKey)) throw new Error("Missing preview");
          return { checkpoint: checkpoint as LearningCheckpoint, imageUrl: image.imageUrl };
        });
        value = { status: "ready", asset: { assetId: detail.asset.assetId, title: detail.asset.title, creator: detail.asset.creator.nickname }, images };
      } catch {
        console.warn(`[OGQ] Learning guide unavailable: ${failure}`);
        value = unavailable("unavailable");
      }
      cache = { expires: Date.now() + (value.status === "ready" ? CACHE_MS : FAILURE_CACHE_MS), value };
      return value;
    })();
    try { return await pending; } finally { pending = undefined; }
  };
}

export const getOgqLearningGuide = createOgqLearningGuideReader();
