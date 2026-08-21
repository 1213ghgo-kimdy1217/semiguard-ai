import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(
  resolve(process.cwd(), "client/src/pages/Dashboard.tsx"),
  "utf8"
);

describe("feedback deletion busy accessibility contract", () => {
  it("announces busy state for individual and final bulk deletion actions", () => {
    expect(dashboardSource).toContain('aria-busy={deleteChatFeedbackMutation.isPending || undefined}');
    expect(dashboardSource).toContain('aria-busy={deleteAllChatFeedbacksMutation.isPending || undefined}');
    expect(dashboardSource).toContain('role="alertdialog" aria-modal="true" aria-labelledby="feedback-delete-confirm-title"');
    expect(dashboardSource).toContain('aria-labelledby="feedback-delete-all-final-confirm-title"');
    expect(dashboardSource).toContain("Final confirmation: permanently delete all feedback?");
  });
});
