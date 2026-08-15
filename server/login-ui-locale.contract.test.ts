import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const loginSource = readFileSync(resolve(process.cwd(), "client/src/pages/Login.tsx"), "utf8");

describe("login UI locale contract", () => {
  it("provides Japanese and English text for the static login UI", () => {
    expect(loginSource).toContain('subtitle: "半導体装置予知安全システム"');
    expect(loginSource).toContain('employeeLogin: "Badge number sign-in"');
    expect(loginSource).toContain('googleLogin: "Googleでログイン"');
    expect(loginSource).toContain('naverLogin: "Continue with Naver"');
    expect(loginSource).toContain('linkedSocialLogin: "連携済みソーシャルアカウントでログイン"');
  });

  it("renders login labels and buttons through the selected-language UI message set", () => {
    expect(loginSource).toContain("{loginUi.subtitle}");
    expect(loginSource).toContain("{loginUi.badgeLabel}");
    expect(loginSource).toContain("placeholder={loginUi.passwordPlaceholder}");
    expect(loginSource).toContain("{isLoading ? loginUi.signingIn : loginUi.signIn}");
    expect(loginSource).toContain("{loginUi.socialLinkHint}");
  });
});
