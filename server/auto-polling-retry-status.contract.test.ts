import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("auto polling retry status contract", () => {
  it("tracks a pending retry after transport errors and clears it after the next successful poll", () => {
    expect(dashboardSource).toContain("const [autoPollingRetryPending, setAutoPollingRetryPending] = useState(false);");
    expect(dashboardSource).toContain("setAutoPollingRetryPending(true);");
    expect(dashboardSource).toContain("setAutoPollingRetryPending(false);");
  });

  it("surfaces a pending retry through the localized, accessible system summary", () => {
    expect(dashboardSource).toContain('safetyMonitoringInitializing || autoPollingRetryPending ? "syncing" : "healthy"');
    expect(dashboardSource).toContain('lang === "ko" ? "동기화 중" : lang === "ja" ? "同期中" : "Syncing"');
    expect(dashboardSource).toContain('role="status" aria-live="polite" aria-atomic="true" title={systemStatusDescription}');
  });
});
