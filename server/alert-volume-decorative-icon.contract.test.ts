import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("alert volume decorative icon accessibility contract", () => {
  it("keeps the localized volume slider name while hiding its decorative speaker icon", () => {
    expect(dashboardSource).toContain('<span aria-hidden="true" style={{ fontSize: 11, color: "oklch(0.50 0.01 240)" }}>🔉</span>');
    expect(dashboardSource).toContain('aria-label={lang === "ko" ? "알림 음량" : lang === "ja" ? "通知音量" : "Alert volume"}');
    expect(dashboardSource).toContain('aria-valuetext={lang === "ko" ? `${Math.round(volume * 100)}퍼센트`');
  });

  it("keeps the localized mute action while hiding its decorative bell state icon", () => {
    expect(dashboardSource).toContain('<span aria-hidden="true">{muted ? "🔕" : "🔔"}</span>');
    expect(dashboardSource).toContain('lang === "ko" ? "음소거 해제"');
    expect(dashboardSource).toContain('lang === "ko" ? "음소거"');
  });
});
