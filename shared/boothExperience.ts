/**
 * One shared educational scenario drives the value cards, camera overlay and
 * purple model light. These example ranges are NOT Kiyo specifications or
 * measurements. There is no real RF generator in this model.
 */
export type SignalKey = "pressure" | "gasFlow" | "rfPower" | "chamberAmbientTemp";
export type BoothMode = "free" | "mission";
export type BoothPhase = "normal" | "fault" | "stabilizing" | "success" | "failed" | "cancelled";
export type MissionStatus = "idle" | "active" | "won" | "failed" | "cancelled";
export type BoothControls = {
  rfSetpoint: number;
  gasSetpoint: number;
  exhaustValve: number;
  matching: number;
};
export type BoothControlKey = keyof BoothControls;
export type BoothValues = Record<SignalKey, number>;
export type BoothAlarms = Record<SignalKey, boolean>;
export type BoothEvent = {
  id: number;
  atMs: number;
  type: "control" | "fault" | "clear" | "mission" | "success" | "timeout" | "reset" | "mode";
  message: string;
  control?: BoothControlKey;
  value?: number;
};
export type BoothMission = {
  status: MissionStatus;
  remainingMs: number;
  elapsedMs: number;
  stableMs: number;
  goalMs: number;
  score: number | null;
  controlActions: number;
};
export type BoothState = {
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
  faultActive: boolean;
  faultRecoveryMs: number;
  alarmRecoveryMs: Record<SignalKey, number>;
  eventSequence: number;
};
export type BoothSnapshot = {
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
  | { type: "reset" };

export const BOOTH_CONTROL_LIMITS: Record<BoothControlKey, { min: number; max: number; step: number; initial: number; label: string; unit: string }> = {
  rfSetpoint: { min: 300, max: 700, step: 5, initial: 500, label: "RF 설정", unit: "W" },
  gasSetpoint: { min: 70, max: 130, step: 1, initial: 100, label: "가스 유량 설정", unit: "sccm" },
  exhaustValve: { min: 20, max: 80, step: 1, initial: 50, label: "배기 밸브", unit: "%" },
  matching: { min: 0, max: 100, step: 1, initial: 50, label: "RF 매칭 조절", unit: "%" },
};
export const BOOTH_SIGNALS: ReadonlyArray<{ key: SignalKey; number: 1 | 2 | 3 | 4; label: string; unit: string; normal: readonly [number, number]; target: number }> = [
  { key: "pressure", number: 1, label: "챔버 압력", unit: "mTorr", normal: [17, 23], target: 20 },
  { key: "gasFlow", number: 2, label: "가스 유량", unit: "sccm", normal: [90, 110], target: 100 },
  { key: "rfPower", number: 3, label: "RF 전력", unit: "W", normal: [440, 560], target: 500 },
  { key: "chamberAmbientTemp", number: 4, label: "챔버 주변 온도", unit: "°C", normal: [31, 39], target: 35 },
];
export const BOOTH_MISSION_DURATION_MS = 90_000;
export const BOOTH_STABLE_GOAL_MS = 5_000;
export const BOOTH_MAX_TICK_MS = 1_000;
export const BOOTH_ALARM_CLEAR_MS = 600;
export const BOOTH_MATCHING_TOLERANCE = 6;
export const BOOTH_MIN_STABLE_MATCH_QUALITY = 1 - 0.65 * BOOTH_MATCHING_TOLERANCE / 30;
const SIGNAL_KEYS: SignalKey[] = ["pressure", "gasFlow", "rfPower", "chamberAmbientTemp"];
export const BOOTH_RECOVERY_RANGES: Readonly<Record<SignalKey, readonly [number, number]>> = {
  pressure: [18, 22], gasFlow: [92, 108], rfPower: [460, 540], chamberAmbientTemp: [32, 38],
};
const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));
const initialValues = (): BoothValues => ({ pressure: 20, gasFlow: 100, rfPower: 500, chamberAmbientTemp: 35 });
const initialAlarms = (): BoothAlarms => ({ pressure: false, gasFlow: false, rfPower: false, chamberAmbientTemp: false });
const initialControls = (): BoothControls => ({ rfSetpoint: 500, gasSetpoint: 100, exhaustValve: 50, matching: 50 });
const initialMission = (): BoothMission => ({ status: "idle", remainingMs: BOOTH_MISSION_DURATION_MS, elapsedMs: 0, stableMs: 0, goalMs: BOOTH_STABLE_GOAL_MS, score: null, controlActions: 0 });

