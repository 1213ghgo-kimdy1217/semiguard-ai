import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(
  resolve(process.cwd(), "client/src/pages/Dashboard.tsx"),
  "utf8"
);

describe("consultation title save busy accessibility contract", () => {
  it("announces the title-save mutation while preserving localized success and error messages", () => {
    expect(dashboardSource).toContain('aria-busy={updateSessionTitleMutation.isPending || undefined}');
    expect(dashboardSource).toContain("상담 기록 제목을 수정했습니다.");
    expect(dashboardSource).toContain("Could not update the consultation title.");
  });
});
