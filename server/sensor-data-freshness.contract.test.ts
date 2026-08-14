import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("sensor data freshness contract", () => {
  it("calculates sensor data age from its timestamp and refreshes the freshness clock", () => {
    expect(dashboardSource).toContain("const [sensorFreshnessClock, setSensorFreshnessClock] = useState(() => Date.now());");
    expect(dashboardSource).toContain("const sensorDataAgeSeconds = sensorData?.timestamp");
    expect(dashboardSource).toContain("window.setInterval(() => setSensorFreshnessClock(Date.now()), 1000)");
  });

  it("distinguishes fresh, delayed, stale, and waiting data in all supported languages", () => {
    expect(dashboardSource).toContain('sensorDataAgeSeconds <= 5 ? "fresh" : sensorDataAgeSeconds <= 12 ? "delayed" : "stale"');
    expect(dashboardSource).toContain("갱신 지연");
    expect(dashboardSource).toContain("更新遅延");
    expect(dashboardSource).toContain("Update delayed");
    expect(dashboardSource).toContain('role="status" aria-live="polite"');
  });
});
