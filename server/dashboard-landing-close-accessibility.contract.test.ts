import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("dashboard landing close accessibility contract", () => {
  it("labels the service introduction close control in all supported languages", () => {
    expect(dashboardSource).toContain('"서비스 소개 닫기"');
    expect(dashboardSource).toContain('"サービス紹介を閉じる"');
    expect(dashboardSource).toContain('"Close service introduction"');
  });
});
