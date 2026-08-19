import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("chat modal focus trap contract", () => {
  it("cycles keyboard focus inside the open consultation dialog", () => {
    expect(dashboardSource).toContain("const chatDialogRef = useRef<HTMLDivElement>(null);");
    expect(dashboardSource).toContain("const trapChatFocus = (event: KeyboardEvent) =>");
    expect(dashboardSource).toContain("if (event.key !== \"Tab\") return;");
    expect(dashboardSource).toContain("lastFocusable.focus();");
    expect(dashboardSource).toContain("firstFocusable.focus();");
  });

  it("links the focus trap to the modal dialog element", () => {
    expect(dashboardSource).toContain("ref={chatDialogRef}");
    expect(dashboardSource).toContain("dialog.querySelectorAll<HTMLElement>");
  });

  it("uses the nested RAG manual dialog as the focus boundary when it is open", () => {
    expect(dashboardSource).toContain("const manualPanelDialogRef = useRef<HTMLDivElement>(null);");
    expect(dashboardSource).toContain("const dialog = showManualRagModal");
    expect(dashboardSource).toContain("? manualPanelDialogRef.current");
    expect(dashboardSource).toContain("ref={manualPanelDialogRef}");
  });
});
