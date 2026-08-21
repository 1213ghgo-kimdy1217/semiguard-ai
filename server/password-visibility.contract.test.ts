import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const loginSource = readFileSync(resolve(process.cwd(), "client/src/pages/Login.tsx"), "utf8");
const signupSource = readFileSync(resolve(process.cwd(), "client/src/pages/Signup.tsx"), "utf8");

describe("password visibility control contract", () => {
  it("offers an accessible localized toggle on the login password field", () => {
    expect(loginSource).toContain("const [showPassword, setShowPassword] = useState(false);");
    expect(loginSource).toContain('type={showPassword ? "text" : "password"}');
    expect(loginSource).toContain("aria-pressed={showPassword}");
    expect(loginSource).toContain("비밀번호 표시");
    expect(loginSource).toContain("Show password");
    expect(loginSource).toContain("パスワードを表示");
  });

  it("keeps signup password and confirmation visibility independent", () => {
    expect(signupSource).toContain("const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);");
    expect(signupSource).toContain('type={showPasswordConfirm ? "text" : "password"}');
    expect(signupSource).toContain("aria-pressed={showPasswordConfirm}");
  });

  it("reserves enough inline space for each signup password visibility control on narrow screens", () => {
    expect(signupSource).toMatch(/id="password"[\s\S]{0,900}className="[^"]*pr-32/);
    expect(signupSource).toMatch(/id="passwordConfirm"[\s\S]{0,900}className="[^"]*pr-32/);
  });
});
