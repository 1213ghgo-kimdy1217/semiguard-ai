import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("chat draft recovery contract", () => {
  it("uses a session-scoped sessionStorage key and restores drafts when the active session changes", () => {
    expect(dashboardSource).toContain('const chatDraftStorageKey = `semiguard_chat_draft_${activeSessionId ?? "pending"}`;');
    expect(dashboardSource).toContain("sessionStorage.getItem(chatDraftStorageKey)");
    expect(dashboardSource).toContain("activeChatDraftKeyRef.current === chatDraftStorageKey");
  });

  it("limits stored drafts and clears them after the typed message is sent", () => {
    expect(dashboardSource).toContain("sessionStorage.setItem(chatDraftStorageKey, chatInput.slice(0, 4000))");
    expect(dashboardSource).toContain("sessionStorage.removeItem(chatDraftStorageKey)");
    expect(dashboardSource).toContain("if (!textToSend) {");
  });

  it("keeps the chat input usable when the browser blocks session storage", () => {
    expect(dashboardSource).toContain("try {\n      setChatInput(sessionStorage.getItem(chatDraftStorageKey) ?? \"\");\n    } catch {\n      setChatInput(\"\");\n    }");
    expect(dashboardSource).toContain("// 저장소를 사용할 수 없는 환경에서는 입력 UX만 유지합니다.");
    expect(dashboardSource).toContain("// 저장소 정리가 실패해도 메시지 전송은 계속합니다.");
  });
});
