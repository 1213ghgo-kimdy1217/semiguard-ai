import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("AI alert panel Japanese contract", () => {
  it("renders the danger-alert confirmation control in Japanese", () => {
    expect(dashboardSource).toContain('lang === "ja" ? "確認" : "OK"');
  });

  it("localizes AI panel risk levels and score units for Japanese", () => {
    expect(dashboardSource).toContain('llmAnalysis.riskLevel === "danger" ? "危険"');
    expect(dashboardSource).toContain('llmAnalysis.riskLevel === "warning" ? "警告" : "注意"');
    expect(dashboardSource).toContain('lang === "ja" ? "点" : ""');
  });
});
