import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const dashboard = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("anomaly-log export source traceability", () => {
  it("includes the observation-log ID as the first anomaly-history CSV field in all supported languages", () => {
    expect(dashboard).toContain('"관측 로그 ID"');
    expect(dashboard).toContain('"Observation log ID"');
    expect(dashboard).toContain('"観測ログID"');
    expect(dashboard).toContain("escape(log.id)");
  });

  it("states that period aggregates do not contain individual log IDs in Korean, English, and Japanese", () => {
    expect(dashboard).toContain("개별 관측 로그 ID는 이상 이력 CSV에서 확인할 수 있습니다");
    expect(dashboard).toContain("individual observation log IDs are available in the anomaly-history CSV");
    expect(dashboard).toContain("個別の観測ログIDは異常履歴CSVで確認できます");
  });
});
