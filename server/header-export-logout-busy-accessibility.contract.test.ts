import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(
  resolve(process.cwd(), "client/src/pages/Dashboard.tsx"),
  "utf8"
);

describe("header export and logout busy accessibility contract", () => {
  it("announces busy state for PDF export and logout", () => {
    expect(dashboardSource).toContain('id="btn-export-pdf"');
    expect(dashboardSource).toContain('aria-busy={pdfExporting || undefined}');
    expect(dashboardSource).toContain('id="btn-logout"');
    expect(dashboardSource).toContain('aria-busy={logoutMutation.isPending || undefined}');
    expect(dashboardSource).toContain("Logging out…");
  });
});
