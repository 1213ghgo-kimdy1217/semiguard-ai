import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const viteConfigSource = readFileSync(resolve(process.cwd(), "vite.config.ts"), "utf8");

describe("dashboard bundle splitting contract", () => {
  it("uses Vite's dependency graph instead of manual chunks that can change circular-module initialization order", () => {
    expect(viteConfigSource).not.toContain("manualChunks(id)");
  });

  it("keeps the dashboard module lazy-loaded so authentication views do not eagerly load dashboard code", () => {
    const appSource = readFileSync(resolve(process.cwd(), "client/src/App.tsx"), "utf8");
    expect(appSource).toContain('lazy(() => import("./pages/Dashboard"))');
  });
});
