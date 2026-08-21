import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(
  resolve(process.cwd(), "client/src/pages/Dashboard.tsx"),
  "utf8"
);

describe("feedback load error decorative icon contract", () => {
  it("keeps warning symbols decorative while retaining localized error copy", () => {
    expect(dashboardSource).toContain(
      '<span aria-hidden="true" className="text-base">⚠️</span>'
    );
    expect(dashboardSource.match(/<span aria-hidden="true" className="text-base">⚠️<\/span>/g)).toHaveLength(2);
    expect(dashboardSource).toContain("상담 맥락을 불러오지 못했습니다");
    expect(dashboardSource).toContain("피드백 이력을 불러오지 못했습니다");
  });
});
