import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const schemaSource = readFileSync(resolve(process.cwd(), "drizzle/schema.ts"), "utf8");
const dbSource = readFileSync(resolve(process.cwd(), "server/semiguardDb.ts"), "utf8");
const routerSource = readFileSync(resolve(process.cwd(), "server/routers.ts"), "utf8");
const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("first-use feedback privacy and metrics contract", () => {
  it("stores only one selected feedback record per user without a free-text field", () => {
    expect(schemaSource).toContain('mysqlTable("first_use_feedback"');
    expect(schemaSource).toContain('userId: int("user_id").notNull().unique()');
    expect(schemaSource).toContain('easeRating: int("ease_rating").notNull()');
    expect(schemaSource).toContain('difficultStep: mysqlEnum("difficult_step", ["none", "orientation", "risk_review", "analysis_review"])');
    expect(schemaSource).not.toMatch(/firstUseFeedback[\s\S]{0,800}(comment|message|freeText|reasonText)/i);
  });

  it("requires an authenticated, bounded selection and uses an upsert for the latest response", () => {
    expect(routerSource).toContain("getFirstUseFeedback: protectedProcedure");
    expect(routerSource).toContain("saveFirstUseFeedback: protectedProcedure");
    expect(routerSource).toContain('easeRating: z.number().int().min(1).max(5)');
    expect(routerSource).toContain('difficultStep: z.enum(["none", "orientation", "risk_review", "analysis_review"])');
    expect(dbSource).toContain("export async function saveFirstUseFeedback");
    expect(dbSource).toContain("onDuplicateKeyUpdate");
  });

  it("returns privacy-minimized period aggregates to the existing admin product metrics", () => {
    expect(dbSource).toContain("export async function getFirstUseFeedbackMetrics");
    expect(dbSource).toContain("feedbackResponseCount");
    expect(dbSource).toContain("averageEaseRating");
    expect(dbSource).toContain("difficultStepCounts");
    expect(dbSource).toContain("getFirstUseFeedbackMetrics(startAt, endAt)");
  });

  it("offers a localized selected-response dialog and exposes aggregate signals only to admins", () => {
    expect(dashboardSource).toContain("const firstUseFeedbackQuery = trpc.semiguard.getFirstUseFeedback.useQuery");
    expect(dashboardSource).toContain("const saveFirstUseFeedbackMutation = trpc.semiguard.saveFirstUseFeedback.useMutation");
    expect(dashboardSource).toContain("이름·연락처·설비 데이터·자유 입력은 수집하지 않습니다.");
    expect(dashboardSource).toContain('role="dialog" aria-modal="true" aria-labelledby="first-use-feedback-title"');
    expect(dashboardSource).toContain('role="radiogroup"');
    expect(dashboardSource).toContain("feedbackResponseCount");
    expect(dashboardSource).toContain("difficultStepCounts");
  });

  it("moves keyboard focus into the dialog and returns it safely after closing", () => {
    expect(dashboardSource).toContain("const firstUseFeedbackTriggerRef = useRef<HTMLButtonElement>(null)");
    expect(dashboardSource).toContain("const firstUseFeedbackCloseButtonRef = useRef<HTMLButtonElement>(null)");
    expect(dashboardSource).toContain("firstUseFeedbackCloseButtonRef.current?.focus()");
    expect(dashboardSource).toContain('event.key === "Escape"');
    expect(dashboardSource).toContain("firstUseFeedbackTriggerRef.current?.focus()");
  });

  it("keeps Tab navigation inside the open feedback dialog", () => {
    expect(dashboardSource).toContain("const firstUseFeedbackDialogRef = useRef<HTMLElement>(null)");
    expect(dashboardSource).toContain('event.key !== "Tab"');
    expect(dashboardSource).toContain('querySelectorAll<HTMLButtonElement>("button:not([disabled])")');
    expect(dashboardSource).toContain("event.shiftKey && document.activeElement === firstControl");
    expect(dashboardSource).toContain("document.activeElement === lastControl");
  });

  it("lets a user defer automatic feedback prompts without removing the manual editor", () => {
    expect(dashboardSource).toContain('FIRST_USE_FEEDBACK_PROMPT_DISMISSED_KEY = "semiguard_first_use_feedback_prompt_dismissed"');
    expect(dashboardSource).toContain("readDashboardPreference(FIRST_USE_FEEDBACK_PROMPT_DISMISSED_KEY) === \"true\"");
    expect(dashboardSource).toContain("isFirstUseFeedbackPromptDismissed");
    expect(dashboardSource).toContain('persistDashboardPreference(FIRST_USE_FEEDBACK_PROMPT_DISMISSED_KEY, "true")');
    expect(dashboardSource).toContain("firstUseFeedbackTriggerRef");
  });
});
