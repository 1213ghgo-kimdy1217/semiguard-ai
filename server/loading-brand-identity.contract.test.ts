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

  it("provides Korean, English, and Japanese sensor-reasoning context", () => {
    expect(appSource).toContain("반도체 장비 센서 판단 교육·점검 보조");
    expect(appSource).toContain("Semiconductor sensor reasoning and inspection aid");
    expect(appSource).toContain("半導体装置の信号判断学習・点検支援");
    expect(appSource).not.toContain("predictive safety system");
  });
});
