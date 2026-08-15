import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("mobile alert panel compact contract", () => {
  it("compresses visual labels below the small breakpoint while retaining the full accessible status", () => {
    expect(dashboardSource).toContain('role="img" aria-label={label} title={label}');
    expect(dashboardSource).toContain('hidden text-xs font-semibold text-muted-foreground sm:inline');
    expect(dashboardSource).toContain('className="h-2.5 w-2.5 rounded-full sm:hidden"');
    expect(dashboardSource).toContain('<span className="hidden sm:inline">{relayTripped ? t.relayActive : t.relayInactive}</span>');
  });
});
