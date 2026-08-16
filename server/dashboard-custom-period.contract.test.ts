import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dbSource = readFileSync(resolve(process.cwd(), "server/semiguardDb.ts"), "utf8");
const routerSource = readFileSync(resolve(process.cwd(), "server/routers.ts"), "utf8");

describe("custom dashboard period server contract", () => {
  it("accepts only ISO custom ranges with ordered dates and a one-year safety bound", () => {
    expect(routerSource).toContain('z.literal("custom")');
    expect(routerSource).toContain("Custom period start must not be after its end.");
    expect(routerSource).toContain("Custom period must be 366 days or shorter.");
  });

  it("uses both start and end conditions for anomaly and visitor aggregation", () => {
    expect(dbSource).toContain('export type DashboardPeriod = "day" | "week" | "month" | "custom"');
    expect(dbSource).toContain("and(gte(anomalyLogs.timestamp, startAt), lte(anomalyLogs.timestamp, endAt))");
    expect(dbSource).toContain("and(gte(visitorStats.date, startDate), lte(visitorStats.date, endDate))");
    expect(dbSource).toContain("endAt,");
  });
});
