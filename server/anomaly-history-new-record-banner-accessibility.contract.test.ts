import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(
  resolve(process.cwd(), "client/src/pages/Dashboard.tsx"),
  "utf8"
);

describe("anomaly history new-record banner accessibility", () => {
  it("keeps the localized record update and dismiss action while hiding only the decorative bell", () => {
    expect(dashboardSource).toContain(
      '<span aria-hidden="true">🔔</span>'
    );
    expect(dashboardSource).toContain("새 기록 ${newLogCount}건이 추가되었습니다");
    expect(dashboardSource).toContain("新しい記録が${newLogCount}件追加されました");
    expect(dashboardSource).toContain("new record${newLogCount > 1 ? \"s\" : \"\"} added");
    expect(dashboardSource).toContain("새 이상 이력 ${newLogCount}건 알림 닫기");
  });
});
