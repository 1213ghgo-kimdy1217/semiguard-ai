import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const signupSource = readFileSync(resolve(process.cwd(), "client/src/pages/Signup.tsx"), "utf8");

describe("signup locale contract", () => {
  it("provides Korean, English, and Japanese copy with a persisted language selector", () => {
    expect(signupSource).toContain("const SIGNUP_COPY = {");
    expect(signupSource).toContain("ko: {");
    expect(signupSource).toContain("en: {");
    expect(signupSource).toContain("ja: {");
    expect(signupSource).toContain('window.localStorage.setItem("semiguard_lang", nextLanguage);');
    expect(signupSource).toContain("aria-pressed={language === nextLanguage}");
  });

  it("synchronizes signup document metadata and localizes validation feedback", () => {
    expect(signupSource).toContain("document.documentElement.lang = LANGUAGE_LOCALES[language];");
    expect(signupSource).toContain("document.title = copy.pageTitle;");
    expect(signupSource).toContain("toast.error(copy.validation.passwordConfirm)");
    expect(signupSource).toContain("toast.success(copy.success);");
  });
});
