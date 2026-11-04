/**
 * One shared educational scenario drives the value cards, camera overlay and
 * purple model light. These example ranges are NOT Kiyo specifications or
 * measurements. There is no real RF generator in this model.
 */
export type SignalKey =
  | "pressure"
  | "gasFlow"
  | "rfPower"
  | "chamberAmbientTemp";
export type BoothMode = "free" | "mission";
export type BoothPhase =
  | "normal"
  | "fault"
  | "stabilizing"
  | "success"
  | "failed"
  | "cancelled";
export type MissionStatus = "idle" | "active" | "won" | "failed" | "cancelled";
export type BoothControls = {
  rfSetpoint: number;
  gasSetpoint: number;
  exhaustValve: number;
  matching: number;
};
export type BoothControlKey = keyof BoothControls;
export type BoothScenarioId =
  | "rf-matching"
  | "gas-delivery"
  | "exhaust-restriction"
  | "combined";
export type BoothScenario = {
  id: BoothScenarioId;
  title: string;
  summary: string;
  brief: string;
  objective: string;
  hints: readonly string[];
  focusSignals: readonly SignalKey[];
  requiredControls: readonly BoothControlKey[];
  durationMs: number;
};
export type BoothRecovery = {
  gasDelivery: boolean;
  exhaust: boolean;
  matching: boolean;
  values: boolean;
  ready: boolean;
};
export type BoothValues = Record<SignalKey, number>;
export type BoothAlarms = Record<SignalKey, boolean>;
export type BoothEvent = {
  id: number;
  atMs: number;
  type:
    | "control"
    | "fault"
    | "clear"
    | "mission"
    | "success"
    | "timeout"
    | "reset"
    | "mode";
  message: string;
  control?: BoothControlKey;
  value?: number;
};
export type BoothMission = {
  scenarioId: BoothScenarioId;
  durationMs: number;
  status: MissionStatus;
  remainingMs: number;
  elapsedMs: number;
  stableMs: number;
  goalMs: number;
  score: number | null;
  controlActions: number;
};
export type BoothState = {
  selectedScenario: BoothScenarioId;
  elapsedMs: number;
  mode: BoothMode;
  controls: BoothControls;
  values: BoothValues;
  alarms: BoothAlarms;
  lampBrightness: number;
  mission: BoothMission;
  events: BoothEvent[];
  /** Engine internals, retained for deterministic stepping, never a measured value. */
  rngState: number;
  noise: number;
  matchingOptimum: number;
  gasGain: number;
  exhaustOffset: number;
  faultActive: boolean;
  faultRecoveryMs: number;
  alarmRecoveryMs: Record<SignalKey, number>;
  eventSequence: number;
};
export type BoothSnapshot = {
  selectedScenario: BoothScenarioId;
  scenario: BoothScenario;
  recovery: BoothRecovery;
  values: BoothValues;
  alarms: BoothAlarms;
  lampBrightness: number;
  phase: BoothPhase;
  mode: BoothMode;
  controls: BoothControls;
  mission: BoothMission;
  events: BoothEvent[];
  matchingQuality: number;
  faultActive: boolean;
  elapsedMs: number;
};
export type BoothAction =
  | { type: "set-control"; control: BoothControlKey; value: number }
  | { type: "inject-fault" }
  | { type: "clear-fault" }
  | { type: "start-mission" }
  | { type: "set-mode"; mode: BoothMode }
  | { type: "set-scenario"; scenario: BoothScenarioId }
  | { type: "reset" };

export const BOOTH_CONTROL_LIMITS: Record<
  BoothControlKey,
  {
    min: number;
    max: number;
    step: number;
    initial: number;
    label: string;
    unit: string;
  }
