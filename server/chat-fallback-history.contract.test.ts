import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("chat fallback history contract", () => {
  it("restores saved fallback messages in every supported language", () => {
    expect(dashboardSource).toContain('const FALLBACK_DIAGNOSTIC_MARKERS = ["[기본 안전 진단]", "[基本安全診断]", "[Baseline Safety Diagnosis]"] as const;');
    expect(dashboardSource).toContain('message.role === "assistant" && FALLBACK_DIAGNOSTIC_MARKERS.some(marker => message.content.includes(marker))');
  });
});
