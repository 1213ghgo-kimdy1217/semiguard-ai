import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "client/src/components/ErrorBoundary.tsx"), "utf8");

describe("error boundary accessibility contract", () => {
  it("moves focus to a safe retry action and exposes an atomic assertive alert", () => {
    expect(source).toContain("private readonly retryButtonRef = createRef<HTMLButtonElement>();");
    expect(source).toContain("window.requestAnimationFrame(() => this.retryButtonRef.current?.focus());");
    expect(source).toContain('role="alert" aria-live="assertive" aria-atomic="true"');
    expect(source).toContain('ref={this.retryButtonRef}');
  });

  it("keeps Korean, English, and Japanese recovery copy clear about preserving saved records", () => {
    expect(source).toContain("저장된 상담과 안전 기록은 삭제되지 않았습니다.");
    expect(source).toContain("Your saved consultations and safety records have not been deleted.");
    expect(source).toContain("保存済みの相談と安全記録は削除されていません。");
  });
});
