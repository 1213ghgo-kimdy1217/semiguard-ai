import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const appSource = readFileSync(resolve(process.cwd(), "client/src/App.tsx"), "utf8");

describe("dashboard module loading recovery", () => {
  it("offers refresh and login navigation after the Dashboard Suspense fallback is slow", () => {
    expect(appSource).toContain("function DashboardModuleLoading()");
    expect(appSource).toContain('const [, setLocation] = useLocation();');
    expect(appSource).toContain('onClick={() => window.location.reload()}');
    expect(appSource).toContain('onClick={() => setLocation("/login")}');
    expect(appSource).toContain("{copy.login}");
  });

  it("uses the same module-loading fallback for the protected dashboard route", () => {
    expect(appSource).toContain("<Suspense fallback={<DashboardModuleLoading />}>");
    expect(appSource).toContain("<Dashboard />");
  });
});
