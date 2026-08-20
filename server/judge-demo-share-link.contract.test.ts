import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  resolve(process.cwd(), "client/src/pages/JudgeDemo.tsx"),
  "utf8"
);

describe("judge demo share-link contract", () => {
  it("copies a canonical public demo URL with the current language parameter", () => {
    expect(source).toMatch(
      /const shareUrl =\s*`\$\{window\.location\.origin\}\$\{window\.location\.pathname\}\?lang=\$\{lang\}`;/
    );
    expect(source).toContain("await navigator.clipboard.writeText(shareUrl);");
  });

  it("exposes an accessible copy control and localized success and failure notices", () => {
    expect(source).toContain("aria-label={text.share}");
    expect(source).toContain('share: "링크 복사"');
    expect(source).toContain('share: "Copy link"');
    expect(source).toContain('share: "リンクをコピー"');
    expect(source).toMatch(
      /notice === "shareSuccess"\s*\? text\.shareComplete\s*:\s*text\.shareFailed/
    );
  });

  it("uses one notice state so reset and share feedback cannot overlap", () => {
    expect(source).toMatch(
      /const \[notice, setNotice\] =\s*useState<\s*"reset" \|\s*"shareSuccess" \|\s*"shareError" \|\s*null\s*>\(null\);/
    );
    expect(source).toContain('setNotice("reset");');
    expect(source).toContain('setNotice("shareSuccess");');
    expect(source).not.toContain("showResetToast");
    expect(source).not.toContain("shareNotice");
  });

  it("announces reset and share feedback through one atomic polite live status", () => {
    expect(source).toMatch(
      /\{notice && \(\s*<div\s+role="status"\s+aria-live="polite"\s+aria-atomic="true"/
    );
    expect(source).toContain("text.resetComplete");
    expect(source).toContain("text.shareComplete");
    expect(source).toContain("text.shareFailed");
  });
});
