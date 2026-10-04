import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(path, "utf8").replace(/\r\n/g, "\n");

describe("sample-only guest entry policy", () => {
  it.each(["/live", "/training/history/:attemptId", "/training/process/:processId", "/training/etch", "/training", "/demo"])("gates full workspace %s before mounting it", route => {
    const app = source("client/src/App.tsx");
    const block = app.split(`<Route path={"${route}"}>`)[1]?.split("</Route>")[0];
    expect(block).toBeTruthy();
    expect(block).toContain("<PracticeAccess>");
    expect(block).toContain("</PracticeAccess>");
  });
  it("keeps the sample, concept learning, and deliberate read-only result sharing public", () => {
    const app = source("client/src/App.tsx");
    expect(app).toContain('<Route path={"/preview"}>');
    for (const route of ["/preview", "/learn", "/training/shared"]) {
      expect(app.split(`<Route path={"${route}"}>`)[1]?.split("</Route>")[0]).not.toContain("<PracticeAccess>");
    }
  });
  it("routes public preview entry points to the bounded sample, not full training", () => {
    expect(source("client/src/pages/Welcome.tsx")).toContain('href="/preview">{t.preview}');
    expect(source("client/src/pages/Welcome.tsx")).toContain('href="/preview">{t.follow}');
    const login = source("client/src/pages/Login.tsx");
    expect(login).toContain('onClick={() => setLocation("/preview")}');
    expect(login).toContain('judgeDemoHint: "장비 소개 · 샘플 관찰만"');
    const signup = source("client/src/pages/Signup.tsx");
    expect(signup).toContain('setLocation("/preview")');
    expect(signup).toContain('trainingLink: "가입 없이 장비·샘플 미리보기"');
    expect(login).toContain('window.location.href = "/training";');
  });
});
