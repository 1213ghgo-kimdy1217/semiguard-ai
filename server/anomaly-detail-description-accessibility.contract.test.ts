import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("anomaly detail dialog description accessibility contract", () => {
  it("connects the recorded time and risk level context to the dialog", () => {
    expect(dashboardSource).toContain('aria-labelledby="anomaly-detail-modal-title"');
    expect(dashboardSource).toContain('aria-describedby="anomaly-detail-modal-context"');
    expect(dashboardSource).toContain('id="anomaly-detail-modal-context"');
  });

  it("keeps the context localized for Korean, English, and Japanese", () => {
    expect(dashboardSource).toContain("기록 시각 ${recordedAt}, 위험 단계 ${riskLabel}");
    expect(dashboardSource).toContain("記録時刻 ${recordedAt}、危険段階 ${riskLabel}");
    expect(dashboardSource).toContain("Recorded at ${recordedAt}, risk level ${riskLabel}");
  });
});
