import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(
  resolve(process.cwd(), "client/src/pages/JudgeDemo.tsx"),
  "utf8"
);

describe("JudgeDemo 언어 선택 접근성 계약", () => {
  it("지역화된 언어 선택 이름을 세 언어에 제공합니다", () => {
    const select = readFileSync(resolve(process.cwd(), "client/src/components/ProductLanguageSelect.tsx"), "utf8");
    expect(select).toContain('"표시 언어", "Display language", "表示言語"');
    expect(select).toContain('<option value="ko">한국어</option>');
    expect(select).toContain('<option value="en">English</option>');
    expect(select).toContain('<option value="ja">日本語</option>');
  });

  it("공통 언어 선택기를 사용하고 데모 도구 모음은 별도로 명명합니다", () => {
    const app = readFileSync(resolve(process.cwd(), "client/src/App.tsx"), "utf8");
    const header = readFileSync(resolve(process.cwd(), "client/src/components/SiteHeader.tsx"), "utf8");
    const select = readFileSync(resolve(process.cwd(), "client/src/components/ProductLanguageSelect.tsx"), "utf8");
    expect(app).toContain("<SiteHeader />");
    expect(header).toContain('<ProductLanguageSelect language={language} onChange={onLanguageChange} />');
    expect(select).toContain('aria-label={tr(language, "표시 언어", "Display language", "表示言語")}');
    expect(source).toMatch(/role="toolbar"\s+aria-label=/);
    expect(source).toContain('window.addEventListener("semiguard-language-change", synchronize)');
    expect(source).toContain('window.removeEventListener("semiguard-language-change", synchronize)');
    expect(source).not.toContain('id="judge-demo-language"');
  });

  it("유효한 언어 URL 매개변수는 저장된 언어보다 먼저 적용해 직접 공유 링크를 지원합니다", () => {
    expect(source).toContain(
      'new URLSearchParams(window.location.search).get("lang")'
    );
    expect(source).toMatch(
      /if \(requested === "en" \|\|\s*requested === "ja" \|\|\s*requested === "ko"\)\s*return requested;/
    );
    expect(source).toContain(
      'const saved = localStorage.getItem("semiguard_lang")'
    );
  });

  it("유효하지 않은 언어 URL 매개변수는 저장된 지원 언어 또는 한국어 기본값으로 안전하게 처리합니다", () => {
    expect(source).toMatch(
      /const saved = localStorage\.getItem\("semiguard_lang"\);\s*return saved === "en" \|\| saved === "ja" \|\| saved === "ko" \? saved : "ko";/
    );
    expect(source).toMatch(/catch\s*\{\s*return "ko";/);
  });

  it("선택 언어에 맞춰 BCP 47 HTML 언어와 문서 제목을 함께 갱신합니다", () => {
    expect(source).toContain('lang === "ko" ? "ko-KR" : lang === "ja" ? "ja-JP" : "en-US"');
    expect(source).toContain('"SemiGuard AI 심사위원 읽기 전용 데모"');
    expect(source).toContain('"SemiGuard AI 審査員向け読み取り専用デモ"');
    expect(source).toContain('"SemiGuard AI Read-only Judge Demo"');
  });
});