> = {
  rfSetpoint: {
    min: 300,
    max: 700,
    step: 5,
    initial: 500,
    label: "RF 설정",
    unit: "W",
  },
  gasSetpoint: {
    min: 70,
    max: 130,
    step: 1,
    initial: 100,
    label: "가스 유량 설정",
    unit: "sccm",
  },
  exhaustValve: {
    min: 20,
    max: 80,
    step: 1,
    initial: 50,
    label: "배기 밸브",
    unit: "%",
  },
  matching: {
    min: 0,
    max: 100,
    step: 1,
    initial: 50,
    label: "RF 매칭 조절",
    unit: "%",
  },
};
export const BOOTH_SIGNALS: ReadonlyArray<{
  key: SignalKey;
  number: 1 | 2 | 3 | 4;
  label: string;
  unit: string;
  normal: readonly [number, number];
  target: number;
}> = [
  {
    key: "pressure",
    number: 1,
    label: "챔버 압력",
    unit: "mTorr",
    normal: [17, 23],
    target: 20,
  },
  {
    key: "gasFlow",
    number: 2,
    label: "가스 유량",
    unit: "sccm",
    normal: [90, 110],
    target: 100,
  },
  {
    key: "rfPower",
    number: 3,
    label: "RF 전력",
    unit: "W",
    normal: [440, 560],
    target: 500,
  },
  {
    key: "chamberAmbientTemp",
    number: 4,
    label: "챔버 주변 온도",
    unit: "°C",
    normal: [31, 39],
    target: 35,
  },
];
export const BOOTH_MISSION_DURATION_MS = 90_000;
export const BOOTH_SCENARIOS: readonly BoothScenario[] = [
  {
    id: "rf-matching",
    title: "RF 출력 불안정",
    summary: "유량·압력은 유지되는데 빛과 RF가 흔들려요.",
    brief:
      "정상 운전 중 RF 출력과 보라색 빛이 반복적으로 약해집니다. 다른 값이 함께 변했는지 비교한 뒤 조절하세요.",
    objective: "RF 출력과 다른 세 값을 정상으로 유지하고 매칭을 안정화하세요.",
    hints: [
      "가스 유량과 압력이 정상인지 먼저 비교해보세요.",
      "RF 설정을 높여 숫자만 맞추기보다, 매칭을 조금씩 조절하며 흔들림이 줄어드는 쪽을 찾아보세요.",
    ],
    focusSignals: ["rfPower", "gasFlow", "pressure"],
    requiredControls: ["matching"],
    durationMs: 90_000,
  },
  {
    id: "gas-delivery",
    title: "가스·압력 불균형",
    summary: "공급 명령에 비해 유량이 작고 압력도 낮아요.",
    brief:
      "같은 가스 설정에서도 실제 유량이 줄고 배기와의 균형이 달라졌습니다. 유량만 회복했을 때 압력도 회복되는지 확인하세요.",
    objective:
      "가스 공급과 배기를 함께 조절해 유량과 챔버 압력의 운전상태를 안정화하세요.",
    hints: [
      "가스 설정을 바꾼 뒤 유량이 어느 방향으로 움직이는지 관찰하세요.",
      "유량이 목표에 도달해도 압력이 낮다면 배기가 과한지 비교하세요. 배기를 줄이면 압력이 올라갑니다.",
    ],
    focusSignals: ["gasFlow", "pressure", "rfPower"],
    requiredControls: ["gasSetpoint", "exhaustValve"],
    durationMs: 90_000,
  },
  {
    id: "exhaust-restriction",
    title: "압력 상승",
    summary: "가스 유량은 정상인데 압력이 올라가요.",
    brief:
      "가스 유량은 유지되지만 챔버에서 빠져나가는 양이 줄어 압력이 상승합니다. 공급량과 배기 조절의 영향을 구분하세요.",
    objective: "가스 유량을 유지하면서 배기를 조절해 챔버 압력을 안정화하세요.",
    hints: [
      "유량이 정상인데 압력만 상승하면 두 항목을 따로 비교하세요.",
      "배기 밸브를 더 열었을 때 압력이 내려가는지 확인하세요. 유량을 무작정 줄이면 다른 항목도 벗어날 수 있어요.",
    ],
    focusSignals: ["pressure", "gasFlow", "rfPower"],
    requiredControls: ["exhaustValve"],
    durationMs: 90_000,
  },
  {
    id: "combined",
    title: "복합 공정 이상",
    summary: "유량·압력과 RF를 함께 살펴야 해결돼요.",
    brief:
      "공급 유량이 줄고 배기 균형과 RF 매칭도 함께 달라졌습니다. 하나를 바꾸면 다른 값에도 영향이 생깁니다. 변화의 순서를 보며 복구하세요.",
    objective:
      "유량·배기·RF 매칭을 조절해 네 항목을 정상으로 되돌리고 5초 유지하세요.",
    hints: [
      "먼저 유량과 압력의 방향을 비교하고 한 번에 한 설정씩 바꿔보세요.",
      "가스 공급을 회복하면 압력이 더 올라갈 수 있어요. 이어 배기를 조절하고 RF 매칭과 빛의 흔들림을 확인하세요.",
      "온도는 RF 변화에 천천히 따라옵니다. 직접 조절하는 값이 아니라 다른 값과 비교하는 관찰 항목이에요.",
    ],
    focusSignals: ["gasFlow", "pressure", "rfPower", "chamberAmbientTemp"],
    requiredControls: ["gasSetpoint", "exhaustValve", "matching"],
    durationMs: 120_000,
  },
];
export function getBoothScenario(id: BoothScenarioId): BoothScenario {
  return (
    BOOTH_SCENARIOS.find(scenario => scenario.id === id) ?? BOOTH_SCENARIOS[0]
  );
}
export const BOOTH_STABLE_GOAL_MS = 5_000;
export const BOOTH_MAX_TICK_MS = 1_000;
export const BOOTH_ALARM_CLEAR_MS = 600;
export const BOOTH_MATCHING_TOLERANCE = 6;
export const BOOTH_MIN_STABLE_MATCH_QUALITY =
  1 - (0.65 * BOOTH_MATCHING_TOLERANCE) / 30;
