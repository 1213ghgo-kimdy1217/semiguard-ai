import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "client/src/pages/Login.tsx"), "utf8");

describe("social login group accessibility contract", () => {
  it("exposes the localized linked social-login label on a semantic group", () => {
    expect(source).toContain('role="group" aria-label={loginUi.linkedSocialLogin}');
    expect(source).toContain("linkedSocialLogin");
    expect(source).toContain("Google Login");
    expect(source).toContain("Naver Login");
    expect(source).toContain("Kakao Login");
  });
});
