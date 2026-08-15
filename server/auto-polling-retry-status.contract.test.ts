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

  it("provides desktop and mobile retry status in Korean, English, and Japanese", () => {
    expect(dashboardSource).toContain('lang === "ko" ? "자동 재시도 대기" : lang === "ja" ? "自動再試行待機" : "Auto retry pending"');
    expect(dashboardSource).toContain('role="status" aria-live="polite"');
    expect(dashboardSource).toContain('lg:hidden');
  });
});
