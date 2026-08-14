import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const viteConfigSource = readFileSync(resolve(process.cwd(), "vite.config.ts"), "utf8");

describe("dashboard bundle splitting contract", () => {
  it("keeps stable React, chart, UI, and data dependencies in named cacheable chunks", () => {
    expect(viteConfigSource).toContain("manualChunks(id)");
    expect(viteConfigSource).toContain('return "react-runtime"');
    expect(viteConfigSource).toContain('return "charts"');
    expect(viteConfigSource).toContain('return "ui-runtime"');
    expect(viteConfigSource).toContain('return "data-runtime"');
  });

  it("does not force the already lazy PDF libraries into the initial dashboard bundle", () => {
    expect(viteConfigSource).not.toContain('return "pdf-runtime"');
    expect(viteConfigSource).toContain('id.includes("/recharts/")');
  });
});
