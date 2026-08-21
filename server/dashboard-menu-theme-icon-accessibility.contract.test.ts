import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(
  resolve(process.cwd(), "client/src/pages/Dashboard.tsx"),
  "utf8"
);

describe("dashboard menu theme icon accessibility contract", () => {
  it("keeps the theme label available while hiding its decorative icon", () => {
    expect(dashboardSource).toContain('<span aria-hidden="true">{isDark ? "☀️" : "🌙"}</span>');
    expect(dashboardSource).toContain('lang === "ko" ? "라이트"');
    expect(dashboardSource).toContain('lang === "ja" ? "ライト"');
    expect(dashboardSource).toContain('"Light"');
  });
});
