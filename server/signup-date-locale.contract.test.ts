import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const signupSource = readFileSync(resolve(process.cwd(), "client/src/pages/Signup.tsx"), "utf8");

describe("회원가입 생년월일 입력 다국어 맥락 계약", () => {
  it("선택된 언어 로케일을 생년월일 입력에 전달한다", () => {
    expect(signupSource).toContain('type="date" lang={LANGUAGE_LOCALES[language]}');
  });
});