export function createBoothState(seed = 0x53474d31): BoothState {
  const normalizedSeed = Number.isFinite(seed) ? (Math.trunc(seed) >>> 0) : 0x53474d31;
  return {
    elapsedMs: 0, mode: "free", controls: initialControls(), values: initialValues(),
    alarms: initialAlarms(), lampBrightness: 230, mission: initialMission(), events: [],
    rngState: normalizedSeed || 0x6d2b79f5, noise: 0, matchingOptimum: 50,
    faultActive: false, faultRecoveryMs: 0,
    alarmRecoveryMs: { pressure: 0, gasFlow: 0, rfPower: 0, chamberAmbientTemp: 0 }, eventSequence: 0,
  };
}

function random(state: BoothState): number {
  let x = state.rngState;
  x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
  state.rngState = x >>> 0;
  return state.rngState / 0x1_0000_0000;
}
function clone(state: BoothState): BoothState {
  return { ...state, controls: { ...state.controls }, values: { ...state.values }, alarms: { ...state.alarms },
    mission: { ...state.mission }, alarmRecoveryMs: { ...state.alarmRecoveryMs }, events: [...state.events] };
}
function log(state: BoothState, type: BoothEvent["type"], message: string, extra: Pick<BoothEvent, "control" | "value"> = {}) {
  const last = state.events[state.events.length - 1];
  // A dragged slider is one continuous adjustment, not dozens of replay rows.
  if (type === "control" && last?.type === "control" && last.control === extra.control && state.elapsedMs - last.atMs < 300) {
    state.events[state.events.length - 1] = { ...last, atMs: state.elapsedMs, message, ...extra };
  } else {
    state.events.push({ id: ++state.eventSequence, atMs: state.elapsedMs, type, message, ...extra });
    if (state.events.length > 50) state.events.shift();
  }
}
function plantFault(state: BoothState) {
  // Shift the simulated best match away from the current setting. The target
  // is intentionally not included in the public snapshot: observe and tune.
  const high = state.controls.matching < 50 || (state.controls.matching === 50 && random(state) >= 0.5);
  state.matchingOptimum = (high ? 68 : 20) + random(state) * 12;
  state.faultActive = true;
  state.faultRecoveryMs = 0;
  state.alarms.rfPower = true;
  state.alarmRecoveryMs.rfPower = 0;
}

