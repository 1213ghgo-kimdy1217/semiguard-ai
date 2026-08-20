import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("dashboard header status summary contract", () => {
  it("summarizes healthy, syncing, and attention states instead of repeating normal indicators", () => {
    expect(dashboardSource).toContain('const systemStatusKind = safetyMonitoringHasError || !heartbeatAlive ? "attention"');
    expect(dashboardSource).toContain('lang === "ko" ? "정상 운영"');
    expect(dashboardSource).toContain('lang === "ko" ? "동기화 중"');
    expect(dashboardSource).toContain('lang === "ko" ? "점검 필요"');
    expect(dashboardSource).toContain('if (!hasAttention) return null;');
  });

  it("keeps data freshness and read-only scope accessible while reducing mobile header density", () => {
    expect(dashboardSource).toContain('<SensorFreshnessIndicator timestamp={sensorData?.timestamp} lang={lang} />');
    expect(dashboardSource).toContain('className="hidden md:inline-flex items-center rounded-full border px-2 py-1 text-[10px] font-bold"');
    expect(dashboardSource).toContain('aria-label={systemStatusDescription}');
  });

  it("announces complete operating and read-only scope states after status changes", () => {
    expect(dashboardSource).toContain('role="status" aria-live="polite" aria-atomic="true" title={systemStatusDescription}');
    expect(dashboardSource).toContain('role="status" aria-live="polite" aria-atomic="true" title={virtualFabDemoActive');
  });
});
