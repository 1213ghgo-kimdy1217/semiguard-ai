import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const loginSource = readFileSync(resolve(process.cwd(), "client/src/pages/Login.tsx"), "utf8");

describe("login language selector contract", () => {
  it("keeps the login language selection in state and persists it when storage is available", () => {
    expect(loginSource).toContain('const [loginLanguage, setLoginLanguage] = useState<"ko" | "en" | "ja">');
    expect(loginSource).toContain('window.localStorage.setItem("semiguard_lang", nextLanguage);');
    expect(loginSource).toContain("setLoginLanguage(nextLanguage);");
  });

  it("renders accessible Korean, English, and Japanese language buttons", () => {
    expect(loginSource).toContain('["ko", "한국어"]');
    expect(loginSource).toContain('["en", "EN"]');
    expect(loginSource).toContain('["ja", "日本語"]');
    expect(loginSource).toContain("aria-pressed={loginLanguage === language}");
  });
});
