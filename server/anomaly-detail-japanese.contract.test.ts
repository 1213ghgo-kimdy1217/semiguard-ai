import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("anomaly detail Japanese locale contract", () => {
  it("localizes every sensor name in the anomaly detail modal", () => {
    expect(dashboardSource).toContain('lang === "ja" ? "電流" : "Current"');
    expect(dashboardSource).toContain('lang === "ja" ? "温度" : "Temperature"');
    expect(dashboardSource).toContain('lang === "ja" ? "振動" : "Vibration"');
    expect(dashboardSource).toContain('lang === "ja" ? "騒音" : "Noise"');
  });

  it("localizes all four risk stages in the anomaly detail modal", () => {
    expect(dashboardSource).toContain('lvl === "danger" ? "危険" : lvl === "warning" ? "警告" : lvl === "caution" ? "注意" : "正常"');
  });
});
