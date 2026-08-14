import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("chat message time locale contract", () => {
  it("derives the message timestamp locale from the app language", () => {
    expect(dashboardSource).toContain('const chatTimeLocale = lang === "ko" ? "ko-KR" : lang === "ja" ? "ja-JP" : "en-US";');
  });

  it("uses the selected locale for both AI and user message timestamps", () => {
    const localeUsages = dashboardSource.match(/toLocaleTimeString\(chatTimeLocale/g) ?? [];
    expect(localeUsages).toHaveLength(2);
  });
});
