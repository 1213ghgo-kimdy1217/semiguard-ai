import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const loginSource = readFileSync(resolve(process.cwd(), "client/src/pages/Login.tsx"), "utf8");
const signupSource = readFileSync(resolve(process.cwd(), "client/src/pages/Signup.tsx"), "utf8");

describe("authentication language keyboard contract", () => {
  it("moves Login language selection and focus with arrow, Home, and End keys", () => {
    expect(loginSource).toContain("handleLoginLanguageKeyDown");
    expect(loginSource).toContain('event.key === "ArrowRight"');
    expect(loginSource).toContain('event.key === "ArrowLeft"');
    expect(loginSource).toContain('event.key === "Home"');
    expect(loginSource).toContain('event.key === "End"');
    expect(loginSource).toContain("loginLanguageButtonRefs.current[nextIndex]?.focus()");
  });

  it("moves Signup language selection and focus with the same keyboard contract", () => {
    expect(signupSource).toContain("handleSignupLanguageKeyDown");
    expect(signupSource).toContain('event.key === "ArrowRight"');
    expect(signupSource).toContain('event.key === "ArrowLeft"');
    expect(signupSource).toContain('event.key === "Home"');
    expect(signupSource).toContain('event.key === "End"');
    expect(signupSource).toContain("signupLanguageButtonRefs.current[nextIndex]?.focus()");
  });
});
