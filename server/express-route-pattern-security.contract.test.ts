import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

function readProductionServerSources(directory: string): string {
  return readdirSync(directory, { withFileTypes: true })
    .flatMap(entry => {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) return readProductionServerSources(path);
      if (
        !entry.isFile() ||
        !entry.name.endsWith(".ts") ||
        entry.name.endsWith(".test.ts")
      )
        return [];
      return [readFileSync(path, "utf8")];
    })
    .join("\n");
}

const serverSource = readProductionServerSources(
  resolve(process.cwd(), "server")
);
const multiParameterSegment =
  /\/:[A-Za-z_]\w*(?:-[A-Za-z0-9_]*:[A-Za-z_]\w*){2,}/;

describe("express route-pattern security contract", () => {
  it("does not add a route segment with three or more hyphen-joined parameters", () => {
    expect(serverSource).not.toMatch(multiParameterSegment);
  });
});
