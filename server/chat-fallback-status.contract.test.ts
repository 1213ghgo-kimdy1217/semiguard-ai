import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const routerSource = readFileSync(
  resolve(process.cwd(), "server/routers.ts"),
  "utf8"
);
const dashboardSource = readFileSync(
  resolve(process.cwd(), "client/src/pages/Dashboard.tsx"),
  "utf8"
);

describe("chat fallback status contract", () => {
  it("marks regular and safe fallback chat replies explicitly at the server boundary", () => {
    expect(routerSource).toContain("usedFallback: false,");
    expect(routerSource).toContain("usedFallback: true,");
    expect(routerSource).toContain(
      "reply: buildSafeFallbackDiagnostic(sensorContext, lang)"
    );
  });

  it("shows an accessible multilingual fallback badge and allows the same question to be retried", () => {
    expect(dashboardSource).toContain(
      "usedFallback: res.usedFallback ?? false,"
    );
    expect(dashboardSource).toContain(
      "isTemporaryServiceReply || res.usedFallback ? text.trim() : undefined"
    );
    expect(dashboardSource).toContain('role="status" aria-live="polite"');
    expect(dashboardSource).toContain("실시간 수치 기반 기본 안전 진단");
    expect(dashboardSource).toContain("リアルタイム数値に基づく基本安全診断");
    expect(dashboardSource).toContain("Live-measurement safety fallback");
  });
});
