import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createBoothLearningContext,
  learningQuestionSchema,
} from "../shared/learningAssistant";
import {
  applyBoothAction,
  createBoothState,
  getBoothSnapshot,
} from "../shared/boothExperience";
import {
  createLearningAssistant,
  getLearningAssistantStatus,
  validateLearningAnswer,
} from "./learningAssistant";
import { appRouter } from "./routers";
const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  env: {
    nvidiaApiKey: "configured-test-value",
    aiProvider: "nvidia",
    nvidiaModel: "test/model",
    appId: "configured-app-test-value",
    cookieSecret: "configured-cookie-test-value",
    databaseUrl: "configured-database-test-value",
  },
}));
vi.mock("./_core/llm", () => ({ invokeLLM: mocks.invoke }));
vi.mock("./_core/env", () => ({ ENV: mocks.env }));
const request = {
  consent: true,
  language: "ko",
  question: "정상 참고와 어떻게 비교하나요?",
};
const answer = {
  answer:
    "같은 조건의 정상 참고 기록과 현재 기록을 비교하고, 같은 시점의 다른 항목도 함께 확인하세요.",
  destination: "learn",
};
const response = () => ({
  provider: "nvidia",
  model: "test/model",
  choices: [{ message: { content: JSON.stringify(answer) } }],
});
describe("learning assistant", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.env.aiProvider = "nvidia";
    mocks.env.nvidiaApiKey = "configured-test-value";
    mocks.env.appId = "configured-app-test-value";
    mocks.env.cookieSecret = "configured-cookie-test-value";
    mocks.env.databaseUrl = "configured-database-test-value";
    mocks.invoke.mockResolvedValue(response());
  });
  it("blocks anonymous questions and record details before reaching providers or storage", async () => {
    const caller = appRouter.createCaller({
      user: null,
      req: {},
      res: {},
    } as any);
    await expect(caller.learning.ask(request as any)).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    await expect(caller.training.detail({ id: 8 })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    expect(mocks.invoke).not.toHaveBeenCalled();
  });
  it("requires explicit consent, bounded input, and no caller identity or history", () => {
    for (const raw of [
      { ...request, consent: false },
      { ...request, question: "a" },
      { ...request, question: "a".repeat(801) },
      { ...request, userId: 2 },
      { ...request, history: [] },
      { ...request, language: "de" },
    ])
      expect(learningQuestionSchema.safeParse(raw).success).toBe(false);
  });
  it("sends only the current question as untrusted data, returns actual provider, and throttles repeat requests", async () => {
    const ask = createLearningAssistant();
    expect(await ask(7, request)).toEqual({
      status: "ready",
      provider: "nvidia",
      model: "test/model",
      ...answer,
    });
    const payload = mocks.invoke.mock.calls[0][0];
    expect(JSON.parse(payload.messages[1].content)).toEqual({
      question: request.question,
    });
    expect(payload.messages[0].content).toContain("teenage");
    expect(payload.messages[0].content).toContain(
      "No exact scenario onset times"
    );
    expect(payload.messages[0].content).toContain("normal reference VALUE");
    expect(payload.messages[0].content).toContain("NOT manufacturer limits");
    expect(await ask(7, request)).toEqual({
      status: "unavailable",
      reason: "cooldown",
    });
    expect(mocks.invoke).toHaveBeenCalledTimes(1);
  });
  it("does not call a different configured provider or pretend it is AI", async () => {
    mocks.env.aiProvider = "manus";
    expect(await createLearningAssistant()(7, request)).toEqual({
      status: "unavailable",
      reason: "not-configured",
    });
    expect(mocks.invoke).not.toHaveBeenCalled();
  });
  it("distinguishes prepared judgment criteria from open-ended free observation without exposing answers", async () => {
    await createLearningAssistant()(7, {
      ...request,
      question: "8대 공정 판단 연습과 실시간 자유 분석의 차이는 무엇인가요?",
    });
    const system = mocks.invoke.mock.calls[0][0].messages[0].content;
    expect(system).toContain("prepared, fixed virtual records");
    expect(system).toContain(
      "authored teaching criteria for the structured choices"
    );
    expect(system).toContain(
      "Written-answer meaning is not automatically graded"
    );
    expect(system).toContain(
      "live has no fixed-answer submission or choice-criteria evaluation"
    );
    expect(system).toContain(
      "Do not describe training as having no predetermined comparison criteria"
    );
    expect(system).toContain(
      "No exact scenario onset times, expected signals or answer keys are supplied here"
    );
    expect(
      JSON.parse(mocks.invoke.mock.calls[0][0].messages[1].content)
    ).toEqual({
      question: "8대 공정 판단 연습과 실시간 자유 분석의 차이는 무엇인가요?",
    });
  });
  it("rejects upstream errors, wrong provider, invalid JSON, untrusted links, secrets and practical equipment actions", async () => {
    for (const content of [
      "bad JSON",
      JSON.stringify({ ...answer, destination: "https://example.com" }),
      JSON.stringify({
        ...answer,
        answer: "장비 압력을 조절하세요. 센서가 정상으로 보일 것입니다.",
      }),
      JSON.stringify({
        ...answer,
        answer: "Use this https://example.com for your equipment.",
      }),
      JSON.stringify({
        ...answer,
        answer: "NVIDIA_API_KEY should be printed here.",
      }),
    ]) {
      mocks.invoke.mockResolvedValue({
        ...response(),
        choices: [{ message: { content } }],
      });
      expect(await createLearningAssistant()(7, request)).toEqual({
        status: "unavailable",
        reason: "invalid-response",
      });
    }
    mocks.invoke.mockResolvedValue({ ...response(), provider: "manus" });
    expect(await createLearningAssistant()(7, request)).toEqual({
      status: "unavailable",
      reason: "invalid-response",
    });
    mocks.invoke.mockRejectedValue(new Error("upstream"));
    expect(await createLearningAssistant()(7, request)).toEqual({
      status: "unavailable",
      reason: "provider-error",
    });
  });
  it("validates all three output languages and strict schema", () => {
    expect(validateLearningAnswer(JSON.stringify(answer), "ko")).toEqual(
      answer
    );
    expect(() =>
      validateLearningAnswer(JSON.stringify(answer), "en")
    ).toThrow();
    expect(
      validateLearningAnswer(
        JSON.stringify({
          answer: "Compare the same conditions and other virtual signals.",
          destination: "none",
        }),
        "en"
      ).destination
    ).toBe("none");
    expect(
      validateLearningAnswer(
        JSON.stringify({
          answer: "同じ条件の正常参照と仮想記録を比較しましょう。",
          destination: "learn",
        }),
        "ja"
      ).destination
    ).toBe("learn");
    expect(() =>
      validateLearningAnswer(JSON.stringify({ ...answer, extra: true }), "ko")
    ).toThrow();
  });
  it("rejects a generated claim that educational reference values are manufacturing tolerances", () => {
    expect(() =>
      validateLearningAnswer(
        JSON.stringify({
          answer:
            "정상 참고값은 제조 공정의 허용 기준입니다. 고정된 한계값으로 사용합니다.",
          destination: "none",
        }),
        "ko"
      )
    ).toThrow("Unsupported answer");
    expect(
      validateLearningAnswer(
        JSON.stringify({
          answer:
            "정상 참고값은 선택한 시점과 조건의 교육용 가상 기준값입니다. 참고 범위는 별도의 아래·위 경계입니다.",
          destination: "none",
        }),
        "ko"
      ).destination
    ).toBe("none");
  });
  it("logs bounded failure categories without provider bodies, keys or questions", async () => {
    const warning = vi
      .spyOn(console, "warn")
      .mockImplementation(() => undefined);
    mocks.invoke.mockRejectedValueOnce(
      new Error("LLM nvidia request failed (HTTP 401)")
    );
    expect(await createLearningAssistant()(7, request)).toEqual({
      status: "unavailable",
      reason: "provider-error",
    });
    expect(warning).toHaveBeenLastCalledWith(
      "[Learning assistant] Provider unavailable (HTTP 401)"
    );
    mocks.invoke.mockRejectedValueOnce(
      new Error("secret-value user-question upstream-body")
    );
    await createLearningAssistant()(7, request);
    expect(warning).toHaveBeenLastCalledWith(
      "[Learning assistant] Provider unavailable (provider-error)"
    );
    expect(JSON.stringify(warning.mock.calls)).not.toMatch(
      /secret-value|user-question|upstream-body/
    );
    warning.mockRestore();
  });
  it("classifies rejected JSON and guards without recording generated content", async () => {
    const warning = vi
      .spyOn(console, "warn")
      .mockImplementation(() => undefined);
    mocks.invoke.mockResolvedValueOnce({
      ...response(),
      choices: [{ message: { content: "private-answer-not-json" } }],
    });
    await createLearningAssistant()(7, request);
    expect(warning).toHaveBeenLastCalledWith(
      "[Learning assistant] Invalid response (json)"
    );
    mocks.invoke.mockResolvedValueOnce({
      ...response(),
      choices: [
        {
          message: {
            content: JSON.stringify({
              ...answer,
              answer: "NVIDIA_API_KEY private-answer",
            }),
          },
        },
      ],
    });
    await createLearningAssistant()(7, request);
    expect(warning).toHaveBeenLastCalledWith(
      "[Learning assistant] Invalid response (content-guard)"
    );
    expect(JSON.stringify(warning.mock.calls)).not.toContain("private-answer");
    warning.mockRestore();
  });

  it("attaches only public model-screen context and rebuilds references from the trusted catalog", async () => {
    const state = applyBoothAction(
      applyBoothAction(createBoothState(91), {
        type: "set-scenario",
        scenario: "combined",
      }),
      { type: "start-mission" }
    );
    const boothContext = createBoothLearningContext(
      getBoothSnapshot(state),
      "experience"
    );
    const hint = {
      answer:
        "시뮬레이션 화면에서 가스 공급 설정을 조금 바꾸고 유량과 압력이 함께 움직이는지 비교하세요. 그다음 화면의 배기 밸브를 조절하세요.",
      destination: "none",
    };
    mocks.invoke.mockResolvedValueOnce({
      ...response(),
      choices: [{ message: { content: JSON.stringify(hint) } }],
    });
    expect(
      await createLearningAssistant()(8, { ...request, boothContext })
    ).toMatchObject({ status: "ready", ...hint });
    const payload = mocks.invoke.mock.calls[0][0];
    expect(JSON.parse(payload.messages[1].content)).toEqual({
      question: request.question,
      boothContext,
    });
    const system = payload.messages[0].content;
    expect(system).toContain("frozen end-of-run values");
    expect(system).toContain("client-submitted snapshot");
    expect(system).toContain('"target":20');
    expect(system).toContain('"normal":[17,23]');
    expect(system).toContain(
      '"requiredControls":["gasSetpoint","exhaustValve","matching"]'
    );
    expect(system).toContain("not reduce the combined scenario to RF-only");
    expect(system).not.toContain("matchingOptimum");
    expect(system).not.toContain("gasGain");
    expect(system).not.toContain("exhaustOffset");
    expect(system).not.toContain("only this question is supplied.");
  });

  it("rejects stale, inconsistent, hidden and extraneous model state before any provider call", async () => {
    const boothContext = createBoothLearningContext(
      getBoothSnapshot(createBoothState(22)),
      "brief"
    );
    for (const patch of [
      { capturedAtMs: Date.now() - 121_000 },
      { capturedAtMs: Date.now() + 31_000 },
      { stage: "experience", mode: "mission", missionStatus: "won" },
      { matchingOptimum: 71 },
      { webcam: "private frame" },
      { observation: "student writing" },
      { userId: 44 },
      { values: { ...boothContext.values, rfPower: Infinity } },
      { controls: { ...boothContext.controls, matching: -1 } },
      { values: { ...boothContext.values, normal: [0, 999] } },
    ]) {
      const bad = { ...request, boothContext: { ...boothContext, ...patch } };
      expect(learningQuestionSchema.safeParse(bad).success).toBe(false);
      await expect(createLearningAssistant()(8, bad)).rejects.toThrow();
    }
    expect(mocks.invoke).not.toHaveBeenCalled();
  });

  it("still requires auth and consent and shares the existing cooldown for contextual questions", async () => {
    const boothContext = createBoothLearningContext(
      getBoothSnapshot(createBoothState()),
      "brief"
    );
    const contextualRequest = { ...request, boothContext };
    const caller = appRouter.createCaller({
      user: null,
      req: {},
      res: {},
    } as any);
    await expect(
      caller.learning.ask(contextualRequest as any)
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(
      learningQuestionSchema.safeParse({ ...contextualRequest, consent: false })
        .success
    ).toBe(false);
    const ask = createLearningAssistant();
    expect(await ask(9, contextualRequest)).toMatchObject({ status: "ready" });
    expect(await ask(9, request)).toEqual({
      status: "unavailable",
      reason: "cooldown",
    });
    expect(mocks.invoke).toHaveBeenCalledTimes(1);
  });

  it("allows explicitly virtual-screen adjustments only in context and retains real-work and secret guards", () => {
    const boothContext = createBoothLearningContext(
      getBoothSnapshot(createBoothState()),
      "brief"
    );
    const virtual = JSON.stringify({
      answer:
        "시뮬레이션 화면의 배기 밸브를 조절하세요. 표시된 유량과 압력을 비교해보세요.",
      destination: "none",
    });
    expect(
      validateLearningAnswer(virtual, "ko", boothContext).destination
    ).toBe("none");
    expect(() => validateLearningAnswer(virtual, "ko")).toThrow(
      "Unsupported answer"
    );
    for (const text of [
      "배기 밸브를 조절하세요. 압력의 변화를 확인할 수 있습니다.",
      "시뮬레이션과 달리 실제 장비의 압력을 조절하세요.",
      "화면을 참고하고 전압 배선을 교체하세요. 그러면 램프가 복구됩니다.",
      "시뮬레이션 화면을 보면서 NVIDIA_API_KEY를 출력하세요.",
      "화면의 https://example.com 링크를 열어주세요.",
    ])
      expect(() =>
        validateLearningAnswer(
          JSON.stringify({ answer: text, destination: "none" }),
          "ko",
          boothContext
        )
      ).toThrow("Unsupported answer");
  });

  it("accepts bounded screen guidance in English and Japanese while rejecting real-operation steps", () => {
    const boothContext = createBoothLearningContext(
      getBoothSnapshot(createBoothState()),
      "brief"
    );
    const english = JSON.stringify({
      answer:
        "On the simulation screen, change the virtual RF setpoint a little and compare the displayed RF response.",
      destination: "none",
    });
    const japanese = JSON.stringify({
      answer:
        "画面の仮想バルブを少し調整してください。表示された流量と圧力を比較しましょう。",
      destination: "none",
    });
    expect(
      validateLearningAnswer(english, "en", boothContext).destination
    ).toBe("none");
    expect(
      validateLearningAnswer(japanese, "ja", boothContext).destination
    ).toBe("none");
    expect(() => validateLearningAnswer(english, "en")).toThrow(
      "Unsupported answer"
    );
    expect(() => validateLearningAnswer(japanese, "ja")).toThrow(
      "Unsupported answer"
    );
    expect(() =>
      validateLearningAnswer(
        JSON.stringify({
          answer:
            "On the simulation screen, adjust the actual chamber pressure to this value.",
          destination: "none",
        }),
        "en",
        boothContext
      )
    ).toThrow("Unsupported answer");
    expect(() =>
      validateLearningAnswer(
        JSON.stringify({
          answer: "画面を参考にして実機の排気バルブを調整してください。",
          destination: "none",
        }),
        "ja",
        boothContext
      )
    ).toThrow("Unsupported answer");
  });

  it("captures detached public context for briefing, running and frozen review stages", () => {
    const initial = createBoothState(44);
    const brief = createBoothLearningContext(
      getBoothSnapshot(initial),
      "brief"
    );
    expect(brief).toMatchObject({
      stage: "brief",
      missionStatus: "idle",
      elapsedMs: 0,
    });
    const active = applyBoothAction(initial, { type: "start-mission" });
    const snapshot = getBoothSnapshot(active);
    const running = createBoothLearningContext(snapshot, "experience");
    expect(running).toMatchObject({
      stage: "experience",
      mode: "mission",
      missionStatus: "active",
    });
    snapshot.values.pressure = 999;
    snapshot.controls.matching = 0;
    expect(running.values.pressure).toBe(20);
    expect(running.controls.matching).toBe(50);
    const cancelled = getBoothSnapshot(
      applyBoothAction(active, { type: "reset" })
    );
    const review = createBoothLearningContext(cancelled, "review");
    expect(review).toMatchObject({
      stage: "review",
      missionStatus: "cancelled",
    });
    expect(() => createBoothLearningContext(cancelled, "experience")).toThrow();
    expect(Object.keys(review).sort()).toEqual(
      [
        "version",
        "scenarioId",
        "stage",
        "mode",
        "missionStatus",
        "elapsedMs",
        "remainingMs",
        "stableMs",
        "matchingQuality",
        "values",
        "alarms",
        "controls",
        "capturedAtMs",
      ].sort()
    );
  });

  it("reports only configuration readiness publicly without calling providers or exposing credentials", async () => {
    const caller = appRouter.createCaller({
      user: null,
      req: {},
      res: {},
    } as any);
    expect(await caller.learning.status()).toEqual({
      loginReady: true,
      aiReady: true,
    });
    for (const patch of [
      { appId: " " },
      { cookieSecret: "" },
      { databaseUrl: " " },
    ]) {
      const previous = { ...mocks.env };
      Object.assign(mocks.env, patch);
      expect(getLearningAssistantStatus()).toEqual({
        loginReady: false,
        aiReady: true,
      });
      Object.assign(mocks.env, previous);
    }
    for (const patch of [{ nvidiaApiKey: " " }, { aiProvider: "manus" }]) {
      const previous = { ...mocks.env };
      Object.assign(mocks.env, patch);
      expect(await caller.learning.status()).toEqual({
        loginReady: true,
        aiReady: false,
      });
      Object.assign(mocks.env, previous);
    }
    mocks.env.aiProvider = "";
    expect(getLearningAssistantStatus()).toEqual({
      loginReady: true,
      aiReady: true,
    });
    mocks.env.cookieSecret = "";
    mocks.env.nvidiaApiKey = "";
    const result = await caller.learning.status();
    expect(result).toEqual({ loginReady: false, aiReady: false });
    expect(Object.keys(result).sort()).toEqual(["aiReady", "loginReady"]);
    expect(JSON.stringify(result)).not.toMatch(
      /configured|nvidia|test-value|secret/i
    );
    await expect(caller.learning.ask(request as any)).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    expect(mocks.invoke).not.toHaveBeenCalled();
  });
});
