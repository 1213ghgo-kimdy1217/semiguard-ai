import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("RAG manual sort preference contract", () => {
  it("restores a valid sort preference and persists selection changes", () => {
    expect(dashboardSource).toContain('window.localStorage.getItem("semiguard_manual_sort")');
    expect(dashboardSource).toContain('window.localStorage.setItem("semiguard_manual_sort", manualDocumentSort)');
    expect(dashboardSource).toContain('stored === "oldest" || stored === "title" ? stored : "newest"');
  });
});
