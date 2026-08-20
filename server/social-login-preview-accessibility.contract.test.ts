import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const loginSource = readFileSync(resolve(process.cwd(), "client/src/pages/Login.tsx"), "utf8");

describe("개발 미리보기 소셜 로그인 안내 접근성 계약", () => {
  it("비활성화된 소셜 로그인 제어가 안내 상태와 연결된다", () => {
    expect(loginSource).toContain('id="preview-social-login-notice"');
    expect(loginSource.match(/aria-describedby=\{!isOauthEnabled \? "preview-social-login-notice" : undefined\}/g)).toHaveLength(3);
  });

  it("개발 미리보기 안내가 보조기기에 전체 문장을 polite 상태로 전달한다", () => {
    expect(loginSource).toContain('role="status" aria-live="polite" aria-atomic="true"');
  });
});
