import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const dashboardSource = fs.readFileSync(path.resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("dashboard landing close label accessibility contract", () => {
  it("shows a localized close label on desktop while retaining the compact icon on mobile", () => {
    expect(dashboardSource).toContain('aria-label={lang === "ko" ? "서비스 소개 닫기"');
    expect(dashboardSource).toContain('className="hidden sm:inline">{lang === "ko" ? "닫기" : lang === "ja" ? "閉じる" : "Close"}</span>');
    expect(dashboardSource).toContain('<span aria-hidden="true">✕</span>');
  });
});
