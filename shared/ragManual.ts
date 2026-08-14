export const MANUAL_CHUNK_SIZE = 1200;
export const MANUAL_CHUNK_WARNING_THRESHOLD = 20;
export const MANUAL_CHUNK_LIMIT = 50;

/**
 * Preserve paragraph breaks where possible while packing short passages into
 * retrieval-sized chunks. Both client-side estimates and server-side storage
 * use this function so the displayed count matches the persisted count.
 */
export function splitManualTextIntoChunks(content: string): string[] {
  const chunks: string[] = [];
  let pending = "";
  const flushPending = () => {
    const normalized = pending.trim();
    if (normalized) chunks.push(normalized);
    pending = "";
  };

  for (const paragraph of content.split(/\n{2,}/)) {
    const normalized = paragraph.trim();
    if (!normalized) continue;

    if (normalized.length > MANUAL_CHUNK_SIZE) {
      flushPending();
      for (let start = 0; start < normalized.length; start += MANUAL_CHUNK_SIZE) {
        chunks.push(normalized.slice(start, start + MANUAL_CHUNK_SIZE));
      }
      continue;
    }

    if (!pending) {
      pending = normalized;
    } else if (pending.length + 2 + normalized.length <= MANUAL_CHUNK_SIZE) {
      pending = `${pending}\n\n${normalized}`;
    } else {
      flushPending();
      pending = normalized;
    }
  }

  flushPending();
  return chunks;
}
