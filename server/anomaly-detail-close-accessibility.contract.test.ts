import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("anomaly detail close accessibility contract", () => {
  it("provides a localized accessible name for closing the anomaly detail modal", () => {
    expect(dashboardSource).toContain('aria-label={lang === "ko" ? "이상 이력 상세 닫기" : lang === "ja" ? "異常履歴詳細を閉じる" : "Close anomaly detail"}');
    expect(dashboardSource).toContain("onClick={() => setSelectedLog(null)}");
  });
});
