import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("chat modal focus management contract", () => {
  it("focuses the close action when the consultation opens and restores the launch action when it closes", () => {
    expect(dashboardSource).toContain("const chatLaunchButtonRef = useRef<HTMLButtonElement>(null);");
    expect(dashboardSource).toContain("const chatCloseButtonRef = useRef<HTMLButtonElement>(null);");
    expect(dashboardSource).toContain("chatCloseButtonRef.current?.focus()");
    expect(dashboardSource).toContain("chatLaunchButtonRef.current?.focus()");
  });

  it("exposes the consultation as a labelled modal dialog", () => {
    expect(dashboardSource).toContain('role="dialog"');
    expect(dashboardSource).toContain('aria-modal="true"');
    expect(dashboardSource).toContain('aria-labelledby="chat-dialog-title"');
  });
});
