import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const serverSource = readFileSync(
  resolve(process.cwd(), "server/_core/index.ts"),
  "utf8"
);

describe("health endpoint contract", () => {
  it("serves a cache-safe unauthenticated health response before tRPC and static routes", () => {
    expect(serverSource).toContain('app.get("/api/health", (_req, res) => {');
    expect(serverSource).toContain('res.set("Cache-Control", "no-store");');
    expect(serverSource).toContain('res.status(200).json({ status: "ok" });');
    expect(serverSource.indexOf('app.get("/api/health"')).toBeLessThan(
      serverSource.indexOf('"/api/trpc"')
    );
    expect(serverSource.indexOf('app.get("/api/health"')).toBeLessThan(
      serverSource.indexOf("serveStatic(app)")
    );
  });
});