export function applyBoothAction(previous: BoothState, action: BoothAction): BoothState {
  if (action.type === "set-control") {
    if (!(action.control in BOOTH_CONTROL_LIMITS) || !Number.isFinite(action.value)) return previous;
    const rule = BOOTH_CONTROL_LIMITS[action.control];
    const value = clamp(action.value, rule.min, rule.max);
    if (value === previous.controls[action.control]) return previous;
    const state = clone(previous);
    state.controls[action.control] = value;
    if (state.mission.status === "active") state.mission.controlActions += 1;
    log(state, "control", `${rule.label} ${Math.round(value * 10) / 10}${rule.unit}`, { control: action.control, value });
    return state;
  }
  if (action.type === "reset") {
    const state = createBoothState(previous.rngState);
    state.elapsedMs = previous.elapsedMs;
    state.mode = previous.mode;
    state.events = [...previous.events]; state.eventSequence = previous.eventSequence;
    if (previous.mission.status === "active") state.mission.status = "cancelled";
    log(state, "reset", previous.mission.status === "active" ? "초기화로 미션 중단" : "조절값 초기화");
    return state;
  }
  const state = clone(previous);
  if (action.type === "set-mode") {
    if (action.mode !== "free" && action.mode !== "mission") return previous;
    if (state.mode === action.mode) return previous;
    if (state.mission.status === "active") {
      state.mission.status = "cancelled"; state.mission.stableMs = 0;
    }
    state.mode = action.mode;
    // Returning from free play starts a fresh mission selection. A historical
    // win must not label newly disturbed values as recovered or lock controls.
    if (action.mode === "mission") state.mission = initialMission();
    log(state, "mode", action.mode === "free" ? "자유 체험으로 전환" : "복구 미션 선택");
  } else if (action.type === "start-mission") {
    state.mode = "mission";
    state.controls = initialControls(); state.values = initialValues(); state.noise = 0;
    state.alarms = initialAlarms();
    state.alarmRecoveryMs = { pressure: 0, gasFlow: 0, rfPower: 0, chamberAmbientTemp: 0 };
    state.mission = { ...initialMission(), status: "active" };
    plantFault(state);
    log(state, "mission", "RF 불안정 미션 시작 · 복구 후 5초 안정 유지");
  } else if (action.type === "inject-fault") {
    if (state.mission.status === "active") return previous;
    plantFault(state);
    log(state, "fault", "RF 매칭 불안정 주입");
  } else if (action.type === "clear-fault") {
    if (state.mission.status === "active") {
      state.mission.status = "cancelled"; state.mission.stableMs = 0;
      log(state, "mission", "직접 이상 해제로 미션 중단 · 성공 점수 없음");
    }
    state.faultActive = false;
    state.matchingOptimum = state.controls.matching;
    state.faultRecoveryMs = 0;
    log(state, "clear", "주입한 RF 이상 해제");
  }
  return state;
}

