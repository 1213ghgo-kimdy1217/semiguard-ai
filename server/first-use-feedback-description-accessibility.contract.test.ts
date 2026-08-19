import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("first-use feedback privacy description accessibility contract", () => {
  it("connects the visible data-collection scope text to the open dialog", () => {
    expect(dashboardSource).toContain('const dialog = firstUseFeedbackDialogRef.current?.closest<HTMLElement>(\'[role="dialog"]\');');
    expect(dashboardSource).toContain('description.id = "first-use-feedback-description";');
    expect(dashboardSource).toContain('dialog.setAttribute("aria-describedby", description.id);');
  });
});
