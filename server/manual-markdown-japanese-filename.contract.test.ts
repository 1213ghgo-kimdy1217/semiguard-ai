import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("manual Markdown Japanese filename contract", () => {
  it("uses a Japanese manual filename prefix for Japanese users", () => {
    expect(dashboardSource).toContain('lang === "ja" ? "セミガード_マニュアル" : "semiguard-manual"');
    expect(dashboardSource).toContain('const safeTitle = manualPreviewQuery.data.document.title.replace');
  });

  it("preserves BOM Markdown content and date-suffixed localized downloads", () => {
    expect(dashboardSource).toContain('new Blob([`\\ufeff${markdown}`], { type: "text/markdown;charset=utf-8" })');
    expect(dashboardSource).toContain('anchor.download = `${filenamePrefix}_${safeTitle}_${new Date().toISOString().slice(0, 10)}.md`;');
  });
});
