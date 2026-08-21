import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("history loading status accessibility contract", () => {
  it("announces consultation history loading without exposing the decorative spinner", () => {
    expect(dashboardSource).toContain('text-xs text-muted-foreground gap-2" role="status" aria-live="polite" aria-atomic="true"');
    expect(dashboardSource).toContain('border-sky-500 border-t-transparent rounded-full animate-spin" aria-hidden="true"');
    expect(dashboardSource).toContain('"기록 검색 중..."');
    expect(dashboardSource).toContain('"Loading history..."');
  });

  it("announces feedback context and feedback history loading without exposing their spinners", () => {
    expect(dashboardSource).toContain('gap-2 py-8 text-[10px]" role="status" aria-live="polite" aria-atomic="true"');
    expect(dashboardSource).toContain('border-fuchsia-400 border-t-transparent" aria-hidden="true"');
    expect(dashboardSource).toContain('text-xs text-muted-foreground" role="status" aria-live="polite" aria-atomic="true"');
    expect(dashboardSource).toContain('border-fuchsia-500 border-t-transparent rounded-full animate-spin" aria-hidden="true"');
    expect(dashboardSource).toContain('"Loading conversation context..."');
    expect(dashboardSource).toContain('"Loading feedback history..."');
  });
});
