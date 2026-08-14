import { describe, expect, it } from "vitest";
import { isRetriableStatus } from "./_core/llm";

describe("LLM retry status policy", () => {
  it("retries transient timeout, rate-limit, and server errors", () => {
    expect(isRetriableStatus(408)).toBe(true);
    expect(isRetriableStatus(429)).toBe(true);
    expect(isRetriableStatus(500)).toBe(true);
    expect(isRetriableStatus(503)).toBe(true);
  });

  it("does not retry permanent client and account-state errors", () => {
    expect(isRetriableStatus(400)).toBe(false);
    expect(isRetriableStatus(401)).toBe(false);
    expect(isRetriableStatus(412)).toBe(false);
    expect(isRetriableStatus(422)).toBe(false);
  });
});
