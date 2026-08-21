import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const loginSource = readFileSync(resolve(process.cwd(), "client/src/pages/Login.tsx"), "utf8");

describe("로그인 제출 상태 접근성 계약", () => {
  it("로그인 제출 중 상태를 양식의 aria-busy로 전달한다", () => {
    expect(loginSource).toContain('<form onSubmit={handleLogin} className="space-y-4" aria-busy={isLoading}>');
  });

  it("로그인 제목 주변의 방패 아이콘은 장식으로 처리한다", () => {
    expect(loginSource).toContain('<span aria-hidden="true">🛡️</span>');
  });
});
