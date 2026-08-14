import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(
  resolve(process.cwd(), "client/src/pages/Dashboard.tsx"),
  "utf8",
);

describe("mobile chatbot and localization contract", () => {
  it("uses a full dynamic viewport chat layout on mobile", () => {
    expect(dashboardSource).toContain("h-[100dvh]");
    expect(dashboardSource).toContain("relative min-h-0 flex-1");
    expect(dashboardSource).toContain("h-full overflow-y-auto");
    expect(dashboardSource).toContain("flex flex-col gap-2 border-t");
  });

  it("supports development-only mobile chat and language review paths", () => {
    expect(dashboardSource).toContain('get("chat") === "open"');
    expect(dashboardSource).toContain('get("lang")');
    expect(dashboardSource).toContain('requestedLang === "en" || requestedLang === "ja"');
  });

  it("persists the user's language choice while keeping the development review path deterministic", () => {
    expect(dashboardSource).toContain('localStorage.getItem("semiguard_lang")');
    expect(dashboardSource).toContain('localStorage.setItem("semiguard_lang", lang)');
    expect(dashboardSource).toContain('if (requestedLang === "en" || requestedLang === "ja" || requestedLang === "ko")');
  });

  it("keeps Japanese fallback wording for chat errors and regeneration", () => {
    expect(dashboardSource).toContain("回答の生成中にエラーが発生しました");
    expect(dashboardSource).toContain("回答を再生成できませんでした");
  });

  it("offers a safe retry action after a temporary chat service failure", () => {
    expect(dashboardSource).toContain("recoveryPrompt");
    expect(dashboardSource).toContain("같은 질문 다시 시도");
    expect(dashboardSource).toContain("Try the same question again");
  });
});
