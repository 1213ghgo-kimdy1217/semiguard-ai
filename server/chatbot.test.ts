import { describe, it, expect } from "vitest";
import { appRouter } from "./routers";

describe("SemiGuard AI Chatbot Procedure", () => {
  it("defines chatWithAi procedure in appRouter", () => {
    // @ts-ignore
    expect(appRouter._def.procedures["semiguard.chatWithAi"] || appRouter.semiguard.chatWithAi).toBeDefined();
  });
});
