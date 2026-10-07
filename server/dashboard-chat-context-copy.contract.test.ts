import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("dashboard consultation context disclosure", () => {
  it("uses the shared boundary notice instead of claiming old turns were summarized", () => {
    expect(source.includes("dashboardChatContextNotice(lang, Boolean(chatObservation))")).toBe(true);
    expect(source.includes('data-chat-context-scope="true"')).toBe(true);
    for (const misleading of ["chatMessages.length > 12", "오래된 대화 요약 압축 중", "古い会話を要約圧縮中", "Older turns summarized"]) {
      expect(source.includes(misleading)).toBe(false);
    }
  });

  it("labels the total as visible messages and lets the boundary notice wrap", () => {
    for (const label of ["화면 대화", "表示", "Visible"]) expect(source.includes(label + " ${chatMessages.length}")).toBe(true);
    const paragraph = source.match(/<p[^>]*data-chat-context-scope="true"[\s\S]*?<\/p>/)?.[0];
    expect(paragraph).toContain("leading-relaxed");
    expect(paragraph).not.toContain("truncate");
  });
});
