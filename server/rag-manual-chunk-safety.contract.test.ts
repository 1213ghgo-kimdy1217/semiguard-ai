import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { MANUAL_CHUNK_LIMIT, MANUAL_CHUNK_WARNING_THRESHOLD, splitManualTextIntoChunks } from "../shared/ragManual";

const routerSource = readFileSync(resolve(process.cwd(), "server/routers.ts"), "utf8");
const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("RAG manual chunk safety contract", () => {
  it("uses a shared paragraph-preserving splitter for exact client and server chunk counts", () => {
    expect(splitManualTextIntoChunks("A\n\nB\n\nC")).toEqual(["A\n\nB\n\nC"]);
    expect(splitManualTextIntoChunks("x".repeat(1201))).toHaveLength(2);
    expect(routerSource).toContain("splitManualTextIntoChunks(input.content)");
    expect(dashboardSource).toContain("splitManualTextIntoChunks(manualContent).length");
  });

  it("caps registrations and gives localized warning guidance before submission", () => {
    expect(routerSource).toContain("paragraphs.length > MANUAL_CHUNK_LIMIT");
    expect(MANUAL_CHUNK_LIMIT).toBe(50);
    expect(MANUAL_CHUNK_WARNING_THRESHOLD).toBe(20);
    expect(dashboardSource).toContain("isManualChunkWarning");
    expect(dashboardSource).toContain("장·설비별로 나누어 등록해 주세요.");
    expect(dashboardSource).toContain("章・設備ごとに分けて登録してください。");
  });

  it("uses a completion keyboard hint for the long-form manual input", () => {
    expect(dashboardSource).toMatch(
      /<textarea\s+id="rag-manual-content"[\s\S]*?enterKeyHint="done"/,
    );
  });

  it("offers mobile next and search keyboard hints for manual title and retrieval search", () => {
    expect(dashboardSource).toMatch(
      /<input\s+id="rag-manual-title"[\s\S]*?enterKeyHint="next"/,
    );
    expect(dashboardSource).toMatch(
      /value=\{manualSearchQuery\}[\s\S]*?enterKeyHint="search"/,
    );
  });
});
