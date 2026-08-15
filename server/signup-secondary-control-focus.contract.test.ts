import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const signupSource = readFileSync(resolve(process.cwd(), "client/src/pages/Signup.tsx"), "utf8");

describe("회원가입 보조 제어 키보드 포커스 계약", () => {
  it("언어 선택·비밀번호 표시·로그인 이동 제어에 포커스 링을 제공한다", () => {
    expect(signupSource.match(/focus-visible:ring-2 focus-visible:ring-cyan-300/g)?.length).toBeGreaterThanOrEqual(4);
    expect(signupSource).toContain('aria-pressed={language === nextLanguage}');
    expect(signupSource).toContain('aria-pressed={showPasswordConfirm}');
  });
});