const SIGNAL_KEYS: SignalKey[] = [
  "pressure",
  "gasFlow",
  "rfPower",
  "chamberAmbientTemp",
];
export const BOOTH_RECOVERY_RANGES: Readonly<
  Record<SignalKey, readonly [number, number]>
> = {
  pressure: [18, 22],
  gasFlow: [92, 108],
  rfPower: [460, 540],
  chamberAmbientTemp: [32, 38],
};
const clamp = (value: number, low: number, high: number) =>
  Math.min(high, Math.max(low, value));
const initialValues = (): BoothValues => ({
  pressure: 20,
  gasFlow: 100,
  rfPower: 500,
  chamberAmbientTemp: 35,
});
const initialAlarms = (): BoothAlarms => ({
  pressure: false,
  gasFlow: false,
  rfPower: false,
  chamberAmbientTemp: false,
});
const initialControls = (): BoothControls => ({
  rfSetpoint: 500,
  gasSetpoint: 100,
  exhaustValve: 50,
  matching: 50,
});
const initialMission = (
  scenarioId: BoothScenarioId = "rf-matching"
): BoothMission => ({
  scenarioId,
  durationMs: getBoothScenario(scenarioId).durationMs,
  status: "idle",
  remainingMs: getBoothScenario(scenarioId).durationMs,
  elapsedMs: 0,
  stableMs: 0,
  goalMs: BOOTH_STABLE_GOAL_MS,
  score: null,
  controlActions: 0,
});

export function createBoothState(seed = 0x53474d31): BoothState {
  const normalizedSeed = Number.isFinite(seed)
    ? Math.trunc(seed) >>> 0
    : 0x53474d31;
  return {
    selectedScenario: "rf-matching",
    elapsedMs: 0,
    mode: "free",
    controls: initialControls(),
    values: initialValues(),
    alarms: initialAlarms(),
    lampBrightness: 230,
    mission: initialMission(),
    events: [],
    rngState: normalizedSeed || 0x6d2b79f5,
    noise: 0,
    matchingOptimum: 50,
    gasGain: 1,
    exhaustOffset: 0,
    faultActive: false,
    faultRecoveryMs: 0,
    alarmRecoveryMs: {
      pressure: 0,
      gasFlow: 0,
      rfPower: 0,
      chamberAmbientTemp: 0,
    },
    eventSequence: 0,
  };
}

