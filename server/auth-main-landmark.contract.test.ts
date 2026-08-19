import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const loginSource = readFileSync(resolve(process.cwd(), "client/src/pages/Login.tsx"), "utf8");
const signupSource = readFileSync(resolve(process.cwd(), "client/src/pages/Signup.tsx"), "utf8");

describe("authentication main landmark contract", () => {
  it("exposes the Login form as the page main content landmark", () => {
    expect(loginSource).toContain('<main className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-900');
    expect(loginSource).toContain("</main>");
  });

  it("exposes the Signup form as the page main content landmark", () => {
    expect(signupSource).toContain('<main className="min-h-screen bg-gradient-to-br from-slate-900');
    expect(signupSource).toContain("</main>");
  });
});
