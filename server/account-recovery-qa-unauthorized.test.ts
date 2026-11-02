import { TRPCClientError } from "@trpc/client";
import { UNAUTHED_ERR_MSG } from "../shared/const";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const fixture = vi.hoisted(() => ({
  qa: false,
  queryError: undefined as undefined | ((event: any) => void),
  mutationError: undefined as undefined | ((event: any) => void),
  startManus: vi.fn(), replace: vi.fn(),
}));
vi.mock("@tanstack/react-query", () => ({
  QueryClient: class {
    getQueryCache() { return { subscribe: (callback: (event: unknown) => void) => { fixture.queryError = callback; } }; }
    getMutationCache() { return { subscribe: (callback: (event: unknown) => void) => { fixture.mutationError = callback; } }; }
  },
  QueryClientProvider: () => null,
}));
vi.mock("react-dom/client", () => ({ createRoot: () => ({ render: vi.fn() }) }));
vi.mock("../client/src/App", () => ({ default: () => null }));
vi.mock("../client/src/const", () => ({ startLogin: fixture.startManus }));
vi.mock("../client/src/lib/trpc", () => ({ trpc: { createClient: () => ({}), Provider: () => null } }));
vi.mock("../client/src/lib/recoveryQa", async original => ({
  ...await original<typeof import("../client/src/lib/recoveryQa")>(),
  get RECOVERY_QA_BUILD() { return fixture.qa; },
}));

const queryFailure = (error: unknown) => fixture.queryError!({ type: "updated", action: { type: "error" }, query: { state: { error } } });
const mutationFailure = (error: unknown) => fixture.mutationError!({ type: "updated", action: { type: "error" }, mutation: { state: { error }, options: { mutationKey: [["accountRecovery", "enroll"]] } } });

describe("recovery QA unauthorized navigation in the actual global error subscriptions", () => {
  beforeAll(async () => {
    vi.stubGlobal("React", await import("react"));
    vi.stubGlobal("document", { getElementById: () => ({}) });
    await import("../client/src/main");
    vi.unstubAllGlobals();
  });
  beforeEach(() => {
    fixture.qa = false; fixture.startManus.mockReset(); fixture.replace.mockReset();
    vi.stubGlobal("window", { location: { replace: fixture.replace } });
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
  it.each([[false, "query"], [false, "mutation"], [true, "query"], [true, "mutation"]] as const)("handles unauthorized %s / %s without mixing login routes", (qa, source) => {
    fixture.qa = qa;
    const error = new TRPCClientError(UNAUTHED_ERR_MSG);
    (source === "query" ? queryFailure : mutationFailure)(error);
    if (qa) {
      expect(fixture.replace).toHaveBeenCalledOnce(); expect(fixture.replace).toHaveBeenCalledWith("/login");
      expect(fixture.startManus).not.toHaveBeenCalled();
    } else {
      expect(fixture.startManus).toHaveBeenCalledOnce(); expect(fixture.replace).not.toHaveBeenCalled();
    }
  });
  it.each([false, true])("does not redirect unrelated errors or plain objects when QA=%s", qa => {
    fixture.qa = qa;
    for (const error of [new TRPCClientError("OTHER_ERROR"), new Error(UNAUTHED_ERR_MSG), { message: UNAUTHED_ERR_MSG }, null]) {
      queryFailure(error); mutationFailure(error);
    }
    expect(fixture.replace).not.toHaveBeenCalled(); expect(fixture.startManus).not.toHaveBeenCalled();
  });
  it("does not start a browser login when no window exists", () => {
    fixture.qa = true; vi.unstubAllGlobals();
    queryFailure(new TRPCClientError(UNAUTHED_ERR_MSG));
    mutationFailure(new TRPCClientError(UNAUTHED_ERR_MSG));
    expect(fixture.replace).not.toHaveBeenCalled(); expect(fixture.startManus).not.toHaveBeenCalled();
  });
});
