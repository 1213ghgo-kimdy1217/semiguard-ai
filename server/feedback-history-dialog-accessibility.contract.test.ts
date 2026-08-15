import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("feedback history dialog accessibility contract", () => {
  it("exposes the feedback history overlay as a labeled dialog", () => {
    expect(dashboardSource).toContain('aria-labelledby="feedback-history-panel-title"');
    expect(dashboardSource).toContain('aria-describedby="feedback-history-panel-description"');
    expect(dashboardSource).toContain('id="feedback-history-panel-title"');
    expect(dashboardSource).toContain('id="feedback-history-panel-description"');
  });

  it("labels the feedback history search input in every supported language", () => {
    expect(dashboardSource).toContain('htmlFor="feedback-history-search"');
    expect(dashboardSource).toContain('id="feedback-history-search"');
    expect(dashboardSource).toContain('lang === "ja" ? "フィードバック履歴を検索"');
  });
});
