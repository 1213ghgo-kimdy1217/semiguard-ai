import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("chat input safe-area contract", () => {
  it("keeps mobile chat input and send controls above the bottom gesture area", () => {
    expect(dashboardSource).toContain('pb-[max(0.625rem,calc(env(safe-area-inset-bottom)+0.5rem))]');
    expect(dashboardSource).toContain('sm:flex-row sm:items-end sm:p-4');
  });

  it("gives the message composer an explicit localized name and shortcut instructions", () => {
    expect(dashboardSource).toContain('aria-label={lang === "ko" ? "AI 상담 메시지" : lang === "ja" ? "AI相談メッセージ" : "AI consultation message"}');
    expect(dashboardSource).toContain('aria-describedby="chat-input-help"');
    expect(dashboardSource).toContain('id="chat-input-help"');
    expect(dashboardSource).toContain('Enter 키로 전송하고 Shift와 Enter 키를 함께 누르면 줄바꿈합니다.');
    expect(dashboardSource).toContain('Enterキーで送信し、ShiftキーとEnterキーを同時に押すと改行します。');
    expect(dashboardSource).toContain('Press Enter to send. Press Shift and Enter together to add a new line.');
  });
});
