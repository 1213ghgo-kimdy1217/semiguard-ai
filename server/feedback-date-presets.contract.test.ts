import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("feedback quick date presets contract", () => {
  it("offers all, today, seven-day, and thirty-day ranges with explicit date values", () => {
    expect(dashboardSource).toContain('const [feedbackHistoryDatePreset, setFeedbackHistoryDatePreset] = useState<"all" | "today" | "week" | "month" | "custom">(() => {');
    expect(dashboardSource).toContain('const applyFeedbackDatePreset = (preset: "all" | "today" | "week" | "month") =>');
    expect(dashboardSource).toContain('if (preset === "week") start.setDate(start.getDate() - 6);');
    expect(dashboardSource).toContain('if (preset === "month") start.setDate(start.getDate() - 29);');
  });

  it("renders localized quick period controls and marks manual date editing as custom", () => {
    expect(dashboardSource).toContain('lang === "ja" ? "クイック期間"');
    expect(dashboardSource).toContain('onClick={() => applyFeedbackDatePreset(preset.id)}');
    expect(dashboardSource).toContain('setFeedbackHistoryDatePreset("custom")');
  });
});
