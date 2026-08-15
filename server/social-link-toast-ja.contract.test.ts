import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("social account result toast Japanese locale contract", () => {
  it("localizes successful linking and unlinking outcomes when Japanese is selected", () => {
    expect(dashboardSource).toContain('lang === "ja" ? "ソーシャルアカウントの連携を解除しました。"');
    expect(dashboardSource).toContain('lang === "ja" ? `${label}アカウントを連携しました。`');
  });

  it("localizes unlinking errors when Japanese is selected", () => {
    expect(dashboardSource).toContain('lang === "ja" ? "ソーシャルアカウントの連携解除に失敗しました。"');
  });
});
