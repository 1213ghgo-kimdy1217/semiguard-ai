import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("sensor data freshness contract", () => {
  it("calculates sensor data age inside an isolated indicator that owns its refresh clock", () => {
    expect(dashboardSource).toContain("function SensorFreshnessIndicator({ timestamp, lang }");
    expect(dashboardSource).toContain("const [clock, setClock] = useState(() => Date.now());");
    expect(dashboardSource).toContain("const ageSeconds = timestamp ? Math.max(0, Math.floor((clock - timestamp) / 1000)) : null;");
    expect(dashboardSource).toContain("const updateClock = () => setClock(Date.now());");
    expect(dashboardSource).toContain("window.setInterval(updateClock, 1000)");
    expect(dashboardSource).not.toContain("sensorFreshnessClock");
  });

  it("distinguishes fresh, delayed, stale, and waiting data in all supported languages", () => {
    expect(dashboardSource).toContain('ageSeconds <= 5 ? "fresh" : ageSeconds <= 12 ? "delayed" : "stale"');
    expect(dashboardSource).toContain("갱신 지연");
    expect(dashboardSource).toContain("更新遅延");
    expect(dashboardSource).toContain("Update delayed");
    expect(dashboardSource).toContain("<SensorFreshnessIndicator timestamp={sensorData?.timestamp} lang={lang} />");
  });

  it("keeps compact header statuses readable instead of showing dot-only controls on mobile", () => {
    expect(dashboardSource).toContain('className="flex h-7 min-w-10 shrink-0 items-center justify-center gap-1 rounded-full border px-2 xl:hidden"');
    expect(dashboardSource).toContain('<span className="text-[10px] font-bold">{ageSeconds === null ? "…" : `${ageSeconds}s`}</span>');
    expect(dashboardSource).toContain('<span aria-hidden="true" className="text-sm font-bold animate-pulse">↻</span>');
    expect(dashboardSource).toContain('<span className="whitespace-nowrap text-[10px] font-semibold sm:text-xs" style={{ color: isDanger ? "#ef4444" : "#22c55e" }}>{isDanger ? t.danger : t.normal}</span>');
  });
});
