import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("feedback CSV Japanese filename contract", () => {
  it("uses localized Japanese feedback filter labels and filename prefix", () => {
    expect(dashboardSource).toContain('lang === "ja" ? "すべて" : "all"');
    expect(dashboardSource).toContain('lang === "ja" ? "肯定" : "positive"');
    expect(dashboardSource).toContain('lang === "ja" ? "否定" : "negative"');
    expect(dashboardSource).toContain('lang === "ja" ? "セミガード_フィードバック" : "semiguard-feedback"');
  });

  it("keeps UTF-8 BOM content and uses the localized filename for downloads", () => {
    expect(dashboardSource).toContain('const csv = `\\ufeff${[headers, ...rows]');
    expect(dashboardSource).toContain('anchor.download = `${filenamePrefix}_${filterName}_${new Date().toISOString().slice(0, 10)}.csv`;');
  });
});
