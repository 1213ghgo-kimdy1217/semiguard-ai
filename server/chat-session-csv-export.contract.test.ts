import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("consultation history CSV export contract", () => {
  it("exports the full current filtered and sorted session result, not only the current page", () => {
    expect(dashboardSource).toContain("const exportFilteredChatSessionsCsv = () =>");
    expect(dashboardSource).toContain("filteredAndSortedChatSessions.map(session");
    expect(dashboardSource).toContain("semiguard-consultations-");
    expect(dashboardSource).toContain("text/csv;charset=utf-8;");
  });

  it("includes localized session metadata and protects an empty result", () => {
    expect(dashboardSource).toContain("내보낼 상담 기록이 없습니다.");
    expect(dashboardSource).toContain('"상담 제목", "고정 여부", "메시지 수", "마지막 갱신 시각"');
    expect(dashboardSource).toContain('lang === "ja" ? "固定"');
    expect(dashboardSource).toContain("onClick={exportFilteredChatSessionsCsv}");
  });
});
