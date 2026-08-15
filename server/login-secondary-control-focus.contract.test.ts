import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const loginSource = readFileSync(resolve(process.cwd(), "client/src/pages/Login.tsx"), "utf8");

describe("로그인 보조 제어 키보드 포커스 계약", () => {
  it("언어 선택·비밀번호 표시·회원가입 이동 제어에 포커스 링을 제공한다", () => {
    expect(loginSource.match(/focus-visible:ring-2 focus-visible:ring-cyan-300/g)?.length).toBeGreaterThanOrEqual(3);
    expect(loginSource).toContain('aria-pressed={loginLanguage === language}');
    expect(loginSource).toContain('aria-pressed={showPassword}');
  });
});
