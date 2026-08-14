import { describe, it, expect } from "vitest";
import { appRouter } from "./routers";

describe("SemiGuard AI Chatbot Procedure", () => {
  it("defines chatWithAi procedure in appRouter", () => {
    // @ts-ignore
    expect(appRouter._def.procedures["semiguard.chatWithAi"] || appRouter.semiguard.chatWithAi).toBeDefined();
  });

  it("defines durable feedback and manual RAG procedures", () => {
    // @ts-ignore
    expect(appRouter.semiguard.saveChatFeedback).toBeDefined();
    // @ts-ignore
    expect(appRouter.semiguard.getChatFeedbacks).toBeDefined();
    // @ts-ignore
    expect(appRouter.semiguard.addManualText).toBeDefined();
    // @ts-ignore
    expect(appRouter.semiguard.getManualDocuments).toBeDefined();
  });
});

  it("defines chat session procedures in appRouter", () => {
    // @ts-ignore
    expect(appRouter.semiguard.getChatSessions).toBeDefined();
    // @ts-ignore
    expect(appRouter.semiguard.createChatSession).toBeDefined();
    // @ts-ignore
    expect(appRouter.semiguard.getChatMessages).toBeDefined();
    // @ts-ignore
    expect(appRouter.semiguard.saveChatMessage).toBeDefined();
    // @ts-ignore
    expect(appRouter.semiguard.deleteChatSession).toBeDefined();
  });
