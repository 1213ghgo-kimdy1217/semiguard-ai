import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const dashboard = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("AI analysis history source-log transparency", () => {
  it("shows the linked observation-log number in Korean, English, and Japanese", () => {
    expect(dashboard).toContain("로그 #${item.id}");
    expect(dashboard).toContain("Log #${item.id}");
    expect(dashboard).toContain("ログ #${item.id}");
    expect(dashboard).toContain("출처 관측 로그 ${item.id}");
    expect(dashboard).toContain("View source observation log ${item.id} details");
    expect(dashboard).toContain("出典観測ログ ${item.id}");
  });

  it("explains that newly saved analyses are checked against the same observation log", () => {
    expect(dashboard).toContain("동일 관측 로그의 센서값·점수·위험 단계를 확인한 뒤 저장됩니다");
    expect(dashboard).toContain("same observation log");
    expect(dashboard).toContain("同一観測ログのセンサー値・スコア・危険段階を確認してから保存されます");
  });
});
