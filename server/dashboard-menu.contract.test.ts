import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(
  resolve(process.cwd(), "client/src/pages/Dashboard.tsx"),
  "utf8",
);

describe("dashboard slide menu interaction contract", () => {
  it("exposes an accessible menu trigger and dialog relationship", () => {
    expect(dashboardSource).toContain('id="dashboard-settings-menu"');
    expect(dashboardSource).toContain('aria-controls="dashboard-settings-menu"');
    expect(dashboardSource).toContain("aria-expanded={menuOpen}");
    expect(dashboardSource).toContain("onClick={() => setMenuOpen(true)}");
  });

  it("supports closing by backdrop and Escape while locking body scroll", () => {
    expect(dashboardSource).toContain('if (event.key !== "Escape") return;');
    expect(dashboardSource).toContain("event.preventDefault();\n        setMenuOpen(false);");
    expect(dashboardSource).toContain('document.body.style.overflow = "hidden"');
    expect(dashboardSource).toContain("onClick={() => setMenuOpen(false)}");
  });

  it("keeps existing controls connected through stable action targets", () => {
    expect(dashboardSource).toContain('document.getElementById("btn-export-pdf")?.click()');
    expect(dashboardSource).toContain('document.getElementById("btn-logout")?.click()');
    expect(dashboardSource).toContain("setDemoRunning(r => !r)");
    expect(dashboardSource).toContain('localStorage.setItem("semiguard_muted"');
  });

  it("exposes account linking for all supported social providers", () => {
    expect(dashboardSource).toContain("trpc.auth.socialLinks.useQuery()");
    expect(dashboardSource).toContain("startGoogleLink");
    expect(dashboardSource).toContain("startNaverLink");
    expect(dashboardSource).toContain("startKakaoLink");
    expect(dashboardSource).toContain("unlinkSocialMutation");
  });
});
