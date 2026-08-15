import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("chat header layout contract", () => {
  it("keeps the title row separate from the horizontally scrollable controls", () => {
    expect(dashboardSource).toContain('flex flex-col gap-2 border-b px-3 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-5 sm:py-4');
    expect(dashboardSource).toContain('flex w-full flex-nowrap items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar');
  });

  it("keeps the close action visible in the title row", () => {
    expect(dashboardSource).toContain('className="ml-auto w-7 h-7 rounded-full');
    expect(dashboardSource).toContain('aria-label={lang === "ko" ? "상담 닫기"');
  });
});
