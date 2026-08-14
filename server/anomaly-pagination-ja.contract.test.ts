import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("anomaly pagination Japanese locale contract", () => {
  it("localizes range and navigation controls when Japanese is selected", () => {
    expect(dashboardSource).toContain("? `全${filteredLogs.length}件中 ${(logPage - 1) * LOG_PAGE_SIZE + 1}～${Math.min(logPage * LOG_PAGE_SIZE, filteredLogs.length)}件`");
    expect(dashboardSource).toContain('lang === "ko" ? "이전" : lang === "ja" ? "前へ" : "Prev"');
    expect(dashboardSource).toContain('lang === "ko" ? "다음" : lang === "ja" ? "次へ" : "Next"');
  });
});
