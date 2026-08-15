import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const loginSource = readFileSync(resolve(process.cwd(), "client/src/pages/Login.tsx"), "utf8");

describe("login document locale contract", () => {
  it("maps saved Korean, English, and Japanese settings to standard HTML locales", () => {
    expect(loginSource).toContain('locale: "ko-KR"');
    expect(loginSource).toContain('locale: "en-US"');
    expect(loginSource).toContain('locale: "ja-JP"');
    expect(loginSource).toContain("document.documentElement.lang = metadata.locale;");
  });

  it("uses localized titles and descriptions instead of Korean metadata for every login language", () => {
    expect(loginSource).toContain('title: "SemiGuard AI | Semiconductor Predictive Safety Monitoring"');
    expect(loginSource).toContain('title: "SemiGuard AI | 半導体装置の予知安全モニタリング"');
    expect(loginSource).toContain("metaDesc.setAttribute('content', metadata.description);");
    expect(loginSource).toContain("metaKw.setAttribute('content', metadata.keywords);");
  });
});