function quality(state: BoothState): number {
  return clamp(1 - 0.65 * Math.abs(state.controls.matching - state.matchingOptimum) / 30, 0.12, 1);
}
function isStable(state: BoothState): boolean {
  return !SIGNAL_KEYS.some(key => state.alarms[key]) &&
    Math.abs(state.controls.matching - state.matchingOptimum) <= BOOTH_MATCHING_TOLERANCE;
}
function integrate(state: BoothState, dt: number) {
  state.elapsedMs += dt;
  const seconds = state.elapsedMs / 1000;
  const alpha = (tauMs: number) => 1 - Math.exp(-dt / tauMs);
  state.noise += ((random(state) * 2 - 1) - state.noise) * alpha(350);
  const distance = Math.abs(state.controls.matching - state.matchingOptimum);
  const severity = state.faultActive ? clamp((distance - 4) / 26, 0, 1) : 0;
  const breath = 0.5 + 0.5 * Math.sin(2 * Math.PI * 0.8 * seconds);
  const rfTarget = state.controls.rfSetpoint * quality(state) * (1 - 0.7 * severity * breath) + state.noise * 4;
  state.values.rfPower += (rfTarget - state.values.rfPower) * alpha(180);
  const gasTarget = state.controls.gasSetpoint + state.noise * 0.8;
  state.values.gasFlow += (gasTarget - state.values.gasFlow) * alpha(700);
  const pressureTarget = clamp(20 * state.values.gasFlow / 100 * 50 / state.controls.exhaustValve, 5, 65)
    + severity * (breath - 0.5) * 1.2 + state.noise * 0.2;
  state.values.pressure += (pressureTarget - state.values.pressure) * alpha(900);
  const tempTarget = 35 + (state.values.rfPower / 500 - 1) * 1.5 + state.noise * 0.25;
  state.values.chamberAmbientTemp += (tempTarget - state.values.chamberAmbientTemp) * alpha(18_000);
  state.values.rfPower = clamp(state.values.rfPower, 0, 800);
  state.values.gasFlow = clamp(state.values.gasFlow, 0, 150);
  state.values.pressure = clamp(state.values.pressure, 0, 70);
  state.values.chamberAmbientTemp = clamp(state.values.chamberAmbientTemp, 15, 60);
  state.lampBrightness = Math.round(clamp(20 + 210 * Math.pow(state.values.rfPower / 500, 0.7), 0, 255));

  for (const signal of BOOTH_SIGNALS) {
    const value = state.values[signal.key];
    if (!state.alarms[signal.key]) {
      if (value < signal.normal[0] || value > signal.normal[1]) {
        state.alarms[signal.key] = true; state.alarmRecoveryMs[signal.key] = 0;
      }
    } else {
      const [low, high] = BOOTH_RECOVERY_RANGES[signal.key];
      state.alarmRecoveryMs[signal.key] = value >= low && value <= high ? state.alarmRecoveryMs[signal.key] + dt : 0;
      if (state.alarmRecoveryMs[signal.key] >= BOOTH_ALARM_CLEAR_MS) state.alarms[signal.key] = false;
    }
  }
  const stable = isStable(state);
  state.faultRecoveryMs = stable ? state.faultRecoveryMs + dt : 0;
  if (state.mission.status === "active") {
    state.mission.elapsedMs += dt;
    state.mission.remainingMs = Math.max(0, BOOTH_MISSION_DURATION_MS - state.mission.elapsedMs);
    state.mission.stableMs = stable && state.mission.controlActions > 0 ? state.mission.stableMs + dt : 0;
    // Reaching a deadline without the full stability interval is a timeout.
    if (state.mission.stableMs >= state.mission.goalMs && state.mission.elapsedMs <= BOOTH_MISSION_DURATION_MS) {
      state.mission.stableMs = state.mission.goalMs;
      state.mission.status = "won";
      state.mission.score = Math.round(clamp(100 - Math.max(0, state.mission.elapsedMs / 1000 - 5) * 0.6 - state.mission.controlActions * 0.15, 30, 100));
      state.faultActive = false;
      log(state, "success", `복구 성공 · ${Math.round(state.mission.elapsedMs / 100) / 10}초 · ${state.mission.score}점`);
    } else if (state.mission.remainingMs <= 0) {
      state.mission.status = "failed"; state.mission.stableMs = 0;
      log(state, "timeout", "미션 시간 종료 · 조작 기록을 보고 다시 도전");
    }
  } else if (state.mode === "free" && state.faultActive && state.faultRecoveryMs >= 1_500) {
    state.faultActive = false;
    log(state, "clear", "RF 매칭을 조절해 안정 상태 복구");
  }
}

/** Bounded CPU work after a delayed/background timer: at most 1 second/11 steps. */
export function stepBoothState(previous: BoothState, dtMs: number): BoothState {
  if (!Number.isFinite(dtMs) || dtMs <= 0) return previous;
  let remaining = Math.min(dtMs, BOOTH_MAX_TICK_MS);
  const state = clone(previous);
  while (remaining > 0) {
    // Evaluate the exact deadline, including a final fractional timer tick.
    const untilDeadline = state.mission.status === "active" ? state.mission.remainingMs : 100;
    const dt = Math.min(100, remaining, Math.max(untilDeadline, 0.001));
    integrate(state, dt); remaining -= dt;
  }
  return state;
}

export function getBoothSnapshot(state: BoothState): BoothSnapshot {
  const unstable = SIGNAL_KEYS.some(key => state.alarms[key]);
  const phase: BoothPhase = state.mode === "mission" && state.mission.status === "won" ? "success"
    : state.mode === "mission" && state.mission.status === "failed" ? "failed"
    : state.mission.status === "cancelled" && state.mode === "mission" ? "cancelled"
    : unstable ? "fault" : state.faultActive ? "stabilizing" : "normal";
  return {
    values: { ...state.values }, alarms: { ...state.alarms }, lampBrightness: state.lampBrightness,
    phase, mode: state.mode, controls: { ...state.controls }, mission: { ...state.mission },
    events: state.events.map(event => ({ ...event })), matchingQuality: quality(state),
    faultActive: state.faultActive, elapsedMs: state.elapsedMs,
  };
}
