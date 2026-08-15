import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const notFoundSource = readFileSync(resolve(process.cwd(), "client/src/pages/NotFound.tsx"), "utf8");

describe("not found locale contract", () => {
  it("renders stored Korean, English, and Japanese recovery guidance", () => {
    expect(notFoundSource).toContain("const NOT_FOUND_COPY: Record<NotFoundLanguage");
    expect(notFoundSource).toContain("페이지를 찾을 수 없습니다");
    expect(notFoundSource).toContain("Page Not Found");
    expect(notFoundSource).toContain("ページが見つかりません");
    expect(notFoundSource).toContain("{user ? copy.goHome : copy.goLogin}");
  });

  it("synchronizes the document language and labels the recovery page", () => {
    expect(notFoundSource).toContain('document.documentElement.lang = language === "ko" ? "ko-KR" : language === "ja" ? "ja-JP" : "en-US";');
    expect(notFoundSource).toContain('aria-labelledby="not-found-title"');
  });
});
