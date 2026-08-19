import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "client/src/pages/JudgeDemo.tsx"), "utf8");

describe("judge demo share-link contract", () => {
  it("copies a canonical public demo URL with the current language parameter", () => {
    expect(source).toContain('const shareUrl = `${window.location.origin}${window.location.pathname}?lang=${lang}`;');
    expect(source).toContain("await navigator.clipboard.writeText(shareUrl);");
  });

  it("exposes an accessible copy control and localized success and failure notices", () => {
    expect(source).toContain('aria-label={text.share}');
    expect(source).toContain('share: "링크 복사"');
    expect(source).toContain('share: "Copy link"');
    expect(source).toContain('share: "リンクをコピー"');
    expect(source).toContain('shareNotice === "success" ? text.shareComplete : text.shareFailed');
  });
});
