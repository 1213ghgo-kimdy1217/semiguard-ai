import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const appSource = readFileSync(resolve(process.cwd(), "client/src/App.tsx"), "utf8");

describe("unauthenticated not-found routing contract", () => {
  it("keeps explicit authentication routes while directing unknown routes to NotFound", () => {
    expect(appSource).toContain('<Route path={"/signup"} component={Signup} />');
    expect(appSource).toContain('<Route path={"/login"} component={Login} />');
    expect(appSource).toContain('<Route path={"/404"} component={NotFound} />');
    expect(appSource).toContain('<Route component={NotFound} />');
    expect(appSource).not.toContain('<Route component={Signup} />');
  });
});
