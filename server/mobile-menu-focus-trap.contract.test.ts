import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("mobile slide menu focus trap contract", () => {
  it("keeps Tab and Shift+Tab navigation inside the open menu panel", () => {
    expect(dashboardSource).toContain("const menuPanelRef = useRef<HTMLElement>(null);");
    expect(dashboardSource).toContain("menuPanelRef.current?.querySelectorAll<HTMLElement>(");
    expect(dashboardSource).toContain('if (event.key !== "Tab") return;');
    expect(dashboardSource).toContain("if (event.shiftKey && document.activeElement === firstFocusable)");
    expect(dashboardSource).toContain("} else if (!event.shiftKey && document.activeElement === lastFocusable)");
  });

  it("connects the focus trap to the dialog panel", () => {
    expect(dashboardSource).toContain("ref={menuPanelRef}");
    expect(dashboardSource).toContain('aria-modal="true"');
  });
});
