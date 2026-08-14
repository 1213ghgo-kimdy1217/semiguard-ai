import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("consultation history date preset contract", () => {
  it("provides all, today, seven-day, and thirty-day date presets", () => {
    expect(dashboardSource).toContain('useState<"all" | "today" | "week" | "month" | "custom">(() =>');
    expect(dashboardSource).toContain("const applyHistoryDatePreset");
    expect(dashboardSource).toContain('id: "today"');
    expect(dashboardSource).toContain('id: "week"');
    expect(dashboardSource).toContain('id: "month"');
  });

  it("marks manual date edits as custom and resets both dates for the all preset", () => {
    expect(dashboardSource).toContain('setHistorySessionDatePreset("custom")');
    expect(dashboardSource).toContain('applyHistoryDatePreset("all")');
    expect(dashboardSource).toContain('ja: "今日"');
  });
});
