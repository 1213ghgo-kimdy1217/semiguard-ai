import { afterEach, describe, expect, it } from "vitest";
import { ENV } from "./_core/env";
import { canReadPracticeMetrics } from "./practiceMetricsAccess";

const previous = ENV.practiceMetricsReaderUserId;
afterEach(() => { ENV.practiceMetricsReaderUserId = previous; });
describe("single-account aggregate reader configuration", () => {
  it.each(["", "0", "-42", "042", "42 ", " 42", "42\n", "42.0", "4.2e1", "42,43", "*", "NaN", "2147483648", "99999999999"])("denies malformed or unconfigured reader %j", value => {
    ENV.practiceMetricsReaderUserId = value;
    expect(canReadPracticeMetrics({ id: 42, role: "user" })).toBe(false);
    expect(canReadPracticeMetrics(null)).toBe(false);
    expect(canReadPracticeMetrics({ id: 42, role: "admin" })).toBe(true);
  });
  it("uses only the trusted numeric account id, never an email/name/claimed role", () => {
    ENV.practiceMetricsReaderUserId = "42";
    expect(canReadPracticeMetrics({ id: 42, role: "user" })).toBe(true);
    expect(canReadPracticeMetrics({ id: 43, role: "user", name: "42", email: "42" } as any)).toBe(false);
    expect(canReadPracticeMetrics({ id: "42", role: "user" } as any)).toBe(false);
    expect(canReadPracticeMetrics(null)).toBe(false);
  });
});
