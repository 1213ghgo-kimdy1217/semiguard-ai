import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const source = (path: string) => readFileSync(path, "utf8").replace(/\r\n/g, "\n");

describe("signed-in learning workspace entry policy", () => {
  it.each(["/preview", "/learn", "/training/shared", "/training/metrics", "/live", "/training/history/:attemptId", "/training/process/:processId", "/training/etch", "/training", "/demo"])("gates workspace %s before mounting it", route => {
    const app = source("client/src/App.tsx");
    const block = app.split(`<Route path={"${route}"}>`)[1]?.split("</Route>")[0];
    expect(block).toBeTruthy();
    expect(block).toContain("<PracticeAccess>");
    expect(block).toContain("</PracticeAccess>");
  });
  it("keeps introduction and account recovery outside the workspace boundary", () => {
    const app = source("client/src/App.tsx");
    for (const route of ['<Route path={"/"} component={Welcome} />', '<Route path={"/welcome"} component={Welcome} />', '<Route path={"/login"} component={Login} />', '<Route path={"/signup"} component={Signup} />']) expect(app).toContain(route);
    const recovery = app.split('<Route path="/account/recovery/reset">')[1].split("</Route>")[0];
    expect(recovery).toContain("<AccountRecovery");
    expect(recovery).not.toContain("<PracticeAccess>");
    expect(app).toContain('return <PracticeAccess>{children}</PracticeAccess>;');
  });
  it("makes even the separate model entry wait for the same signed-in identity", () => {
    const entry = source("client/src/model-preview-main.tsx");
    expect(entry).toContain("<PracticeAccess fullNavigation><EtchLive /></PracticeAccess>");
    expect(entry).toContain("<AccountSessionProvider>");
    expect(entry).toContain('url: "/api/trpc"');
  });
  it("labels public entry calls to action as requiring sign-in", () => {
    const welcome = source("client/src/pages/Welcome.tsx");
    const login = source("client/src/pages/Login.tsx");
    const signup = source("client/src/pages/Signup.tsx");
    expect(welcome).toContain('href="/preview">{t.preview}');
    for (const copy of ["로그인하고 샘플 살펴보기", "Sign in to explore the sample", "ログインしてサンプルを見る"]) expect(welcome).toContain(copy);
    expect(login).toContain('onClick={() => setLocation("/preview")}');
    expect(login).toContain('judgeDemoHint: "로그인 후 이용"');
    for (const copy of ["공정 학습과 샘플 관찰도 로그인이 필요합니다.", "Process learning and sample observation also require sign-in.", "工程学習とサンプル観察にもログインが必要です。"]) expect(signup).toContain(copy);
    expect(signup).not.toContain("가입 없이 장비·샘플 미리보기");
    expect(login).toContain('window.location.href = "/training";');
  });
});
