import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const appSource = readFileSync(resolve(process.cwd(), "client/src/App.tsx"), "utf8");

describe("dashboard slow-loading recovery contract", () => {
  it("reveals a recovery state after eight seconds and cleans up its timer", () => {
    expect(appSource).toContain("const [isSlowLoading, setIsSlowLoading] = useState(false);");
    expect(appSource).toContain("window.setTimeout(() => setIsSlowLoading(true), 8000)");
    expect(appSource).toContain("window.clearTimeout(timeoutId)");
  });

  it("offers localized recovery guidance and an explicit refresh action", () => {
    expect(appSource).toContain("slowDescription");
    expect(appSource).toContain("지금 새로고침");
    expect(appSource).toContain("Refresh now");
    expect(appSource).toContain("今すぐ更新");
    expect(appSource).toContain("window.location.reload()");
  });
});
