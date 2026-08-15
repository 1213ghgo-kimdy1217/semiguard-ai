import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(resolve(process.cwd(), "client/src/pages/Dashboard.tsx"), "utf8");

describe("chat close feedback popup reset contract", () => {
  it("clears an open feedback reason picker when the consultation closes", () => {
    expect(dashboardSource).toContain('setActiveDislikeIdx(null);\n      setIsChatOpen(false);');
    expect(dashboardSource).toContain('onClick={() => {\n                    setActiveDislikeIdx(null);\n                    setIsChatOpen(false);\n                  }}');
  });
});
