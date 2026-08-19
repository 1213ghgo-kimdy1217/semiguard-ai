import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("dashboard language switch accessibility contract", () => {
  it("announces the current language and the next language for menu and header controls", () => {
    expect(source).toContain('현재 언어: 한국어. 영어로 전환');
    expect(source).toContain('Current language: English. Switch to Japanese');
    expect(source).toContain('現在の言語: 日本語。韓国語に切替');
    expect((source.match(/aria-label=\{lang === "ko" \? "현재 언어: 한국어\. 영어로 전환"/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });
});
