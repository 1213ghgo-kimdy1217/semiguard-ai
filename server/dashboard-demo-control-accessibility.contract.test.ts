import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("dashboard demo auto-run control accessibility contract", () => {
  it("exposes the auto-run toggle with localized naming and pressed state", () => {
    expect(dashboardSource).toContain('"데모 자동 실행"');
    expect(dashboardSource).toContain('"デモ自動実行"');
    expect(dashboardSource).toContain('"Demo auto-run"');
    expect(dashboardSource).toMatch(/setDemoRunning\(r => !r\)[\s\S]*?aria-pressed=\{demoRunning\}/);
    expect(dashboardSource).toContain('<><span aria-hidden="true">▶</span> {lang === "ko" ? "데모" : lang === "ja" ? "デモ" : "Demo"}</>');
  });
});
