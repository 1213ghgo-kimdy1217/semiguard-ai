import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("danger alert accessibility contract", () => {
  it("exposes the danger warning as an alert dialog with labeled warning text", () => {
    expect(dashboardSource).toContain('role="alertdialog" aria-modal="true" aria-labelledby="danger-alert-title" aria-describedby="danger-alert-description"');
    expect(dashboardSource).toContain('id="danger-alert-title"');
    expect(dashboardSource).toContain('id="danger-alert-description"');
    expect(dashboardSource).toContain('<div aria-hidden="true" className="text-6xl animate-pulse">🚨</div>');
  });

  it("moves focus to the confirmation control and supports Escape dismissal with focus restoration", () => {
    expect(dashboardSource).toContain("const dangerAlertConfirmRef = useRef<HTMLButtonElement>(null);");
    expect(dashboardSource).toContain("requestAnimationFrame(() => dangerAlertConfirmRef.current?.focus())");
    expect(dashboardSource).toContain('if (event.key === "Escape")');
    expect(dashboardSource).toContain("acknowledgeDangerAlert();");
    expect(dashboardSource).toContain("previouslyFocused?.focus();");
  });

  it("keeps Tab and Shift+Tab on the alert confirmation control", () => {
    expect(dashboardSource).toContain('if (event.key === "Tab")');
    expect(dashboardSource).toContain("dangerAlertConfirmRef.current?.focus();");
  });

  it("safely closes pending noncritical popups before showing a danger alert", () => {
    expect(dashboardSource).toContain("const [showResetConfirmModal, setShowResetConfirmModal] = useState(false);");
    expect(dashboardSource).toContain("setShowResetConfirmModal(false);");
    expect(dashboardSource).toContain("setActiveDislikeIdx(null);");
    expect(dashboardSource).toContain("setOtherReasonIdx(null);");
    expect(dashboardSource).toContain("setShowAiHistory(false);");
    expect(dashboardSource).toContain("setIsOnboardingOpen(false);");
    expect(dashboardSource).toContain("setIsFirstUseFeedbackOpen(false);");
    expect(dashboardSource).toContain("setDangerAlert(true);");
  });

  it("throttles repeated automatic danger modals after acknowledgement without delaying a manual danger injection", () => {
    expect(dashboardSource).toContain("const dangerAlertCooldownUntilRef = useRef(0);");
    expect(dashboardSource).toContain("Date.now() + 30_000");
    expect(dashboardSource).toContain("const requestDangerAlert = useCallback((force = false)");
    expect(dashboardSource).toContain("requestDangerAlert();");
    expect(dashboardSource).toContain("requestDangerAlert(true);");
    expect(dashboardSource).toContain('"확인 · 30초 숨김"');
    expect(dashboardSource).toContain('"確認・30秒非表示"');
    expect(dashboardSource).toContain('"OK · Hide 30s"');
  });

  it("announces AI analysis progress and exposes a named analysis result region", () => {
    expect(dashboardSource).toContain('role="status" aria-live="polite" aria-atomic="true"');
    expect(dashboardSource).toContain('animate-spin flex-shrink-0" aria-hidden="true"');
    expect(dashboardSource).toContain('role="region" aria-labelledby="danger-alert-ai-analysis-title"');
    expect(dashboardSource).toContain('<h3 id="danger-alert-ai-analysis-title"');
  });

  it("keeps the AI analysis title while hiding its decorative robot icon", () => {
    expect(dashboardSource).toContain('<span className="text-sm" aria-hidden="true">🤖</span>');
  });
});
