import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("AI chat reply copy fallback contract", () => {
  it("uses Clipboard API when available and an off-screen text-area fallback otherwise", () => {
    expect(source).toContain("async function copyTextWithFallback(value: string)");
    expect(source).toContain("navigator.clipboard?.writeText");
    expect(source).toContain('document.createElement("textarea")');
    expect(source).toContain('document.execCommand("copy")');
    expect(source).toContain("finally {");
    expect(source).toContain("temporaryInput.remove();");
  });

  it("only marks a reply as copied after a successful copy and localizes failures", () => {
    expect(source).toContain("const copied = await copyTextWithFallback(msg.content);");
    expect(source).toContain("if (copied) {");
    expect(source).toContain("setCopiedIndex(idx);");
    expect(source).toContain("답변을 복사하지 못했습니다. 브라우저 권한을 확인해주세요.");
    expect(source).toContain("回答をコピーできませんでした。ブラウザーの権限を確認してください。");
    expect(source).toContain("Could not copy the reply. Check browser permissions.");
  });
});
