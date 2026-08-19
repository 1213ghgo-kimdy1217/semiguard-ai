import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const loginSource = readFileSync(resolve(process.cwd(), "client/src/pages/Login.tsx"), "utf8");

describe("login authentication failure accessibility contract", () => {
  it("keeps an assertive inline error linked to both credential fields", () => {
    expect(loginSource).toContain('const [authError, setAuthError] = useState<string | null>(null);');
    expect(loginSource).toContain('id="login-auth-error"');
    expect(loginSource).toContain('role="alert"');
    expect(loginSource).toContain('authError ? "login-auth-error" : undefined');
    expect(loginSource).toContain('aria-invalid={fieldError === "badge" || Boolean(authError)}');
    expect(loginSource).toContain('aria-invalid={fieldError === "password" || Boolean(authError)}');
  });

  it("focuses the password field after an authentication failure and clears stale errors on editing", () => {
    expect(loginSource).toContain('setAuthError(loginMessages.failed);');
    expect(loginSource).toContain('document.getElementById("password")?.focus()');
    expect(loginSource).toContain('if (authError) setAuthError(null);');
  });
});
