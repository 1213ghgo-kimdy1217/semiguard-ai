import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("active consultation Markdown export contract", () => {
  it("exports the visible in-memory conversation directly from the active chat header", () => {
    expect(dashboardSource).toContain("const exportActiveChatMarkdown = () =>");
    expect(dashboardSource).toContain("exportableMessages.flatMap(message");
    expect(dashboardSource).toContain("semiguard-current-");
    expect(dashboardSource).toContain("onClick={exportActiveChatMarkdown}");
  });

  it("guards unfinished, unprepared, and empty consultations with localized guidance", () => {
    expect(dashboardSource).toContain("AI 답변 생성이 끝난 뒤 현재 상담을 내보낼 수 있습니다.");
    expect(dashboardSource).toContain("상담 세션을 준비 중입니다. 잠시 후 다시 시도해 주세요.");
    expect(dashboardSource).toContain("질문을 보낸 뒤 현재 상담을 내보낼 수 있습니다.");
    expect(dashboardSource).toContain("aria-disabled={isChatLoading || activeSessionId === null");
  });
});
