import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const loginSource = fs.readFileSync(path.resolve(process.cwd(), "client/src/pages/Login.tsx"), "utf8");

describe("현재 학습 체험 진입 제어", () => {
  it("옛 심사위원 데모 대신 현재 모듈 체험과 계정 저장의 차이를 안내한다", () => {
    expect(loginSource).not.toContain('setLocation("/demo")');
    expect(loginSource).toContain('judgeDemo: "현재 학습 모듈 미리보기"');
    expect(loginSource).toContain('judgeDemo: "Preview current learning modules"');
    expect(loginSource).toContain('judgeDemo: "現在の学習モジュールを体験"');
    expect(loginSource).toContain('judgeDemoHint: "게스트 체험 · 계정 저장은 로그인 후"');
    expect(loginSource).toContain('setLocation("/training")');
  });
});
