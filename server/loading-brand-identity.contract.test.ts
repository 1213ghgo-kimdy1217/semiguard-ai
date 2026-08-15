import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const appSource = readFileSync(resolve(process.cwd(), "client/src/App.tsx"), "utf8");

describe("loading brand identity contract", () => {
  it("keeps the SemiGuard AI identity visible in both protected and dashboard loading states", () => {
    expect(appSource).toContain("function LoadingBrand");
    expect(appSource).toContain("SemiGuard AI");
    expect((appSource.match(/<LoadingBrand context=/g) ?? [])).toHaveLength(2);
  });

  it("provides Korean, English, and Japanese predictive-safety context", () => {
    expect(appSource).toContain("반도체 장비 예지안전 시스템");
    expect(appSource).toContain("Semiconductor equipment predictive safety system");
    expect(appSource).toContain("半導体装置の予知安全システム");
  });
});
