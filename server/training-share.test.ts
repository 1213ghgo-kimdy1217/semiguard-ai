import { describe, expect, it, vi } from "vitest";
import { decodeJwt, SignJWT } from "jose";
import { signSharedChoices, readSharedChoices, shareTrainingAttempt } from "./trainingShare";
const mock = vi.hoisted(() => ({ getTrainingAttempt: vi.fn() }));
vi.mock("./trainingRecords", () => mock);
vi.mock("./_core/env", () => ({ ENV: { cookieSecret: "test-only-signing-key-not-a-production-secret" } }));
const choices = { scenarioId: "etch-chamber-a-01", signal: "pressure", onset: 70, marker: 82, comparison: "same-phase", certainty: "uncertain" };
describe("opt-in choice-only sharing", () => {
  it("returns no identity, record ID, dates or prose and recomputes criteria", async () => {
    const result = await signSharedChoices(choices, 1000);
    const payload = decodeJwt(result.token);
    expect(payload.choices).toEqual(choices);
    expect(payload.exp! - payload.iat!).toBe(604800);
    const read = await readSharedChoices(result.token, new Date(1001 * 1000));
    expect(read.record.signalMatched).toBe(1);
    for (const name of ["userId", "id", "createdAt", "facts", "checks", "name", "email"]) expect(read.record).not.toHaveProperty(name);
  });
  it("rejects tampered, expired, future-issued and sign-in-shaped tokens", async () => {
    const result = await signSharedChoices(choices, 1000);
    await expect(readSharedChoices(result.token, new Date(999 * 1000))).rejects.toThrow();
    await expect(readSharedChoices(result.token, new Date(605800 * 1000))).rejects.toThrow();
    await expect(readSharedChoices(result.token.slice(0, -20) + "A".repeat(20), new Date(1001 * 1000))).rejects.toThrow();
    const session = await new SignJWT({ choices }).setProtectedHeader({ alg: "HS256" }).sign(new TextEncoder().encode("test-only-signing-key-not-a-production-secret"));
    await expect(readSharedChoices(session)).rejects.toThrow();
    await expect(signSharedChoices({ ...choices, facts: "do not publish" })).rejects.toThrow();
  });
  it("looks up the exact record with the current owner before generating a link", async () => {
    mock.getTrainingAttempt.mockResolvedValue({ ...choices, userId: 41, id: 7, facts: "private" });
    const result = await shareTrainingAttempt(41, 7);
    expect(mock.getTrainingAttempt).toHaveBeenCalledWith(41, 7);
    expect(decodeJwt(result.token).choices).toEqual(choices);
    mock.getTrainingAttempt.mockResolvedValue(null);
    await expect(shareTrainingAttempt(42, 7)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
