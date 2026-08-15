import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const loginSource = readFileSync(resolve(process.cwd(), "client/src/pages/Login.tsx"), "utf8");

describe("login OAuth policy locale contract", () => {
  it("reads the saved application language without failing when localStorage is restricted", () => {
    expect(loginSource).toContain('window.localStorage.getItem("semiguard_lang")');
    expect(loginSource).toContain('return saved === "en" || saved === "ja" ? saved : "ko";');
    expect(loginSource).toContain("catch {");
  });

  it("provides English and Japanese OAuth policy messages for unlinked, link-required, and already-linked accounts", () => {
    expect(loginSource).toContain('if (loginLanguage === "ja") return `${oauthProviderLabel}アカウントはまだ連携されていません。');
    expect(loginSource).toContain('if (loginLanguage === "en") return `Your ${oauthProviderLabel} account is not linked yet.');
    expect(loginSource).toContain('if (loginLanguage === "ja") return "ソーシャルアカウントを連携するには');
    expect(loginSource).toContain('if (loginLanguage === "en") return "This social account is already linked to another SemiGuard account.";');
  });
});
