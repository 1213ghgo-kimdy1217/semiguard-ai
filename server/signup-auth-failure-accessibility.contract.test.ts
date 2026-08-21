import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const signupSource = readFileSync(resolve(process.cwd(), "client/src/pages/Signup.tsx"), "utf8");

describe("회원가입 인증 실패 접근성 계약", () => {
  it("서버 실패를 화면 낭독기 오류 배너로 안내하고 명찰번호 입력란으로 초점을 복구한다", () => {
    expect(signupSource).toContain('const [authError, setAuthError] = useState<string | null>(null)');
    expect(signupSource).toContain('setAuthError(copy.error)');
    expect(signupSource).toContain('role="alert"');
    expect(signupSource).toContain('id="signup-auth-error"');
    expect(signupSource).toContain('id="signup-auth-error" role="alert" aria-atomic="true"');
    expect(signupSource).toContain('document.getElementById("badgeNumber")?.focus()');
  });

  it("명찰번호 입력란이 인증 실패 배너와 연결되고 수정 시 실패 상태를 해제한다", () => {
    expect(signupSource).toContain('if (authError) setAuthError(null)');
    expect(signupSource).toContain('authError ? "signup-auth-error" : null');
    expect(signupSource).toContain('fieldError === "badgeNumber" || Boolean(authError)');
  });
});
