import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { isStaleModuleError } from "../client/src/components/ErrorBoundary";

const source = readFileSync(resolve(process.cwd(), "client/src/components/ErrorBoundary.tsx"), "utf8");

describe("global error boundary recovery contract", () => {
  it("does not expose an internal stack trace in the user-facing error screen", () => {
    expect(source).not.toContain("this.state.error?.stack");
    expect(source).toContain("console.error(`[SemiGuard");
    expect(source).toContain("createErrorId()");
  });

  it("uses the saved language and offers safe recovery routes", () => {
    expect(source).toContain('localStorage.getItem("semiguard_lang")');
    expect(source).toContain("title: \"화면을 준비하는 중 문제가 발생했습니다.\"");
    expect(source).toContain("title: \"We could not prepare this screen.\"");
    expect(source).toContain("title: \"画面の準備中に問題が発生しました。\"");
    expect(source).toContain("this.setState({ hasError: false, error: null, errorId: null })");
    expect(source).toContain('window.location.assign("/login")');
    expect(source).toContain("window.location.reload()");
  });

  it("reloads rather than retrying an obsolete lazy-loaded bundle", () => {
    expect(isStaleModuleError(new TypeError("Failed to fetch dynamically imported module: https://example.test/assets/EtchLive-old.js"))).toBe(true);
    expect(isStaleModuleError(new Error("Importing a module script failed."))).toBe(true);
    expect(isStaleModuleError(new Error("A form component failed"))).toBe(false);
    expect(source).toContain("if (isStaleModuleError(this.state.error))");
    expect(source).toContain("{staleModule ? copy.staleRetry : copy.retry}");
    expect(source).toContain("{!staleModule && <button");
  });
});
