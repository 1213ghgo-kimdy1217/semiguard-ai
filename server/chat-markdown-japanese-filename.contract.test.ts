import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("chat Markdown Japanese filename contract", () => {
  it("localizes both active and past consultation Markdown filename prefixes", () => {
    expect(dashboardSource).toContain('lang === "ja" ? "セミガード_現在の相談" : "semiguard-current"');
    expect(dashboardSource).toContain('lang === "ja" ? "セミガード_相談履歴" : "semiguard"');
  });

  it("preserves title-safe filenames, date suffixes, and UTF-8 BOM Markdown content", () => {
    expect(dashboardSource).toContain('const safeTitle = title.replace(/[\\\\/:*?"<>|]/g, "-")');
    expect(dashboardSource).toContain('new Blob([`\\ufeff${markdown}`], { type: "text/markdown;charset=utf-8" })');
    expect(dashboardSource).toContain('anchor.download = `${filenamePrefix}_${safeTitle}_${new Date().toISOString().slice(0, 10)}.md`;');
  });
});
