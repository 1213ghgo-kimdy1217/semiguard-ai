import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("anomaly detail modal focus trap contract", () => {
  it("keeps Tab and Shift+Tab focus inside the detail modal", () => {
    expect(dashboardSource).toContain('if (event.key === "Tab")');
    expect(dashboardSource).toContain("event.preventDefault();\n        selectedLogCloseRef.current?.focus();");
  });
});