function random(state: BoothState): number {
  let x = state.rngState;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  state.rngState = x >>> 0;
  return state.rngState / 0x1_0000_0000;
}
function clone(state: BoothState): BoothState {
  return {
    ...state,
    controls: { ...state.controls },
    values: { ...state.values },
    alarms: { ...state.alarms },
    mission: { ...state.mission },
    alarmRecoveryMs: { ...state.alarmRecoveryMs },
    events: [...state.events],
  };
}
function log(
  state: BoothState,
  type: BoothEvent["type"],
  message: string,
  extra: Pick<BoothEvent, "control" | "value"> = {}
) {
  const last = state.events[state.events.length - 1];
  // A dragged slider is one continuous adjustment, not dozens of replay rows.
  if (
    type === "control" &&
    last?.type === "control" &&
    last.control === extra.control &&
    state.elapsedMs - last.atMs < 300
  ) {
    state.events[state.events.length - 1] = {
      ...last,
      atMs: state.elapsedMs,
      message,
      ...extra,
    };
  } else {
    state.events.push({
      id: ++state.eventSequence,
      atMs: state.elapsedMs,
      type,
      message,
      ...extra,
    });
    if (state.events.length > 50) state.events.shift();
  }
}
function plantFault(state: BoothState) {
  state.gasGain = 1;
  state.exhaustOffset = 0;
  state.matchingOptimum = state.controls.matching;
  if (
    state.selectedScenario === "gas-delivery" ||
    state.selectedScenario === "combined"
  ) {
    state.gasGain = 0.79 + random(state) * 0.04;
    state.alarms.gasFlow = true;
    state.alarms.pressure = true;
    state.alarmRecoveryMs.gasFlow = 0;
    state.alarmRecoveryMs.pressure = 0;
  }
  if (state.selectedScenario === "gas-delivery") {
    // This case combines reduced delivery with excessive extraction. Restoring
    // flow alone cannot restore pressure; the two observed quantities differ.
    state.exhaustOffset = -(10 + random(state) * 4);
  } else if (
    state.selectedScenario === "exhaust-restriction" ||
    state.selectedScenario === "combined"
  ) {
    state.exhaustOffset =
      (state.selectedScenario === "combined" ? 15 : 12) + random(state) * 6;
    state.alarms.pressure = true;
    state.alarmRecoveryMs.pressure = 0;
  }
  if (
    state.selectedScenario === "rf-matching" ||
    state.selectedScenario === "combined"
  ) {
    // The best match is hidden from the public snapshot: observe and tune.
    const high =
      state.controls.matching < 50 ||
      (state.controls.matching === 50 && random(state) >= 0.5);
    state.matchingOptimum = (high ? 68 : 20) + random(state) * 12;
    state.alarms.rfPower = true;
    state.alarmRecoveryMs.rfPower = 0;
  }
  state.faultActive = true;
  state.faultRecoveryMs = 0;
}

