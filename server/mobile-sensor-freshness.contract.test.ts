import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("mobile sensor freshness contract", () => {
  it("keeps a compact freshness badge visible below the xl breakpoint", () => {
    expect(dashboardSource).toContain('className="flex h-7 min-w-10 shrink-0 items-center justify-center gap-1 rounded-full border px-2 xl:hidden"');
    expect(dashboardSource).toContain('className="text-[10px] font-bold">{ageSeconds === null ? "…" : `${ageSeconds}s`}</span>');
  });

  it("exposes the full localized freshness status without repeatedly announcing its timer", () => {
    expect(dashboardSource).toContain('role="img" aria-label={label} title={label}');
    expect(dashboardSource).toContain('aria-hidden="true" className={`h-2 w-2 rounded-full');
  });
});
