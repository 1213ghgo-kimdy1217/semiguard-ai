import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  resolve(process.cwd(), "client/src/pages/NotFound.tsx"),
  "utf8"
);

describe("not found page accessibility contract", () => {
  it("uses the localized page title as the focused h1 and describes the recovery control", () => {
    expect(source).toContain(
      "const titleRef = useRef<HTMLHeadingElement>(null);"
    );
    expect(source).toContain(
      "window.requestAnimationFrame(() => titleRef.current?.focus());"
    );
    expect(source).toMatch(
      /<h1\s+ref=\{titleRef\}\s+id="not-found-title"\s+tabIndex=\{-1\}/
    );
    expect(source).toContain('id="not-found-description"');
    expect(source).toContain('aria-describedby="not-found-description"');
  });

  it("keeps Korean, English, and Japanese recovery titles", () => {
    expect(source).toContain("페이지를 찾을 수 없습니다");
    expect(source).toContain("Page Not Found");
    expect(source).toContain("ページが見つかりません");
  });
});
