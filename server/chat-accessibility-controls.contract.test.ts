import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("chat keyboard and quick-question accessibility contract", () => {
  it("closes the topmost chat layer before closing the chat on Escape", () => {
    expect(dashboardSource).toContain('const handleChatEscape = (event: KeyboardEvent) =>');
    expect(dashboardSource).toContain('if (activeManualSource) return setActiveManualSource(null);');
    expect(dashboardSource).toContain('if (showHistoryPanel) return setShowHistoryPanel(false);');
    expect(dashboardSource).toContain('setIsChatOpen(false);');
  });

  it("provides scroll and screen-reader guidance for mobile quick questions", () => {
    expect(dashboardSource).toContain('aria-describedby="chat-quick-prompt-help"');
    expect(dashboardSource).toContain('event.currentTarget.scrollBy({ left: event.key === "ArrowRight" ? 180 : -180, behavior: getKeyboardScrollBehavior() })');
    expect(dashboardSource).toContain('aria-live="polite"');
  });

  it("hides decorative feedback, manual, and new-chat icons while keeping their localized text controls", () => {
    expect(dashboardSource).toContain('<span aria-hidden="true">✨</span>');
    expect(dashboardSource).toContain('<span aria-hidden="true">📘</span>');
    expect(dashboardSource).toContain('<span aria-hidden="true">🔄</span>');
    expect(dashboardSource).toContain('lang === "ko" ? "피드백"');
    expect(dashboardSource).toContain('lang === "ko" ? "매뉴얼"');
    expect(dashboardSource).toContain('lang === "ko" ? "새 상담"');
  });
});
