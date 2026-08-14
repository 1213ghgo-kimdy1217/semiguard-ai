import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dbSource = readFileSync(resolve(process.cwd(), "server/db.ts"), "utf8");
const routerSource = readFileSync(resolve(process.cwd(), "server/routers.ts"), "utf8");
const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("feedback conversation context contract", () => {
  it("uses the existing user-scoped message reader for feedback context", () => {
    expect(dbSource).toContain("getChatMessagesForUser(sessionId: number, userId: number)");
    expect(dbSource).toContain("eq(chatSessions.userId, userId)");
    expect(routerSource).toContain("db.getChatMessagesForUser(input.sessionId, ctx.user.id)");
    expect(dashboardSource).toContain("trpc.semiguard.getChatMessages.useQuery");
  });

  it("opens a localized detail panel and highlights the feedback-rated answer", () => {
    expect(dashboardSource).toContain("setFeedbackContextItem({ id: item.id, sessionId: item.sessionId");
    expect(dashboardSource).toContain("피드백 상담 맥락");
    expect(dashboardSource).toContain("フィードバックの会話文脈");
    expect(dashboardSource).toContain("const isRatedAnswer");
    expect(dashboardSource).toContain("평가한 답변");
    expect(dashboardSource).toContain('get("feedback") === "open"');
  });
});
