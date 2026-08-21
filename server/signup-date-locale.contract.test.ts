import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const signupSource = readFileSync(resolve(process.cwd(), "client/src/pages/Signup.tsx"), "utf8");

describe("회원가입 생년월일 입력 다국어 맥락 계약", () => {
  it("선택된 언어 로케일과 브라우저별 표기 안내를 생년월일 입력에 전달한다", () => {
    expect(signupSource).toContain('type="date" lang={LANGUAGE_LOCALES[language]}');
    expect(signupSource).toContain("dateHint: \"표시 형식은 브라우저 설정에 따라 달라질 수 있습니다. 날짜 선택기를 사용해 주세요.\"");
    expect(signupSource).toContain("dateHint: \"The displayed format may follow your browser settings. Use the date picker.\"");
    expect(signupSource).toContain("dateHint: \"表示形式はブラウザー設定により異なる場合があります。日付選択を使用してください。\"");
    expect(signupSource).toContain('"dateOfBirth-hint"].filter(Boolean).join(" ")');
  });
});
