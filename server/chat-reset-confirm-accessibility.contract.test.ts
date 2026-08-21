import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("new consultation confirmation accessibility contract", () => {
  it("explains that prior messages remain in consultation history in every supported language", () => {
    expect(dashboardSource).toContain("이전 대화는 상담 기록에 보관되고, 현재 창만 새 상담으로 전환됩니다.");
    expect(dashboardSource).toContain("これまでの会話は相談履歴に保存され、現在の画面だけが新しい相談に切り替わります。");
    expect(dashboardSource).toContain("Previous messages stay in Consultation History.");
  });

  it("exposes the confirmation as an alert dialog with a focused cancel path and focus restoration", () => {
    expect(dashboardSource).toContain('role="alertdialog" aria-modal="true" aria-labelledby="chat-reset-confirm-title" aria-describedby="chat-reset-confirm-description"');
    expect(dashboardSource).toContain("const resetConfirmTriggerRef = useRef<HTMLButtonElement>(null);");
    expect(dashboardSource).toContain("const resetConfirmCancelRef = useRef<HTMLButtonElement>(null);");
    expect(dashboardSource).toContain("resetConfirmCancelRef.current?.focus();");
    expect(dashboardSource).toContain("resetConfirmTriggerRef.current?.focus();");
  });

  it("uses the nested confirmation dialog as the chat Tab focus boundary", () => {
    expect(dashboardSource).toContain("const resetConfirmDialogRef = useRef<HTMLDivElement>(null);");
    expect(dashboardSource).toContain("showResetConfirmModal");
    expect(dashboardSource).toContain("? resetConfirmDialogRef.current");
    expect(dashboardSource).toContain("ref={resetConfirmDialogRef}");
  });

  it("keeps the warning icon decorative while the localized title and description carry the alert meaning", () => {
    expect(dashboardSource).toContain('<span className="text-2xl" aria-hidden="true">⚠️</span>');
  });
});
