import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("chat header safe-area contract", () => {
  it("reserves mobile top safe-area space while preserving the desktop header padding", () => {
    expect(dashboardSource).toContain('pt-[max(0.75rem,env(safe-area-inset-top))]');
    expect(dashboardSource).toContain('sm:px-5 sm:py-4');
  });
});
