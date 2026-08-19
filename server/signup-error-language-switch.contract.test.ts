import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const signupSource = readFileSync(resolve(process.cwd(), "client/src/pages/Signup.tsx"), "utf8");

describe("회원가입 오류 언어 전환 계약", () => {
  it("필드 오류를 고정 문자열이 아닌 현재 언어의 validation 키로 표시한다", () => {
    expect(signupSource).toContain("type SignupValidationKey = keyof typeof SIGNUP_COPY.ko.validation;");
    expect(signupSource).toContain("toast.error(copy.validation[messageKey]);");
    expect(signupSource).toContain("fieldErrorKey ? copy.validation[fieldErrorKey]");
  });

  it("중복 명찰번호도 언어 전환 가능한 validation 키로 저장한다", () => {
    expect(signupSource).toContain('showFieldError("badgeNumber", "badgeNumberExists");');
    expect(signupSource).toContain('badgeNumberExists: "이미 가입된 회사 명찰 번호입니다. 로그인하거나 다른 번호를 입력해주세요."');
    expect(signupSource).toContain('badgeNumberExists: "This company badge number is already registered. Sign in or enter another number."');
    expect(signupSource).toContain('badgeNumberExists: "この社員証番号はすでに登録されています。ログインするか、別の番号を入力してください。"');
  });
});
