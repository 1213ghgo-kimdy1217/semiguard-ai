import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("product usage loading accessibility contract", () => {
  it("announces product usage metric loading as an atomic polite status in every supported language", () => {
    expect(source).toContain('productUsageMetricsQuery.isLoading ? <div className="grid grid-cols-2 gap-2 sm:grid-cols-6" role="status" aria-live="polite" aria-atomic="true" aria-label={lang === "ko" ? "제품 사용 지표를 불러오는 중" : lang === "ja" ? "プロダクト利用指標を読み込み中" : "Loading product usage metrics"}');
  });
});
