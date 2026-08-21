import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("period report share-copy fallback contract", () => {
  it("uses the shared Clipboard API fallback before confirming the copied link", () => {
    expect(source).toContain("const copyReportShareLink = async () => {");
    expect(source).toContain("const copied = await copyTextWithFallback(getReportShareUrl());");
    expect(source).toContain('if (!copied) throw new Error("Clipboard copy failed");');
  });

  it("keeps localized success and browser-permission failure notices", () => {
    expect(source).toContain("로그인 보호 분석 기간 링크를 복사했습니다.");
    expect(source).toContain("ログイン保護された分析期間リンクをコピーしました。");
    expect(source).toContain("Copied the login-protected analysis period link.");
    expect(source).toContain("링크를 복사하지 못했습니다. 브라우저 권한을 확인해주세요.");
  });
});
