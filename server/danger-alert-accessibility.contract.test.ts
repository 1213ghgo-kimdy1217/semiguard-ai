import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("danger alert accessibility contract", () => {
  it("exposes the danger warning as an alert dialog with labeled warning text", () => {
    expect(dashboardSource).toContain('role="alertdialog" aria-modal="true" aria-labelledby="danger-alert-title" aria-describedby="danger-alert-description"');
    expect(dashboardSource).toContain('id="danger-alert-title"');
    expect(dashboardSource).toContain('id="danger-alert-description"');
  });

  it("moves focus to the confirmation control and supports Escape dismissal with focus restoration", () => {
    expect(dashboardSource).toContain("const dangerAlertConfirmRef = useRef<HTMLButtonElement>(null);");
    expect(dashboardSource).toContain("requestAnimationFrame(() => dangerAlertConfirmRef.current?.focus())");
    expect(dashboardSource).toContain('if (event.key === "Escape")');
    expect(dashboardSource).toContain("previouslyFocused?.focus();");
  });
});
