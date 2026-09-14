import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const routerSource = readFileSync(resolve(process.cwd(), "server/routers.ts"), "utf8");
const dbSource = readFileSync(resolve(process.cwd(), "server/semiguardDb.ts"), "utf8");
const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");
const sharedTypeSource = readFileSync(resolve(process.cwd(), "shared/semiguard.ts"), "utf8");

describe("anomaly analysis log link contract", () => {
  it("returns the exact generated log ID for injected and automatically polled observations", () => {
    expect(dbSource).toContain(".$returningId()");
    expect(dbSource).toContain("export async function getAnomalyLogById");
    expect(routerSource.match(/const logId = await insertAnomalyLog/g)).toHaveLength(5);
    expect(routerSource.match(/logId: logId \?\? undefined/g)).toHaveLength(5);
    expect(sharedTypeSource).toContain("logId?: number");
  });

  it("sends the observation log ID to AI analysis and never falls back to the latest log", () => {
    expect(dashboardSource).toContain("logId: result.logId");
    expect(routerSource).toContain("logId: z.number().int().positive().optional()");
    expect(routerSource).toContain("const targetLog = logId ? await getAnomalyLogById(logId, ctx.user.id) : null;");
    expect(routerSource).toContain("const matchesTargetLog = targetLog");
    expect(routerSource).toContain("if (matchesTargetLog && logId)");
    expect(routerSource).toContain("await updateAnomalyLogLlm(logId, ctx.user.id,");
    expect(routerSource).not.toContain("logId ?? await getLastInsertedLogId()");
    expect(routerSource).not.toContain("getLastInsertedLogId");
    expect(dbSource).not.toContain("getLastInsertedLogId");
  });
});
