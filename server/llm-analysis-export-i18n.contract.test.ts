import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("LLM analysis export localization contract", () => {
  it("uses a localized text download filename for Korean, English, and Japanese", () => {
    expect(dashboardSource).toContain('"세미가드_AI분석결과"');
    expect(dashboardSource).toContain('"セミガード_AI分析結果"');
    expect(dashboardSource).toContain('"semiguard_ai_analysis"');
    expect(dashboardSource).toContain("anchor.download = `${filenamePrefix}_${new Date().toISOString().slice(0, 10)}.txt`");
  });

  it("uses a localized popup-block error for the print report window", () => {
    expect(dashboardSource).toContain('"분석 보고서 창을 열 수 없습니다."');
    expect(dashboardSource).toContain('"分析レポートウィンドウを開けませんでした。"');
    expect(dashboardSource).toContain('"Could not open the analysis report window."');
  });
});
