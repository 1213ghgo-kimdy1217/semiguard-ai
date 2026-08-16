import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("dashboard card decorative icon contract", () => {
  it("keeps sensor and impact card labels as the accessible name instead of repeating decorative icons", () => {
    expect(dashboardSource).toContain('<span className="text-base opacity-70" aria-hidden="true">{icon}</span>');
    expect(dashboardSource).toContain('<span className="text-lg" aria-hidden="true">{icon}</span>');
  });
});

