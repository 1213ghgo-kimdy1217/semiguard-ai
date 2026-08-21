import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const signupSource = readFileSync(resolve(process.cwd(), "client/src/pages/Signup.tsx"), "utf8");

describe("signup password strength contract", () => {
  it("evaluates password length and character groups for four strength states", () => {
    expect(signupSource).toContain("function getPasswordStrength(password: string)");
    expect(signupSource).toContain('if (password.length < 6) return { level: "tooShort", score: 0 };');
    expect(signupSource).toContain('if (password.length >= 10 && characterGroups >= 3) return { level: "strong", score: 3 };');
    expect(signupSource).toContain('if (characterGroups >= 2) return { level: "fair", score: 2 };');
  });

  it("announces localized feedback once and exposes a visual progress state", () => {
    expect(signupSource).toContain("passwordStrengthLabel: \"비밀번호 강도\"");
    expect(signupSource).toContain("passwordStrengthLabel: \"Password strength\"");
    expect(signupSource).toContain("passwordStrengthLabel: \"パスワードの強度\"");
    expect(signupSource).toContain('className="space-y-1.5">');
    expect(signupSource).toContain('id="password-strength-status" role="status" aria-live="polite" aria-atomic="true"');
    expect(signupSource).toContain("copy.passwordStrength[passwordStrength.level]");
  });

  it("associates the password field with its localized live strength status", () => {
    expect(signupSource).toContain('"password-strength-status"');
    expect(signupSource).toContain('id="password-strength-status"');
    expect(signupSource).toContain('role="status"');
    expect(signupSource).toContain('aria-describedby={[fieldError === "password" ? "password-error" : null, "password-strength-status"].filter(Boolean).join(" ")}');
  });
});
