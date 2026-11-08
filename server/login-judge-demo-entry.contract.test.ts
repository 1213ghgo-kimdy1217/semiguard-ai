import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const loginSource = fs.readFileSync(path.resolve(process.cwd(), "client/src/pages/Login.tsx"), "utf8");

describe("현재 학습 체험 진입 제어", () => {
  it("공개 소개의 3D 미리보기와 로그인 후 판단 연습을 연결한다", () => {
    expect(loginSource).not.toContain('setLocation("/demo")');
    expect(loginSource).toContain('judgeDemo: "3D 판단 연습 미리보기"');
    expect(loginSource).toContain('judgeDemo: "Preview 3D judgment practice"');
    expect(loginSource).toContain('judgeDemo: "3D判断練習のプレビュー"');
    expect(loginSource).toContain('judgeDemoHint: "로그인 없이 보기"');
    expect(loginSource).toContain('setLocation("/welcome#studio-preview")');
    expect(loginSource).toContain('setLocation("/training")');
  });
});
