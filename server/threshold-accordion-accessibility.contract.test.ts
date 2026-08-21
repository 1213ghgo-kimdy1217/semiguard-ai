import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(
  resolve(process.cwd(), "client/src/pages/Dashboard.tsx"),
  "utf8"
);

describe("threshold setting accordion accessibility contract", () => {
  it("connects global risk threshold toggle state to its labelled region", () => {
    expect(dashboardSource).toContain("aria-expanded={showThresholdPanel}");
    expect(dashboardSource).toContain('aria-controls="risk-threshold-panel"');
    expect(dashboardSource).toContain(
      'id="risk-threshold-panel" role="region" aria-label={lang === "ko"'
    );
    expect(dashboardSource).toContain('<span aria-hidden="true" className="text-base">⚙️</span>');
    expect(dashboardSource).toContain('<span aria-hidden="true" className="text-xs text-muted-foreground">{showThresholdPanel ? "▲" : "▼"}</span>');
  });

  it("connects sensor threshold toggle state to its labelled region", () => {
    expect(dashboardSource).toContain("aria-expanded={showSensorPanel}");
    expect(dashboardSource).toContain('aria-controls="sensor-threshold-panel"');
    expect(dashboardSource).toContain(
      'id="sensor-threshold-panel" role="region" aria-label={lang === "ko"'
    );
    expect(dashboardSource).toContain('<span aria-hidden="true" className="text-base">🔬</span>');
    expect(dashboardSource).toContain('<span aria-hidden="true" className="text-xs text-muted-foreground">{showSensorPanel ? "▲" : "▼"}</span>');
  });

  it("keeps global risk threshold sliders named and value-announced in Korean, English, and Japanese", () => {
    expect(dashboardSource).toContain(
      'aria-label={lang === "ko" ? "정상 최대 위험도 점수"'
    );
    expect(dashboardSource).toContain(
      'aria-label={lang === "ko" ? "주의 최대 위험도 점수"'
    );
    expect(dashboardSource).toContain(
      'aria-label={lang === "ko" ? "경고 최대 위험도 점수"'
    );
    expect(dashboardSource).toContain(
      'aria-valuetext={lang === "ko" ? `${thresholds.normal}점`'
    );
    expect(dashboardSource).toContain(
      'lang === "ja" ? `${thresholds.caution}点`'
    );
    expect(dashboardSource).toContain("`${thresholds.warning} points`}");
  });

  it("keeps per-sensor threshold sliders named and value-announced in Korean, English, and Japanese", () => {
    expect(dashboardSource).toContain("`${s.label} ${row.label} 임계값`");
    expect(dashboardSource).toContain("`${s.label} ${row.label}しきい値`");
    expect(dashboardSource).toContain("`${s.label} ${row.label} threshold`");
    expect(dashboardSource).toContain(
      "`현재 ${row.val.toFixed(s.step < 1 ? 2 : 0)}`"
    );
    expect(dashboardSource).toContain(
      "`現在 ${row.val.toFixed(s.step < 1 ? 2 : 0)}`"
    );
    expect(dashboardSource).toContain(
      "`Current ${row.val.toFixed(s.step < 1 ? 2 : 0)}`"
    );
  });
});
