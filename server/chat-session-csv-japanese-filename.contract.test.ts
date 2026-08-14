import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("chat session CSV Japanese filename contract", () => {
  it("uses a Japanese filename prefix while preserving Japanese CSV values", () => {
    expect(dashboardSource).toContain('lang === "ja" ? "セミガード_相談履歴" : "semiguard-consultations"');
    expect(dashboardSource).toContain('lang === "ja" ? "固定" : "Pinned"');
    expect(dashboardSource).toContain('lang === "ja" ? "通常" : "Normal"');
  });

  it("uses the localized prefix in the download filename and preserves a UTF-8 BOM", () => {
    expect(dashboardSource).toContain('const csv = `\\ufeff${[headers, ...rows]');
    expect(dashboardSource).toContain('anchor.download = `${filenamePrefix}_${new Date().toISOString().slice(0, 10)}.csv`;');
  });
});
