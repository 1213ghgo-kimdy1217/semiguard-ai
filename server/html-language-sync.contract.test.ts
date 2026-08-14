import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("HTML language synchronization contract", () => {
  it("updates the document language whenever the selected application language changes", () => {
    expect(dashboardSource).toContain("document.documentElement.lang = lang === \"ko\" ? \"ko-KR\" : lang === \"ja\" ? \"ja-JP\" : \"en-US\";");
    expect(dashboardSource).toContain("}, [lang]);");
  });
});
