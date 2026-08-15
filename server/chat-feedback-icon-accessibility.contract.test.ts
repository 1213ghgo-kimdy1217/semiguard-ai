import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("chat and feedback icon accessibility contract", () => {
  it("labels history and feedback search clear controls in all supported languages", () => {
    expect(dashboardSource).toContain('"상담 기록 검색 지우기"');
    expect(dashboardSource).toContain('"相談履歴の検索をクリア"');
    expect(dashboardSource).toContain('"Clear consultation history search"');
    expect(dashboardSource).toContain('"피드백 검색 지우기"');
    expect(dashboardSource).toContain('"フィードバック検索をクリア"');
    expect(dashboardSource).toContain('"Clear feedback search"');
  });

  it("labels the feedback reason close control in all supported languages", () => {
    expect(dashboardSource).toContain('"피드백 사유 선택 닫기"');
    expect(dashboardSource).toContain('"フィードバック理由の選択を閉じる"');
    expect(dashboardSource).toContain('"Close feedback reason selection"');
  });
});
