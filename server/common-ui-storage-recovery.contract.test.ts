import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const themeSource = readFileSync(resolve(process.cwd(), "client/src/contexts/ThemeContext.tsx"), "utf8");
const layoutSource = readFileSync(resolve(process.cwd(), "client/src/components/DashboardLayout.tsx"), "utf8");

describe("common UI restricted storage recovery contract", () => {
  it("keeps the active theme when theme storage cannot be read or written", () => {
    expect(themeSource).toContain('const stored = localStorage.getItem("theme");');
    expect(themeSource).toContain('return stored === "light" || stored === "dark" ? stored : defaultTheme;');
    expect(themeSource).toContain("제한된 저장소 환경에서도 현재 테마 상태는 계속 적용합니다.");
  });

  it("uses a safe, bounded sidebar width fallback", () => {
    expect(layoutSource).toContain("Number.isFinite(parsed) && parsed >= MIN_WIDTH && parsed <= MAX_WIDTH ? parsed : DEFAULT_WIDTH");
    expect(layoutSource).toContain("제한된 저장소 환경에서도 현재 세션의 레이아웃 너비는 유지합니다.");
  });
});
