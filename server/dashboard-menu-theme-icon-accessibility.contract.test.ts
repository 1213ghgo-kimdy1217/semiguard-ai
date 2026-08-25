import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(
  resolve(process.cwd(), "client/src/pages/Dashboard.tsx"),
  "utf8"
);

describe("dashboard menu theme icon accessibility contract", () => {
  it("keeps the theme state and switching intent available while hiding its decorative icon", () => {
    expect(dashboardSource).toContain('<span aria-hidden="true">{isDark ? "☀️" : "🌙"}</span>');
    expect(dashboardSource).toContain("aria-pressed={isDark}");
    expect(dashboardSource).toContain('현재 ${isDark ? "다크" : "라이트"} 모드.');
    expect(dashboardSource).toContain('現在${isDark ? "ダーク" : "ライト"}モード。');
    expect(dashboardSource).toContain('Currently ${isDark ? "dark" : "light"} mode.');
    expect(dashboardSource).toContain('lang === "ko" ? "라이트"');
    expect(dashboardSource).toContain('lang === "ja" ? "ライト"');
    expect(dashboardSource).toContain('"Light"');
  });
});
