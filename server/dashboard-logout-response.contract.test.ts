import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("dashboard tRPC logout contract", () => {
  it("uses the typed logout mutation, clears cached auth state, and redirects only on success", () => {
    expect(dashboardSource).toContain("const logoutMutation = trpc.auth.logout.useMutation({");
    expect(dashboardSource).toContain("void trpcUtils.auth.me.invalidate();");
    expect(dashboardSource).toContain('setLocation("/login");');
    expect(dashboardSource).toContain("onClick={() => logoutMutation.mutate()}");
    expect(dashboardSource).not.toContain('fetch("/api/trpc/auth.logout"');
  });

  it("shows a pending state and retains localized failure feedback", () => {
    expect(dashboardSource).toContain("disabled={logoutMutation.isPending}");
    expect(dashboardSource).toContain('lang === "ko" ? "로그아웃 중…" : lang === "ja" ? "ログアウト中…" : "Logging out…"');
    expect(dashboardSource).toContain('lang === "ja" ? "ログアウトに失敗しました" : "Logout failed"');
  });
});
