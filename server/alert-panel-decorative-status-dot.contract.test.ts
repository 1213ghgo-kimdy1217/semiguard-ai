import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(
  resolve(process.cwd(), "client/src/pages/Dashboard.tsx"),
  "utf8"
);

describe("alert panel decorative status dot contract", () => {
  it("keeps the alert label authoritative while hiding status dots from assistive technology", () => {
    expect(dashboardSource).toContain('role="img" aria-label={label}');
    expect(dashboardSource).toContain('aria-hidden="true" className="hidden h-2.5 w-2.5 rounded-full sm:block"');
    expect(dashboardSource).toContain('aria-hidden="true" style={{ background: relayTripped ? "#ef4444" : "#22c55e" }}');
  });
});
