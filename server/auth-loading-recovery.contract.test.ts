import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const appSource = readFileSync(
  resolve(process.cwd(), "client/src/App.tsx"),
  "utf8"
);

describe("initial auth loading recovery contract", () => {
  it("keeps localized secure-session guidance for the protected-route loading screen", () => {
    expect(appSource).toContain(
      "const authLoadingCopy: Record<LoadingLanguage"
    );
    expect(appSource).toContain("보안 로그인 상태를 확인하고 있습니다.");
    expect(appSource).toContain("Verifying your secure sign-in…");
    expect(appSource).toContain("安全なログイン状態を確認しています。");
  });

  it("separates the loading status from recovery controls after an extended auth-loading wait", () => {
    expect(appSource).toContain(
      "window.setTimeout(() => setIsSlowLoading(true), 8000)"
    );
    expect(appSource).toMatch(
      /role="status"\s+aria-live="polite"\s+aria-atomic="true"/
    );
    expect(appSource).toMatch(/text-center"\s+aria-busy="true"/);
    expect(appSource).toContain("onClick={() => window.location.reload()}");
    expect(appSource).toContain("로그인 화면으로 이동");
    expect(appSource).toContain('onClick={() => setLocation("/login")}');
    expect(appSource).toContain("{isSlowLoading && (");
  });
});
