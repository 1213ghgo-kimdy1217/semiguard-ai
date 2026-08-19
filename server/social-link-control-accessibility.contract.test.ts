import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("social account link control accessibility contract", () => {
  it("connects each provider control to its shared signup-first guidance", () => {
    expect(dashboardSource).toContain('id="social-linking-hint"');
    expect(dashboardSource).toContain('aria-describedby="social-linking-hint"');
  });

  it("announces provider-specific linked state and next action in Korean, English, and Japanese", () => {
    expect(dashboardSource).toContain('`${label} 계정이 연결되어 있습니다. 연결을 해제합니다.`');
    expect(dashboardSource).toContain('`${label}アカウントは連携済みです。連携を解除します。`');
    expect(dashboardSource).toContain('`Unlink your connected ${label} account.`');
    expect(dashboardSource).toContain('`${label} 계정을 연결합니다.`');
    expect(dashboardSource).toContain('`${label}アカウントを連携します。`');
    expect(dashboardSource).toContain('`Connect a ${label} account.`');
    expect(dashboardSource).toContain('aria-busy={unlinkSocialMutation.isPending}');
  });
});
