import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("chat input safe-area contract", () => {
  it("keeps mobile chat input and send controls above the bottom gesture area", () => {
    expect(dashboardSource).toContain('pb-[max(0.625rem,calc(env(safe-area-inset-bottom)+0.5rem))]');
    expect(dashboardSource).toContain('sm:flex-row sm:items-end sm:p-4');
  });
});