export function applyBoothAction(
  previous: BoothState,
  action: BoothAction
): BoothState {
  if (action.type === "set-control") {
    if (
      !(action.control in BOOTH_CONTROL_LIMITS) ||
      !Number.isFinite(action.value)
    )
      return previous;
    const rule = BOOTH_CONTROL_LIMITS[action.control];
    const value = clamp(action.value, rule.min, rule.max);
    if (value === previous.controls[action.control]) return previous;
    const state = clone(previous);
    state.controls[action.control] = value;
    if (state.mission.status === "active") state.mission.controlActions += 1;
    log(
      state,
      "control",
      `${rule.label} ${Math.round(value * 10) / 10}${rule.unit}`,
      { control: action.control, value }
    );
    return state;
  }
  if (action.type === "reset") {
    const state = createBoothState(previous.rngState);
    state.selectedScenario = previous.selectedScenario;
    state.mission = initialMission(previous.selectedScenario);
    state.elapsedMs = previous.elapsedMs;
    state.mode = previous.mode;
    state.events = [...previous.events];
    state.eventSequence = previous.eventSequence;
    if (previous.mission.status === "active")
      state.mission.status = "cancelled";
    log(
      state,
      "reset",
      previous.mission.status === "active"
        ? "초기화로 미션 중단"
        : "조절값 초기화"
    );
    return state;
  }
  if (action.type === "set-scenario") {
    if (
      !BOOTH_SCENARIOS.some(scenario => scenario.id === action.scenario) ||
      action.scenario === previous.selectedScenario
    )
      return previous;
    const state = createBoothState(previous.rngState);
    state.selectedScenario = action.scenario;
    state.mode = previous.mode;
    state.elapsedMs = previous.elapsedMs;
    state.events = [...previous.events];
    state.eventSequence = previous.eventSequence;
    state.mission = initialMission(action.scenario);
    if (previous.mission.status === "active")
      state.mission.status = "cancelled";
    log(
      state,
      "mode",
      `시나리오 선택 · ${getBoothScenario(action.scenario).title}${previous.mission.status === "active" ? " · 진행 미션 중단" : ""}`
    );
    return state;
  }
  const state = clone(previous);
  if (action.type === "set-mode") {
    if (action.mode !== "free" && action.mode !== "mission") return previous;
    if (state.mode === action.mode) return previous;
    if (state.mission.status === "active") {
      state.mission.status = "cancelled";
      state.mission.stableMs = 0;
    }
    state.mode = action.mode;
    // Returning from free play starts a fresh mission selection. A historical
    // win must not label newly disturbed values as recovered or lock controls.
    if (action.mode === "mission")
      state.mission = initialMission(state.selectedScenario);
    log(
      state,
      "mode",
      action.mode === "free" ? "자유 체험으로 전환" : "복구 미션 선택"
    );
  } else if (action.type === "start-mission") {
    state.mode = "mission";
    state.controls = initialControls();
    state.values = initialValues();
    state.noise = 0;
    state.alarms = initialAlarms();
    state.alarmRecoveryMs = {
      pressure: 0,
      gasFlow: 0,
      rfPower: 0,
      chamberAmbientTemp: 0,
    };
    state.mission = {
      ...initialMission(state.selectedScenario),
      status: "active",
    };
    plantFault(state);
    log(
      state,
      "mission",
      `${getBoothScenario(state.selectedScenario).title} 미션 시작 · 정상 운전 5초 유지`
    );
  } else if (action.type === "inject-fault") {
    if (state.mission.status === "active") return previous;
    plantFault(state);
    log(
      state,
      "fault",
      `${getBoothScenario(state.selectedScenario).title} 주입`
    );
  } else if (action.type === "clear-fault") {
    if (state.mission.status === "active") {
      state.mission.status = "cancelled";
      state.mission.stableMs = 0;
      log(state, "mission", "직접 이상 해제로 미션 중단 · 성공 점수 없음");
    }
    state.faultActive = false;
    state.matchingOptimum = state.controls.matching;
    state.gasGain = 1;
    state.exhaustOffset = 0;
    state.faultRecoveryMs = 0;
    log(state, "clear", "주입한 이상 해제 · 현재 조절값은 유지");
  }
  return state;
}

