import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(
  resolve(process.cwd(), "client/src/pages/Dashboard.tsx"),
  "utf8"
);

describe("dashboard date filter locale contract", () => {
  it("keeps consultation, feedback, and custom-period native date controls aligned with the selected locale", () => {
    const dateLocale = 'lang={lang === "ko" ? "ko-KR" : lang === "ja" ? "ja-JP" : "en-US"}';

    expect(dashboardSource).toContain('id="consultation-history-start-date"');
    expect(dashboardSource).toContain('id="consultation-history-end-date"');
    expect(dashboardSource).toContain("feedbackHistoryStartDate");
    expect(dashboardSource).toContain("feedbackHistoryEndDate");
    expect(dashboardSource).toContain("customStartDate");
    expect(dashboardSource).toContain("customEndDate");
    expect(dashboardSource.split(dateLocale)).toHaveLength(9);
  });
});
