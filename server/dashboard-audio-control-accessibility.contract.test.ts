import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("dashboard audio control accessibility contract", () => {
  it("exposes the alert-mute icon control with localized naming and pressed state", () => {
    expect(dashboardSource).toContain('"알림 음소거"');
    expect(dashboardSource).toContain('"通知音をミュート"');
    expect(dashboardSource).toContain('"Mute alerts"');
    expect(dashboardSource).toMatch(/title=\{muted[\s\S]*?aria-pressed=\{muted\}/);
  });
});
