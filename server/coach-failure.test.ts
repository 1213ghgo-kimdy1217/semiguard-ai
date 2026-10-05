import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { classifyCoachRequestError, coachFailureMessage, type CoachFailure } from "../shared/coachFailure";

describe("coach failure guidance", () => {
  it.each([
    [{ data: { code: "UNAUTHORIZED" } }, "session-expired"],
    [{ data: { code: "BAD_REQUEST" } }, "invalid-request"],
    [{ data: { code: "PARSE_ERROR" } }, "invalid-request"],
    [{ name: "ZodError" }, "invalid-request"],
    [{ data: { code: "FORBIDDEN" } }, "request-error"],
    [new Error("UNAUTHORIZED private answer"), "request-error"],
    [null, "request-error"],
  ] as const)("classifies structured errors without using their message", (error, expected) => {
    expect(classifyCoachRequestError(error)).toBe(expected);
  });
  const failures: CoachFailure[] = ["session-expired", "invalid-request", "request-error", "not-configured", "provider-error", "invalid-response", "cooldown"];
  it.each(["ko", "en", "ja"] as const)("distinguishes every failure in %s and preserves non-AI review", language => {
    const messages = failures.map(reason => coachFailureMessage(reason, language, 17));
    expect(new Set(messages).size).toBe(failures.length);
    expect(messages.every(message => message.length > 40)).toBe(true);
    expect(messages.every(message => message.includes(language === "ko" ? "타임라인" : language === "en" ? "timeline" : "タイムライン"))).toBe(true);
    expect(coachFailureMessage("cooldown", language, 17)).toContain("17");
    expect(coachFailureMessage("cooldown", language)).toContain("60");
    expect(coachFailureMessage("cooldown", language, Infinity)).toContain("60");
  });
  it("uses fixed guidance, never raw error text, automatic requests or persistent error storage", () => {
    const source = readFileSync("client/src/components/ScenarioJudgmentCoach.tsx", "utf8");
    expect(source).toContain("classifyCoachRequestError(error)");
    expect(source).toContain("coachFailureMessage(");
    expect(source).toContain('clientFailure === "session-expired"');
    expect(source).toContain("useMutation({ retry: false })");
    expect(source).not.toMatch(/error\.message|useEffect|localStorage|sessionStorage|dangerouslySetInnerHTML/);
  });
});
