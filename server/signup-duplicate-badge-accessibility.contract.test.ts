import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const signupSource = readFileSync(resolve(process.cwd(), "client/src/pages/Signup.tsx"), "utf8");
const routerSource = readFileSync(resolve(process.cwd(), "server/routers.ts"), "utf8");

describe("회원가입 중복 명찰번호 접근성 계약", () => {
  it("서버는 중복 명찰번호에 CONFLICT 코드를 반환한다", () => {
    expect(routerSource).toContain('code: "CONFLICT", message: "이미 가입된 회사 명찰 번호입니다."');
  });

  it("클라이언트는 CONFLICT를 일반 오류가 아닌 다국어 명찰번호 필드 오류로 처리한다", () => {
    expect(signupSource).toContain('const errorCode = payload?.error?.json?.data?.code ?? payload?.error?.data?.code;');
    expect(signupSource).toContain('if (errorCode === "CONFLICT")');
    expect(signupSource).toContain('showFieldError("badgeNumber", copy.validation.badgeNumberExists);');
    expect(signupSource).toContain("{fieldErrorMessage ?? copy.validation.badgeNumber}");
    expect(signupSource).toContain('badgeNumberExists: "이미 가입된 회사 명찰 번호입니다. 로그인하거나 다른 번호를 입력해주세요."');
    expect(signupSource).toContain('badgeNumberExists: "This company badge number is already registered. Sign in or enter another number."');
    expect(signupSource).toContain('badgeNumberExists: "この社員証番号はすでに登録されています。ログインするか、別の番号を入力してください。"');
  });
});
