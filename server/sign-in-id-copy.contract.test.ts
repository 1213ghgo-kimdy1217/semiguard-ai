import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const login = readFileSync(resolve(process.cwd(), "client/src/pages/Login.tsx"), "utf8");
const signup = readFileSync(resolve(process.cwd(), "client/src/pages/Signup.tsx"), "utf8");

describe("plain-language sign-in ID without an account migration", () => {
  it.each(["로그인 아이디", "Sign-in ID", "ログインID"])("uses %s in login and signup", label => {
    expect(login).toContain(`badgeLabel: "${label}"`);
    expect(signup).toContain(`badgeNumber: "${label}"`);
  });

  it("tells existing users to keep their value and new users to choose a separate ID", () => {
    for (const hint of ["그 값을 그대로 입력하세요", "enter the same value", "同じ値を入力"]) expect(login).toContain(hint);
    for (const hint of ["실제 사번·학번 대신", "not your actual employee or student number", "実際の社員番号・学籍番号とは別"]) expect(signup).toContain(hint);
    for (const page of [login, signup]) {
      expect(page).not.toContain("EMP-2024-001");
      expect(page).toContain('id="badgeNumber-hint"');
      expect(page).toContain('aria-describedby={["badgeNumber-hint",');
      expect(page).toContain('autoComplete="username"');
      expect(page).toContain('id="badgeNumber"');
    }
  });

  it("keeps credential payloads and the existing duplicate-account error contract", () => {
    expect(login).toContain('fetch("/api/trpc/auth.login"');
    expect(login).toContain('badgeNumber: badgeNumber.trim(),');
    expect(signup).toContain('fetch("/api/trpc/auth.signup"');
    expect(signup).toContain('badgeNumber: formData.badgeNumber.trim(),');
    expect(signup).toContain('if (errorCode === "CONFLICT")');
    expect(signup).toContain('showFieldError("badgeNumber", "badgeNumberExists")');
  });
});
