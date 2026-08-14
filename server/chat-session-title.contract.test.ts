import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dbSource = readFileSync(resolve(process.cwd(), "server/db.ts"), "utf8");
const routerSource = readFileSync(resolve(process.cwd(), "server/routers.ts"), "utf8");
const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("consultation session title management contract", () => {
  it("requires the current user when updating a session title", () => {
    expect(dbSource).toContain("updateSessionTitle(sessionId: number, userId: number");
    expect(dbSource).toContain("eq(chatSessions.userId, userId)");
    expect(routerSource).toContain("db.updateSessionTitle(input.sessionId, ctx.user.id, input.title)");
  });

  it("keeps message reads and writes scoped to the current user's session", () => {
    expect(dbSource).toContain("getChatMessagesForUser(sessionId: number, userId: number)");
    expect(dbSource).toContain("addChatMessage(sessionId: number, userId: number");
    expect(routerSource).toContain("db.getChatMessagesForUser(input.sessionId, ctx.user.id)");
    expect(routerSource).toContain("db.addChatMessage(input.sessionId, ctx.user.id, input.role, input.content)");
  });

  it("exposes mobile-friendly multilingual edit controls in consultation history", () => {
    expect(dashboardSource).toContain("editingSessionId");
    expect(dashboardSource).toContain('get("history") === "open"');
    expect(dashboardSource).toContain("상담 기록 제목 수정");
    expect(dashboardSource).toContain("相談履歴のタイトルを編集");
    expect(dashboardSource).toContain("Consultation title updated.");
  });

  it("exports consultation records with a multilingual Markdown heading", () => {
    expect(dashboardSource).toContain("exportChatSessionMarkdown");
    expect(dashboardSource).toContain("text/markdown;charset=utf-8");
    expect(dashboardSource).toContain("상담 기록 Markdown 내보내기");
    expect(dashboardSource).toContain("Export consultation history as Markdown");
  });
});
