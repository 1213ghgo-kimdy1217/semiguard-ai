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
});
