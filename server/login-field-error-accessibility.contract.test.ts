import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const loginSource = readFileSync(resolve(process.cwd(), "client/src/pages/Login.tsx"), "utf8");

describe("login required-field accessibility contract", () => {
  it("marks the missing badge number as invalid, explains the error, and restores focus", () => {
    expect(loginSource).toContain('setFieldError("badge")');
    expect(loginSource).toContain('document.getElementById("badgeNumber")?.focus()');
    expect(loginSource).toContain('aria-invalid={fieldError === "badge" || Boolean(authError)}');
    expect(loginSource).toContain('aria-describedby={fieldError === "badge" ? "badgeNumber-error" : authError ? "login-auth-error" : undefined}');
    expect(loginSource).toContain('id="badgeNumber-error"');
    expect(loginSource).toContain('id="badgeNumber-error" className="text-xs font-medium text-rose-300" role="alert" aria-atomic="true"');
  });

  it("marks the missing password as invalid, explains the error, and restores focus", () => {
    expect(loginSource).toContain('setFieldError("password")');
    expect(loginSource).toContain('document.getElementById("password")?.focus()');
    expect(loginSource).toContain('aria-invalid={fieldError === "password" || Boolean(authError)}');
    expect(loginSource).toContain('aria-describedby={fieldError === "password" ? "password-error" : authError ? "login-auth-error" : undefined}');
    expect(loginSource).toContain('id="password-error"');
    expect(loginSource).toContain('id="password-error" className="text-xs font-medium text-rose-300" role="alert" aria-atomic="true"');
  });

  it("keeps required-field messages localized through the existing language message map", () => {
    expect(loginSource).toContain('{loginMessages.badgeRequired}');
    expect(loginSource).toContain('{loginMessages.passwordRequired}');
    expect(loginSource).toContain('badgeRequired: "Enter your badge number."');
    expect(loginSource).toContain('passwordRequired: "パスワードを入力してください。"');
  });
});
