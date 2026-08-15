import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const indexHtml = readFileSync(resolve(process.cwd(), "client/index.html"), "utf8");

describe("mobile viewport safe-area contract", () => {
  it("enables viewport fitting so notch devices expose safe-area inset values", () => {
    expect(indexHtml).toContain('viewport-fit=cover');
  });
});
