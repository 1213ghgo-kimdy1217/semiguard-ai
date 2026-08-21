import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const loginSource = readFileSync(
  resolve(process.cwd(), "client/src/pages/Login.tsx"),
  "utf8"
);
const signupSource = readFileSync(
  resolve(process.cwd(), "client/src/pages/Signup.tsx"),
  "utf8"
);

describe("authentication submit loading accessibility contract", () => {
  it("keeps an atomic polite status for localized login submission progress", () => {
    expect(loginSource).toContain('id="login-submit-status" className="sr-only" role="status" aria-live="polite" aria-atomic="true"');
    expect(loginSource).toContain("{loginUi.signingIn}");
    expect(loginSource).toContain('aria-busy={isLoading}');
    expect(loginSource).toContain('aria-busy={isLoading || undefined}');
  });

  it("keeps an atomic polite status for localized signup submission progress", () => {
    expect(signupSource).toContain('id="signup-submit-status" className="sr-only" role="status" aria-live="polite" aria-atomic="true"');
    expect(signupSource).toContain("{copy.submitting}");
    expect(signupSource).toContain('aria-busy={isLoading}');
    expect(signupSource).toContain('aria-busy={isLoading || undefined}');
  });
});
