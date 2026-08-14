import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const appSource = readFileSync(resolve(process.cwd(), "client/src/App.tsx"), "utf8");

describe("dashboard lazy-loading contract", () => {
  it("splits the authenticated dashboard from the initial route bundle", () => {
    expect(appSource).toContain('const Dashboard = lazy(() => import("./pages/Dashboard"))');
    expect(appSource).toContain("<Suspense fallback={<DashboardModuleLoading />}>");
    expect(appSource).toContain("<Dashboard />");
  });

  it("keeps a visible, accessible pending state while the dashboard module loads", () => {
    expect(appSource).toContain("function DashboardModuleLoading()");
    expect(appSource).toContain('role="status"');
    expect(appSource).toContain('aria-live="polite"');
    expect(appSource).toContain("SemiGuard AI 대시보드를 준비하고 있습니다.");
  });
});
