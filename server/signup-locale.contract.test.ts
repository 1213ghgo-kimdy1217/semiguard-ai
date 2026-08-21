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
    expect(signupSource).toContain('showFieldError("passwordConfirm", "passwordConfirm")');
    expect(signupSource).toContain("toast.error(copy.validation[messageKey]);");
    expect(signupSource).toContain("toast.success(copy.success);");
  });

  it("guides mobile keyboards through the registration fields in order", () => {
    expect(signupSource).toContain('id="badgeNumber" name="badgeNumber" type="text"');
    expect(signupSource).toContain('inputMode="text" enterKeyHint="next"');
    expect(signupSource).toContain('id="dateOfBirth" name="dateOfBirth" type="date"');
    expect(signupSource).toContain('enterKeyHint="next"');
    expect(signupSource).toContain('id="passwordConfirm" name="passwordConfirm"');
    expect(signupSource).toContain('enterKeyHint="done"');
  });
});
