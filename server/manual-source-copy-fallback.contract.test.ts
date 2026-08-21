import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("manual source copy fallback contract", () => {
  it("routes preview and dialog manual text through the common clipboard fallback", () => {
    expect(source).toContain("const copied = await copyTextWithFallback(manualPreviewQuery.data.chunks.map(chunk =>");
    expect(source).toContain("const copied = await copyTextWithFallback(activeManualSource.content);");
    expect(source).toContain('if (!copied) throw new Error("Clipboard copy failed");');
  });

  it("keeps Korean, English, and Japanese failures visible in both manual copy paths", () => {
    expect(source).toContain("원문을 복사하지 못했습니다.");
    expect(source).toContain("原文をコピーできませんでした。");
    expect(source).toContain("Could not copy the source.");
    expect(source).toContain("Manual source copied.");
    expect(source).toContain("Manual text copied.");
  });
});
