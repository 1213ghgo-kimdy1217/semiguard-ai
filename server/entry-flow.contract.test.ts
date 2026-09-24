import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("public introduction to dashboard to training choice", () => {
  it("always starts at the introduction and keeps the dashboard protected", () => {
    const app = source("client/src/App.tsx");
    expect(app).toContain('<Route path={"/"} component={Welcome} />');
    expect(app).toMatch(/<Route path=\{"\/dashboard"\}>\s*<ProtectedRoute>/);
    expect(app).toContain('<Route path={"/training"}>');
    expect(app).toContain('<Route path={"/live"}>');
  });

  it("sends successful password and social sign-ins to the dashboard", () => {
    expect(source("client/src/pages/Login.tsx")).toContain('window.location.href = "/dashboard";');
    expect(source("server/_core/oauth.ts")).toContain('res.redirect(302, "/dashboard");');
    const social = source("server/_core/socialOAuth.ts");
    expect(social).toContain('`${origin}/dashboard?social_linked=${userInfo.provider}`');
    expect(social).toContain('res.redirect(302, `${origin}/dashboard`);');
  });

  it("offers the next step in each screen without removing public previews", () => {
    const welcome = source("client/src/pages/Welcome.tsx");
    const dashboard = source("client/src/pages/Dashboard.tsx");
    const training = source("client/src/pages/EtchTraining.tsx");
    expect(welcome).toContain('href="/dashboard">대시보드로 시작하기');
    expect(welcome).toContain('href="/training">로그인 없이 미리보기');
    expect(dashboard).toContain('href="/training"');
    expect(dashboard).toContain("시나리오·자유 분석 선택");
    expect(training).toContain("연습 방식을 선택하세요.");
  });
});
