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
    expect(notFoundSource).toContain("심사위원 데모 열기");
    expect(notFoundSource).toContain("Open Judge Demo");
    expect(notFoundSource).toContain("審査員デモを開く");
    expect(notFoundSource).toContain("{user ? copy.goHome : copy.goLogin}");
  });

  it("synchronizes the document language and labels the recovery page", () => {
    expect(notFoundSource).toContain('document.documentElement.lang = language === "ko" ? "ko-KR" : language === "ja" ? "ja-JP" : "en-US";');
    expect(notFoundSource).toContain('pageTitle: "SemiGuard AI | 페이지를 찾을 수 없습니다"');
    expect(notFoundSource).toContain('pageTitle: "SemiGuard AI | Page Not Found"');
    expect(notFoundSource).toContain('pageTitle: "SemiGuard AI | ページが見つかりません"');
    expect(notFoundSource).toContain("document.title = copy.pageTitle;");
    expect(notFoundSource).toContain('onClick={handleGoDemo}');
    expect(notFoundSource).toContain('setLocation("/demo")');
    expect(notFoundSource).toContain('aria-labelledby="not-found-title"');
  });
});
