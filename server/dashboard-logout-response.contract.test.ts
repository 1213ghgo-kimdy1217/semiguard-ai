import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("dashboard logout response contract", () => {
  it("verifies the logout HTTP response before redirecting to the login screen", () => {
    expect(dashboardSource).toContain('const response = await fetch("/api/trpc/auth.logout", { method: "POST" });');
    expect(dashboardSource).toContain('if (!response.ok) throw new Error(`Logout request failed with ${response.status}`);');
    expect(dashboardSource).toContain('setLocation("/login");');
  });

  it("retains the localized failure notice when logout transport fails", () => {
    expect(dashboardSource).toContain('lang === "ja" ? "ログアウトに失敗しました" : "Logout failed"');
  });
});
