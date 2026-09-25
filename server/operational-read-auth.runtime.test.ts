import { describe, expect, it } from "vitest";
import type { TrpcContext } from "./_core/context";
import { appRouter } from "./routers";

function createUnauthenticatedContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("operational read authorization", () => {
  it("rejects unauthenticated sensor logs, KPI statistics, and period data before database access", async () => {
    const caller = appRouter.createCaller(createUnauthenticatedContext());

    await expect(caller.semiguard.getLogs({ limit: 10 })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.semiguard.getLogById({ id: 1 })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.semiguard.getStats()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.semiguard.getPeriodOverview({ period: "day" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("rejects unauthenticated risk thresholds and saved AI analysis history", async () => {
    const caller = appRouter.createCaller(createUnauthenticatedContext());

    await expect(caller.semiguard.getThresholds()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.semiguard.getSensorThresholds()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.semiguard.getLlmHistory()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("rejects global threshold changes from a signed-in non-admin before database access", async () => {
    const caller = appRouter.createCaller({
      ...createUnauthenticatedContext(),
      user: { id: 42, role: "user" } as TrpcContext["user"],
    });
    await expect(caller.semiguard.saveThresholds({ normal: 29, caution: 49, warning: 69 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.semiguard.saveSensorThresholds({
      currentCaution: 7, currentWarning: 9, currentDanger: 11,
      tempCaution: 55, tempWarning: 70, tempDanger: 85,
      vibCaution: 2.3, vibWarning: 2.6, vibDanger: 3,
      noiseCaution: 65, noiseWarning: 75, noiseDanger: 85,
    })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
