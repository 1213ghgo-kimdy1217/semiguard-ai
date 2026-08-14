import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dbSource = readFileSync(resolve(process.cwd(), "server/db.ts"), "utf8");
const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("consultation session message count contract", () => {
  it("aggregates message counts only through the current user's session list", () => {
    expect(dbSource).toContain("messageCount: count(chatMessagesTable.id)");
    expect(dbSource).toContain("leftJoin(chatMessagesTable, eq(chatMessagesTable.sessionId, chatSessions.id))");
    expect(dbSource).toContain("where(eq(chatSessions.userId, userId))");
  });

  it("displays a localized message count in consultation history cards", () => {
    expect(dashboardSource).toContain('session.messageCount}{lang === "ko" ? "개 메시지"');
    expect(dashboardSource).toContain('"件のメッセージ"');
    expect(dashboardSource).toContain('" messages"');
  });
});
