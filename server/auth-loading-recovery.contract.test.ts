import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const access = readFileSync("client/src/components/PracticeAccess.tsx", "utf8");
const app = readFileSync("client/src/App.tsx", "utf8");
describe("shared protected-workspace auth loading recovery", () => {
  it("uses one boundary and localized secure-session guidance", () => {
    expect(app).toContain('return <PracticeAccess>{children}</PracticeAccess>;');
    for (const text of ["보안 로그인 상태를 확인하고 있습니다.", "Verifying your secure sign-in…", "安全なログイン状態を確認しています。"]) expect(access).toContain(text);
    expect(access).toContain('role="status" aria-live="polite" aria-atomic="true"');
    expect(access).toContain('className="et-app" aria-busy="true"');
  });
  it("offers bounded slow-loading recovery without opening a sample as a guest fallback", () => {
    expect(access).toContain('window.setTimeout(() => setIsSlowLoading(true), 8000)');
    expect(access).toContain('window.clearTimeout(timer)');
    expect(access).toContain('{isSlowLoading ?');
    expect(access).toContain('void refresh()');
    expect(access).toContain('href="/login"');
    expect(access).not.toContain('href="/preview"');
    expect(access).not.toContain('<TrainingPreview');
  });
});
