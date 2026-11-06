import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("dashboard language switch accessibility contract", () => {
  it("keeps the menu's named cycle action and uses one labelled global language selector", () => {
    expect(source).toContain('현재 언어: 한국어. 영어로 전환');
    expect(source).toContain('Current language: English. Switch to Japanese');
    expect(source).toContain('現在の言語: 日本語。韓国語に切替');
    expect((source.match(/aria-label=\{lang === "ko" \? "현재 언어: 한국어\. 영어로 전환"/g) ?? []).length).toBe(1);
    const header = readFileSync(resolve(process.cwd(), "client/src/components/SiteHeader.tsx"), "utf8");
    const selector = readFileSync(resolve(process.cwd(), "client/src/components/ProductLanguageSelect.tsx"), "utf8");
    expect(header).toContain('<ProductLanguageSelect language={language} onChange={onLanguageChange} />');
    expect(selector).toContain('aria-label={tr(language, "표시 언어", "Display language", "表示言語")}');
    expect(selector).toContain('value={language}');
    expect(source).toContain('window.addEventListener("semiguard-language-change", synchronize)');
  });
});
