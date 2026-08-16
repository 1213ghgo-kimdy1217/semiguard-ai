import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const loginSource = fs.readFileSync(path.resolve(process.cwd(), "client/src/pages/Login.tsx"), "utf8");

describe("로그인 심사위원 데모 진입 제어", () => {
  it("로그인 없이 읽기 전용 데모로 이동하는 KO·EN·JA 제어를 제공한다", () => {
    expect(loginSource).toContain('setLocation("/demo")');
    expect(loginSource).toContain('judgeDemo: "심사위원 데모 바로가기"');
    expect(loginSource).toContain('judgeDemo: "View judge demo"');
    expect(loginSource).toContain('judgeDemo: "審査用デモを見る"');
    expect(loginSource).toContain('judgeDemoHint: "로그인 없이 · 읽기 전용 · 가상 데이터"');
  });
});
