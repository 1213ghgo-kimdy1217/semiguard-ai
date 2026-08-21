import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const appSource = readFileSync(resolve(process.cwd(), "client/src/App.tsx"), "utf8");

describe("dashboard and authentication loading status accessibility contract", () => {
  it("announces complete loading states inside busy containers for lazy dashboard and protected-route waits", () => {
    const matches = appSource.match(/role="status" aria-live="polite" aria-atomic="true"/g) ?? [];
    expect(matches).toHaveLength(2);
    const busyContainers = appSource.match(/text-center" aria-busy="true"/g) ?? [];
    expect(busyContainers).toHaveLength(2);
  });

  it("keeps Korean, English, and Japanese loading and recovery copy available", () => {
    expect(appSource).toContain("대시보드 데이터를 불러오는 중입니다…");
    expect(appSource).toContain("Loading dashboard data…");
    expect(appSource).toContain("ダッシュボードのデータを読み込み中です…");
  });
});
