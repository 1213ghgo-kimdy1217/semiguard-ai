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

  it("exposes mobile-friendly multilingual edit controls in consultation history", () => {
    expect(dashboardSource).toContain("editingSessionId");
    expect(dashboardSource).toContain('get("history") === "open"');
    expect(dashboardSource).toContain("상담 기록 제목 수정");
    expect(dashboardSource).toContain("相談履歴のタイトルを編集");
    expect(dashboardSource).toContain("Consultation title updated.");
  });
});
