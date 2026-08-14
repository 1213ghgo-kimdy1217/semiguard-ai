import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const schemaSource = readFileSync(resolve(process.cwd(), "drizzle/schema.ts"), "utf8");
const dbSource = readFileSync(resolve(process.cwd(), "server/db.ts"), "utf8");
const routerSource = readFileSync(resolve(process.cwd(), "server/routers.ts"), "utf8");
const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("consultation session pin contract", () => {
  it("persists a pinned state and sorts pinned sessions ahead of recency", () => {
    expect(schemaSource).toContain('isPinned: int("is_pinned")');
    expect(dbSource).toContain("orderBy(desc(chatSessions.isPinned), desc(chatSessions.updatedAt))");
  });

  it("limits pin changes to the current user's session", () => {
    expect(dbSource).toContain("setChatSessionPinned");
    expect(dbSource).toContain("eq(chatSessions.userId, userId)");
    expect(routerSource).toContain("setChatSessionPinned: protectedProcedure");
  });

  it("keeps multilingual pin controls in the consultation history panel", () => {
    expect(dashboardSource).toContain("setChatSessionPinnedMutation");
    expect(dashboardSource).toContain("상담 기록을 상단에 고정했습니다.");
    expect(dashboardSource).toContain("相談履歴を上部に固定しました。");
    expect(dashboardSource).toContain("Pin consultation to top");
  });
});
