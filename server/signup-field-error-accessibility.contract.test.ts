import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const signupSource = readFileSync(resolve(process.cwd(), "client/src/pages/Signup.tsx"), "utf8");

describe("signup required-field accessibility contract", () => {
  it("connects every validation target to an inline error and moves focus to it", () => {
    expect(signupSource).toContain('aria-busy={isLoading} noValidate');
    for (const field of ["badgeNumber", "name", "dateOfBirth", "password", "passwordConfirm"]) {
      expect(signupSource).toContain(`showFieldError("${field}"`);
      expect(signupSource).toContain(`document.getElementById(field)?.focus()`);
      if (field === "badgeNumber") {
        expect(signupSource).toContain('aria-invalid={fieldError === "badgeNumber" || Boolean(authError)}');
      } else {
        expect(signupSource).toContain(`aria-invalid={fieldError === "${field}"}`);
      }
      expect(signupSource).toContain(`id="${field}-error"`);
    }
  });

  it("clears a field error when the user corrects the relevant value", () => {
    expect(signupSource).toContain('if (fieldError === name || (name === "password" && fieldError === "passwordConfirm"))');
    expect(signupSource).toContain("setFieldError(null);");
    expect(signupSource).toContain("setFieldErrorMessage(null);");
  });

  it("keeps the specific validation message with the field instead of replacing it with a generic label", () => {
    expect(signupSource).toContain("const [fieldErrorMessage, setFieldErrorMessage] = useState<string | null>(null);");
    expect(signupSource).toContain("setFieldErrorMessage(message);");
    expect(signupSource).toContain("{fieldErrorMessage ?? copy.validation.badgeNumber}");
  });

  it("keeps Korean, English, and Japanese validation messages in the existing copy map", () => {
    expect(signupSource).toContain('badgeNumber: "회사 명찰 번호를 입력해주세요."');
    expect(signupSource).toContain('passwordConfirm: "The passwords do not match."');
    expect(signupSource).toContain('dateOfBirth: "生年月日を入力してください。"');
  });
});
