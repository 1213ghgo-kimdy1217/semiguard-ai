import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("mobile slide menu focus contract", () => {
  it("moves focus to the menu close control after opening and restores it to the trigger after closing", () => {
    expect(dashboardSource).toContain("const menuTriggerRef = useRef<HTMLButtonElement>(null);");
    expect(dashboardSource).toContain("const menuCloseButtonRef = useRef<HTMLButtonElement>(null);");
    expect(dashboardSource).toContain("menuCloseButtonRef.current?.focus()");
    expect(dashboardSource).toContain("menuTriggerRef.current?.focus()");
  });

  it("closes the menu with Escape without leaking the key event", () => {
    expect(dashboardSource).toContain('if (event.key !== "Escape") return;');
    expect(dashboardSource).toContain("event.preventDefault();\n        setMenuOpen(false);");
  });
});
