import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dbSource = readFileSync(resolve(process.cwd(), "server/db.ts"), "utf8");
const routerSource = readFileSync(resolve(process.cwd(), "server/routers.ts"), "utf8");
const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");
const clearAllModalSource = dashboardSource.slice(
  dashboardSource.indexOf("{/* 전체 초기화 2단계 확인 모달 */}"),
  dashboardSource.indexOf("{historySessionLoadError"),
);

describe("consultation history clear-all contract", () => {
  it("deletes only the authenticated user's sessions", () => {
    expect(dbSource).toContain("deleteAllChatSessions(userId: number)");
    expect(dbSource).toContain("where(eq(chatSessions.userId, userId))");
    expect(routerSource).toContain("await db.deleteAllChatSessions(ctx.user.id)");
  });

  it("starts a fresh owned session without immediately saving an ownership-checked welcome message", () => {
    expect(clearAllModalSource).toContain("await deleteAllSessionsMutation.mutateAsync()");
    expect(clearAllModalSource).toContain("const res = await createSessionMutation.mutateAsync({ title: newTitle })");
    expect(clearAllModalSource).toContain("setActiveSessionId(res.sessionId)");
    expect(clearAllModalSource).not.toContain("await saveMessageMutation.mutateAsync({ sessionId: res.sessionId, role: \"assistant\", content: initialMsg })");
  });

  it("prevents duplicate bulk-clear submissions and gives a localized recovery message", () => {
    expect(dashboardSource).toContain("const isClearingAllSessions = deleteAllSessionsMutation.isPending || createSessionMutation.isPending");
    expect(dashboardSource).toContain("disabled={isClearingAllSessions}");
    expect(dashboardSource).toContain("상담 기록을 초기화하지 못했습니다. 로그인 상태를 확인한 뒤 다시 시도해 주세요.");
    expect(dashboardSource).toContain("相談履歴を初期化できませんでした。ログイン状態を確認してから再試行してください。");
  });
});
