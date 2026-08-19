import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("first use feedback save error contract", () => {
  it("keeps a localized retryable error state when saving feedback fails", () => {
    expect(dashboardSource).toContain("const [firstUseFeedbackSaveError, setFirstUseFeedbackSaveError] = useState<string | null>(null);");
    expect(dashboardSource).toContain("첫 사용 피드백을 저장하지 못했습니다. 다시 시도해 주세요.");
    expect(dashboardSource).toContain("初回利用フィードバックを保存できませんでした。もう一度お試しください。");
    expect(dashboardSource).toContain("Could not save first-use feedback. Please try again.");
    expect(dashboardSource).toContain("setFirstUseFeedbackSaveError(errorMessage);");
    expect(dashboardSource).toContain('errorNode.setAttribute("role", "alert");');
    expect(dashboardSource).toContain('errorNode.id = "first-use-feedback-save-error";');
    expect(dashboardSource).toContain("dialog.insertBefore(errorNode, dialog.lastElementChild);");
  });

  it("clears a previous error before retrying, opening, or closing the dialog", () => {
    expect(dashboardSource).toContain("setFirstUseFeedbackSaveError(null);");
  });
});
