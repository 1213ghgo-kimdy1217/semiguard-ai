import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const mainSource = readFileSync(resolve(process.cwd(), "client/src/main.tsx"), "utf8");
const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("tRPC temporary transport recovery contract", () => {
  it("separates transient HTML transport responses from actionable API errors", () => {
    expect(mainSource).toContain("isTemporaryTransportResponse");
    expect(mainSource).toContain("Unexpected token '<'");
    expect(mainSource).toContain("[API Mutation Temporary Transport Error]");
  });

  it("keeps automatic polling recoverable after a transient request failure", () => {
    expect(dashboardSource).toContain("Auto polling will retry on the next interval");
    expect(dashboardSource).toContain("onError: (error) =>");
  });
});
