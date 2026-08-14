import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("dashboard safety Japanese localization contract", () => {
  it("localizes safety chart and heatmap status text in Japanese", () => {
    expect(dashboardSource).toContain("リスクスコア推移（直近50件）");
    expect(dashboardSource).toContain("月間リスクヒートマップ");
    expect(dashboardSource).toContain("データが蓄積されるとグラフが表示されます。");
    expect(dashboardSource).toContain('warning: "警告"');
  });

  it("localizes anomaly log notifications, filters, and result counts in Japanese", () => {
    expect(dashboardSource).toContain("新しい記録が${newLogCount}件追加されました");
    expect(dashboardSource).toContain("クリックして閉じる");
    expect(dashboardSource).toContain("${filteredLogs.length}件表示");
    expect(dashboardSource).toContain('lang === "ja" ? "危険" : "Danger"');
    expect(dashboardSource).toContain('lang === "ja" ? "リセット" : "Reset"');
  });
});
