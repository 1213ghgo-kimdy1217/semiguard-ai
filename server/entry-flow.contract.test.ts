import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("public introduction to login to training choice", () => {
  it("always starts at the introduction and keeps the legacy dashboard protected", () => {
    const app = source("client/src/App.tsx");
    expect(app).toContain('<Route path={"/"} component={Welcome} />');
    expect(app).toMatch(/<Route path=\{"\/dashboard"\}>\s*<ProtectedRoute>/);
    expect(app).toContain('<Route path={"/training"}>');
    expect(app).toContain('<Route path={"/live"}>');
  });

  it("sends successful sign-ins to the practice choice and keeps account linking on the dashboard", () => {
    expect(source("client/src/pages/Login.tsx")).toContain('window.location.href = "/training";');
    expect(source("server/_core/oauth.ts")).toContain('res.redirect(302, "/training");');
    const social = source("server/_core/socialOAuth.ts");
    expect(social).toContain('`${origin}/dashboard?social_linked=${userInfo.provider}`');
    expect(social).toContain('res.redirect(302, `${origin}/training`);');
  });

  it("offers the next step in each screen without removing public previews", () => {
    const welcome = source("client/src/pages/Welcome.tsx");
    const login = source("client/src/pages/Login.tsx");
    const dashboard = source("client/src/pages/Dashboard.tsx");
    const training = source("client/src/pages/EtchTraining.tsx");
    expect(welcome).toContain('href="/login">{t.start}');
    expect(welcome).not.toContain('href="/dashboard"');
    expect(welcome).toContain('href="/training">{t.preview}');
    expect(login).toContain('isAuthenticated &&');
    expect(login).toContain('onClick={() => setLocation("/training")}');
    expect(dashboard).toContain('href="/training"');
    expect(welcome).toContain('소개 → 로그인 → 연습 방식 선택');
    expect(training).toContain("연습 방식을 선택하세요.");
    expect(training).toContain("STEP 02 / CHOOSE YOUR PRACTICE");
  });
});
