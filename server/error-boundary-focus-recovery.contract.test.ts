import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const errorBoundarySource = readFileSync(resolve(process.cwd(), "client/src/components/ErrorBoundary.tsx"), "utf8");

describe("error boundary focus recovery contract", () => {
  it("moves keyboard focus to the retry action after the error UI is committed", () => {
    expect(errorBoundarySource).toContain("private readonly retryButtonRef = createRef<HTMLButtonElement>();");
    expect(errorBoundarySource).toContain("window.requestAnimationFrame(() => this.retryButtonRef.current?.focus());");
    expect(errorBoundarySource).toContain("<button ref={this.retryButtonRef} type=\"button\" onClick={this.retry}");
  });
});
