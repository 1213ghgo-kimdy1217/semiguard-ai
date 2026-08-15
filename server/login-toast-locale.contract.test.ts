import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const loginSource = readFileSync(resolve(process.cwd(), "client/src/pages/Login.tsx"), "utf8");

describe("login toast locale contract", () => {
  it("provides Japanese and English messages for preview, validation, success, and failure flows", () => {
    expect(loginSource).toContain('previewSocialDisabled: "開発プレビューではソーシャルログインを利用できません。');
    expect(loginSource).toContain('previewSocialDisabled: "Social login is unavailable in the development preview.');
    expect(loginSource).toContain('badgeRequired: "社員証番号を入力してください。"');
    expect(loginSource).toContain('passwordRequired: "Enter your password."');
    expect(loginSource).toContain('succeeded: "ログインが完了しました。"');
    expect(loginSource).toContain('failed: "Login failed. Check your badge number or password."');
  });

  it("routes every login toast through the selected-language message set", () => {
    expect(loginSource).toContain("toast.info(loginMessages.previewSocialDisabled);");
    expect(loginSource).toContain("toast.error(loginMessages.badgeRequired);");
    expect(loginSource).toContain("toast.error(loginMessages.passwordRequired);");
    expect(loginSource).toContain("toast.success(loginMessages.succeeded);");
    expect(loginSource).toContain("toast.error(loginMessages.failed);");
  });
});
