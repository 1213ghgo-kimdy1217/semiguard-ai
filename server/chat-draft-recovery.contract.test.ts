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
});