function quality(state: BoothState): number {
  return clamp(
    1 - (0.65 * Math.abs(state.controls.matching - state.matchingOptimum)) / 30,
    0.12,
    1
  );
}
function effectiveExhaust(state: BoothState): number {
  return clamp(state.controls.exhaustValve - state.exhaustOffset, 5, 100);
}
function recoveryStatus(state: BoothState): BoothRecovery {
  const deliveredGas = state.controls.gasSetpoint * state.gasGain;
  const steadyPressure =
    (((20 * deliveredGas) / 100) * 50) / effectiveExhaust(state);
  const [gasLow, gasHigh] = BOOTH_RECOVERY_RANGES.gasFlow;
  const [pressureLow, pressureHigh] = BOOTH_RECOVERY_RANGES.pressure;
  const gasDelivery = deliveredGas >= gasLow && deliveredGas <= gasHigh;
  const exhaust =
    steadyPressure >= pressureLow && steadyPressure <= pressureHigh;
  const matching =
    Math.abs(state.controls.matching - state.matchingOptimum) <=
    BOOTH_MATCHING_TOLERANCE;
  const values = !SIGNAL_KEYS.some(key => state.alarms[key]);
  return {
    gasDelivery,
    exhaust,
    matching,
    values,
    ready: gasDelivery && exhaust && matching && values,
  };
}
function integrate(state: BoothState, dt: number) {
  state.elapsedMs += dt;
  const seconds = state.elapsedMs / 1000;
  const alpha = (tauMs: number) => 1 - Math.exp(-dt / tauMs);
  state.noise += (random(state) * 2 - 1 - state.noise) * alpha(350);
  const distance = Math.abs(state.controls.matching - state.matchingOptimum);
  const severity = state.faultActive ? clamp((distance - 4) / 26, 0, 1) : 0;
  const breath = 0.5 + 0.5 * Math.sin(2 * Math.PI * 0.8 * seconds);
  // RF source delivery responds mildly to the same gas/pressure state. Those
  // values are not independently randomized and RF cannot repair their causes.
  const processBalance = clamp(
    1 -
      (0.06 * Math.abs(state.values.gasFlow - 100)) / 40 -
      (0.06 * Math.abs(state.values.pressure - 20)) / 30,
    0.82,
    1
  );
  const rfTarget =
    state.controls.rfSetpoint *
      quality(state) *
      (1 - 0.7 * severity * breath) *
      processBalance +
    state.noise * 4;
  state.values.rfPower += (rfTarget - state.values.rfPower) * alpha(180);
  const gasTarget =
    state.controls.gasSetpoint * state.gasGain + state.noise * 0.8;
  state.values.gasFlow += (gasTarget - state.values.gasFlow) * alpha(700);
  const pressureTarget =
    clamp(
      (((20 * state.values.gasFlow) / 100) * 50) / effectiveExhaust(state),
      5,
      65
    ) +
    severity * (breath - 0.5) * 1.2 +
    state.noise * 0.2;
  state.values.pressure +=
    (pressureTarget - state.values.pressure) * alpha(900);
  const tempTarget =
    35 +
    (state.values.rfPower / 500 - 1) * 1.5 +
    Math.max(0, state.values.pressure - 20) * 0.015 +
    state.noise * 0.25;
  state.values.chamberAmbientTemp +=
    (tempTarget - state.values.chamberAmbientTemp) * alpha(18_000);
  state.values.rfPower = clamp(state.values.rfPower, 0, 800);
  state.values.gasFlow = clamp(state.values.gasFlow, 0, 150);
  state.values.pressure = clamp(state.values.pressure, 0, 70);
  state.values.chamberAmbientTemp = clamp(
    state.values.chamberAmbientTemp,
    15,
    60
  );
  state.lampBrightness = Math.round(
    clamp(20 + 210 * Math.pow(state.values.rfPower / 500, 0.7), 0, 255)
  );

  for (const signal of BOOTH_SIGNALS) {
    const value = state.values[signal.key];
    if (!state.alarms[signal.key]) {
      if (value < signal.normal[0] || value > signal.normal[1]) {
        state.alarms[signal.key] = true;
        state.alarmRecoveryMs[signal.key] = 0;
      }
    } else {
      const [low, high] = BOOTH_RECOVERY_RANGES[signal.key];
      state.alarmRecoveryMs[signal.key] =
        value >= low && value <= high
          ? state.alarmRecoveryMs[signal.key] + dt
          : 0;
      if (state.alarmRecoveryMs[signal.key] >= BOOTH_ALARM_CLEAR_MS)
        state.alarms[signal.key] = false;
    }
  }
  const stable = recoveryStatus(state).ready;
  state.faultRecoveryMs = stable ? state.faultRecoveryMs + dt : 0;
  if (state.mission.status === "active") {
    state.mission.elapsedMs += dt;
    state.mission.remainingMs = Math.max(
      0,
      state.mission.durationMs - state.mission.elapsedMs
    );
    state.mission.stableMs =
      stable && state.mission.controlActions > 0
        ? state.mission.stableMs + dt
        : 0;
    // Reaching a deadline without the full stability interval is a timeout.
    if (
      state.mission.stableMs >= state.mission.goalMs &&
      state.mission.elapsedMs <= state.mission.durationMs
    ) {
      state.mission.stableMs = state.mission.goalMs;
      state.mission.status = "won";
      state.mission.score = Math.round(
        clamp(
          100 -
            Math.max(0, state.mission.elapsedMs / 1000 - 5) * 0.6 -
            state.mission.controlActions * 0.15,
          30,
          100
        )
      );
      state.faultActive = false;
      log(
        state,
        "success",
        `복구 성공 · ${Math.round(state.mission.elapsedMs / 100) / 10}초 · ${state.mission.score}점`
      );
    } else if (state.mission.remainingMs <= 0) {
      state.mission.status = "failed";
      state.mission.stableMs = 0;
      log(state, "timeout", "미션 시간 종료 · 조작 기록을 보고 다시 도전");
    }
  } else if (
    state.mode === "free" &&
    state.faultActive &&
    state.faultRecoveryMs >= 1_500
  ) {
    state.faultActive = false;
    log(state, "clear", "조절을 통해 정상 운전상태 복구");
  }
}

