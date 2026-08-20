import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const judgeDemoSource = readFileSync(
  resolve(process.cwd(), "client/src/pages/JudgeDemo.tsx"),
  "utf8"
);

describe("judge demo document locale contract", () => {
  it("persists the selected language and synchronizes the HTML language for assistive technologies", () => {
    expect(judgeDemoSource).toContain('localStorage.getItem("semiguard_lang")');
    expect(judgeDemoSource).toContain(
      'localStorage.setItem("semiguard_lang", lang)'
    );
    expect(judgeDemoSource).toContain(
      'lang === "ko" ? "ko-KR" : lang === "ja" ? "ja-JP" : "en-US"'
    );
  });

  it("uses localized document titles for Korean, English, and Japanese judge-demo sessions", () => {
    expect(judgeDemoSource).toContain('"SemiGuard AI 심사위원 읽기 전용 데모"');
    expect(judgeDemoSource).toContain('"SemiGuard AI Read-only Judge Demo"');
    expect(judgeDemoSource).toContain(
      '"SemiGuard AI 審査員向け読み取り専用デモ"'
    );
  });
});
