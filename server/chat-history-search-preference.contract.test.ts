import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("chat history search preference contract", () => {
  it("restores and persists the consultation history search query", () => {
    expect(dashboardSource).toContain('window.localStorage.getItem("semiguard_history_search")');
    expect(dashboardSource).toContain('window.localStorage.setItem("semiguard_history_search", searchKeyword)');
  });
});
