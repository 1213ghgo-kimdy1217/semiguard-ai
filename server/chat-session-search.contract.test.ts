import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dbSource = readFileSync(resolve(process.cwd(), "server/db.ts"), "utf8");
const routerSource = readFileSync(resolve(process.cwd(), "server/routers.ts"), "utf8");
const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("consultation session content search contract", () => {
  it("searches session titles and messages only within the current user's sessions", () => {
    expect(dbSource).toContain("searchChatSessionsForUser(userId: number, searchText: string)");
    expect(dbSource).toContain("like(chatMessagesTable.content, term)");
    expect(dbSource).toContain("eq(chatSessions.userId, userId)");
    expect(dbSource).toContain("excerptBySessionId");
    expect(dbSource).toContain("matchedMessageExcerpt");
    expect(routerSource).toContain("searchChatSessions: protectedProcedure");
  });

  it("uses server search results in the consultation history panel", () => {
    expect(dashboardSource).toContain("searchChatSessionsQuery");
    expect(dashboardSource).toContain("visibleChatSessions");
    expect(dashboardSource).toContain("Conversation match:");
    expect(dashboardSource).toContain('placeholder={lang === "ko" ? "과거 대화 내용 검색..."');
  });
});
