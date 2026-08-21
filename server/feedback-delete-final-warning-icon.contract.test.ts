import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(
  resolve(process.cwd(), "client/src/pages/Dashboard.tsx"),
  "utf8"
);

describe("feedback deletion final confirmation warning icon contract", () => {
  it("keeps the destructive-action warning icon decorative while retaining the dialog label", () => {
    expect(dashboardSource).toContain('aria-labelledby="feedback-delete-all-final-confirm-title"');
    expect(dashboardSource).toContain('<span aria-hidden="true" className="mb-2 flex h-9 w-9');
    expect(dashboardSource).toContain("최종 확인: 모든 피드백을 영구 삭제할까요?");
  });
});
