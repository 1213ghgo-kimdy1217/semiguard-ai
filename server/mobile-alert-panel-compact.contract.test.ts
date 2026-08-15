import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("mobile alert panel compact contract", () => {
  it("compresses visual labels below the small breakpoint while retaining the full accessible status", () => {
    expect(dashboardSource).toContain('role="img" aria-label={label} title={label}');
    expect(dashboardSource).toContain('hidden text-xs font-semibold text-muted-foreground sm:inline');
    expect(dashboardSource).toContain('className="hidden h-2.5 w-2.5 rounded-full sm:block"');
    expect(dashboardSource).toContain('<span className="text-[10px] font-semibold sm:text-xs" style={{ color: isDanger ? "#ef4444" : "#22c55e" }}>{isDanger ? t.danger : t.normal}</span>');
    expect(dashboardSource).toContain('<div className="hidden items-center gap-1.5 sm:flex">');
  });
});
