import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const loginSource = fs.readFileSync(path.resolve(process.cwd(), "client/src/pages/Login.tsx"), "utf8");

describe("현재 학습 체험 진입 제어", () => {
  it("옛 심사위원 데모 대신 제한된 샘플 관찰과 본 훈련의 차이를 안내한다", () => {
    expect(loginSource).not.toContain('setLocation("/demo")');
    expect(loginSource).toContain('judgeDemo: "장비·샘플 미리보기"');
    expect(loginSource).toContain('judgeDemo: "Preview equipment and sample signals"');
    expect(loginSource).toContain('judgeDemo: "装置・サンプルをプレビュー"');
    expect(loginSource).toContain('judgeDemoHint: "장비 소개 · 샘플 관찰만"');
    expect(loginSource).toContain('setLocation("/training")');
  });
});