/** Bounded CPU work after a delayed/background timer: at most 1 second/11 steps. */
export function stepBoothState(previous: BoothState, dtMs: number): BoothState {
  if (!Number.isFinite(dtMs) || dtMs <= 0) return previous;
  let remaining = Math.min(dtMs, BOOTH_MAX_TICK_MS);
  const state = clone(previous);
  while (remaining > 0) {
    // Evaluate the exact deadline, including a final fractional timer tick.
    const untilDeadline =
      state.mission.status === "active" ? state.mission.remainingMs : 100;
    const dt = Math.min(100, remaining, Math.max(untilDeadline, 0.001));
    const missionWasActive = state.mission.status === "active";
    integrate(state, dt);
    remaining -= dt;
    // A single delayed browser tick must capture the terminal values, not keep
    // evolving the plant through the rest of that tick after the run has ended.
    if (missionWasActive && state.mission.status !== "active") break;
  }
  return state;
}

export function getBoothSnapshot(state: BoothState): BoothSnapshot {
  const unstable = SIGNAL_KEYS.some(key => state.alarms[key]);
  const phase: BoothPhase =
    state.mode === "mission" && state.mission.status === "won"
      ? "success"
      : state.mode === "mission" && state.mission.status === "failed"
        ? "failed"
        : state.mission.status === "cancelled" && state.mode === "mission"
          ? "cancelled"
          : unstable
            ? "fault"
            : state.faultActive
              ? "stabilizing"
              : "normal";
  return {
    selectedScenario: state.selectedScenario,
    scenario: {
      ...getBoothScenario(state.selectedScenario),
      hints: [...getBoothScenario(state.selectedScenario).hints],
      focusSignals: [...getBoothScenario(state.selectedScenario).focusSignals],
      requiredControls: [
        ...getBoothScenario(state.selectedScenario).requiredControls,
      ],
    },
    recovery: recoveryStatus(state),
    values: { ...state.values },
    alarms: { ...state.alarms },
    lampBrightness: state.lampBrightness,
    phase,
    mode: state.mode,
    controls: { ...state.controls },
    mission: { ...state.mission },
    events: state.events.map(event => ({ ...event })),
    matchingQuality: quality(state),
    faultActive: state.faultActive,
    elapsedMs: state.elapsedMs,
  };
}
