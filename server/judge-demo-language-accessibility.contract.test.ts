import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(
  resolve(process.cwd(), "client/src/pages/JudgeDemo.tsx"),
  "utf8"
);

describe("JudgeDemo 언어 선택 접근성 계약", () => {
  it("지역화된 언어 선택 이름을 세 언어에 제공합니다", () => {
    expect(source).toContain('languageLabel: "언어 선택"');
    expect(source).toContain('languageLabel: "Language"');
    expect(source).toContain('languageLabel: "言語選択"');
  });

  it("언어 선택과 관련 제어를 명명된 그룹으로 노출합니다", () => {
    expect(source).toMatch(/role="group"\s+aria-label=\{text\.languageLabel\}/);
    expect(source).toMatch(
      /<label\s+className="sr-only"\s+htmlFor="judge-demo-language"\s*>\s*\{text\.languageLabel\}\s*<\/label>/
    );
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
