import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("dashboard tabs accessibility contract", () => {
  it("communicates tab selection and links every tab to its active panel", () => {
    expect(dashboardSource).toContain('role="tablist"');
    expect(dashboardSource).toContain('role="tab"');
    expect(dashboardSource).toContain('aria-selected={activeTab === tab}');
    expect(dashboardSource).toContain('aria-controls={`dashboard-panel-${tab}`}');
    expect(dashboardSource).toContain('role="tabpanel"');
    expect(dashboardSource).toContain('aria-labelledby={`dashboard-tab-${activeTab}`}');
  });

  it("allows arrow keys to change the selected dashboard view and retain focus", () => {
    expect(dashboardSource).toContain('event.key === "ArrowRight"');
    expect(dashboardSource).toContain('event.key === "ArrowLeft"');
    expect(dashboardSource).toContain('document.getElementById(`dashboard-tab-${nextTab}`)?.focus()');
  });

  it("allows Home and End keys to select the first and last dashboard tabs", () => {
    expect(dashboardSource).toContain('event.key === "Home" ? "dashboard"');
    expect(dashboardSource).toContain('event.key === "End" ? "log"');
  });
});
