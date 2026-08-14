import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("mobile sensor freshness contract", () => {
  it("keeps a compact freshness badge visible below the xl breakpoint", () => {
    expect(dashboardSource).toContain('className="flex h-7 w-7 items-center justify-center rounded-full border sm:w-auto sm:gap-1.5 sm:px-2 xl:hidden"');
    expect(dashboardSource).toContain('className="hidden text-[10px] font-bold sm:inline"');
  });

  it("exposes the full localized freshness status without repeatedly announcing its timer", () => {
    expect(dashboardSource).toContain('role="img" aria-label={sensorFreshnessCopy} title={sensorFreshnessCopy}');
    expect(dashboardSource).toContain('aria-hidden="true" className={`h-2 w-2 rounded-full');
  });
});
