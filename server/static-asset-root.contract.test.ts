import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const viteServerSource = readFileSync(resolve(process.cwd(), "server/_core/vite.ts"), "utf8");

describe("production static asset root contract", () => {
  it("selects a static root only when both index.html and assets are present", () => {
    expect(viteServerSource).toContain('path.join(candidate, "index.html")');
    expect(viteServerSource).toContain('path.join(candidate, "assets")');
  });

  it("falls back to the project dist/public build output for deployment layouts", () => {
    expect(viteServerSource).toContain('path.resolve(process.cwd(), "dist", "public")');
  });
});
