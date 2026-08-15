import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const notFoundSource = readFileSync(resolve(process.cwd(), "client/src/pages/NotFound.tsx"), "utf8");

describe("not-found authenticated return contract", () => {
  it("uses authentication state to choose the actual return route", () => {
    expect(notFoundSource).toContain('const { user } = useAuth();');
    expect(notFoundSource).toContain('setLocation(user ? "/" : "/login");');
  });

  it("labels the unauthenticated return action in all supported languages", () => {
    expect(notFoundSource).toContain('goLogin: "로그인으로 이동"');
    expect(notFoundSource).toContain('goLogin: "Go to Login"');
    expect(notFoundSource).toContain('goLogin: "ログインへ移動"');
    expect(notFoundSource).toContain('{user ? copy.goHome : copy.goLogin}');
  });
});
