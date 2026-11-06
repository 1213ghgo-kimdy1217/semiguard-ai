// Separate concept exercises: no equipment recipes, measured physics or scored records.
const unit = (value: number) =>
  Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
const percent = (value: number) =>
  Number.isFinite(value) ? Math.max(0, Math.min(100, Math.round(value))) : 0;
export type EtchHandsOnState = {
  loaded: boolean;
  pump: "off" | "pumping" | "ready";
  pumpProgress: number;
  gasOn: boolean;
  rfOn: boolean;
  gasLevel: number;
  rfLevel: number;
  running: boolean;
  progress: number;
};
export const initialEtchHandsOn = (): EtchHandsOnState => ({
  loaded: false,
  pump: "off",
  pumpProgress: 0,
  gasOn: false,
  rfOn: false,
  gasLevel: 55,
  rfLevel: 60,
  running: false,
  progress: 0,
});
export type EtchHandsOnAction =
  | { type: "load" | "pump" | "gas" | "rf" | "start" | "pause" | "reset" }
  | { type: "gasLevel" | "rfLevel"; value: number }
  | { type: "tick"; seconds: number };
export function etchHandsOnReady(state: EtchHandsOnState) {
  return (
    state.loaded &&
    state.pump === "ready" &&
    state.gasOn &&
    state.rfOn &&
    state.gasLevel > 0 &&
    state.rfLevel > 0 &&
    state.progress < 1
  );
}
export function reduceEtchHandsOn(
  state: EtchHandsOnState,
  action: EtchHandsOnAction
): EtchHandsOnState {
  switch (action.type) {
    case "reset":
      return initialEtchHandsOn();
    case "load":
      return state.loaded ? state : { ...state, loaded: true };
    case "pump":
      return state.loaded && state.pump === "off"
        ? { ...state, pump: "pumping", pumpProgress: 0 }
        : state;
    case "gas":
      if (state.pump !== "ready" || !state.loaded || state.progress >= 1)
        return state;
      return {
        ...state,
        gasOn: !state.gasOn,
        ...(state.gasOn ? { rfOn: false, running: false } : {}),
      };
    case "rf":
      if (
        !state.gasOn ||
        state.gasLevel <= 0 ||
        state.rfLevel <= 0 ||
        state.pump !== "ready" ||
        state.progress >= 1
      )
        return state;
      return {
        ...state,
        rfOn: !state.rfOn,
        ...(state.rfOn ? { running: false } : {}),
      };
    case "start":
      return etchHandsOnReady(state) ? { ...state, running: true } : state;
    case "pause":
      return { ...state, running: false };
    case "gasLevel": {
      const gasLevel = percent(action.value);
      return {
        ...state,
        gasLevel,
        ...(gasLevel === 0 ? { rfOn: false, running: false } : {}),
      };
    }
    case "rfLevel": {
      const rfLevel = percent(action.value);
      return {
        ...state,
        rfLevel,
        ...(rfLevel === 0 ? { rfOn: false, running: false } : {}),
      };
    }
    case "tick": {
      if (!Number.isFinite(action.seconds) || action.seconds <= 0) return state;
      const seconds = Math.min(0.25, action.seconds);
      if (state.pump === "pumping") {
        const pumpProgress = unit(state.pumpProgress + seconds / 1.5);
        return {
          ...state,
          pumpProgress,
          pump: pumpProgress >= 1 ? "ready" : "pumping",
        };
      }
      if (!state.running || !etchHandsOnReady(state)) return state;
      // A fixed teaching sequence: control levels affect artwork, not an invented etch-rate model.
      const progress = unit(state.progress + seconds / 6);
      return {
        ...state,
        progress,
        ...(progress >= 1 ? { running: false, rfOn: false, gasOn: false } : {}),
      };
    }
  }
}

export type PhotoHandsOnPhase =
  | "align"
  | "exposing"
  | "exposed"
  | "developing"
  | "complete";
export type PhotoHandsOnState = {
  phase: PhotoHandsOnPhase;
  offset: number;
  exposureOffset: number;
  exposureProgress: number;
  developmentProgress: number;
};
export const initialPhotoHandsOn = (): PhotoHandsOnState => ({
  phase: "align",
  offset: 24,
  exposureOffset: 24,
  exposureProgress: 0,
  developmentProgress: 0,
});
export type PhotoHandsOnAction =
  | { type: "offset"; value: number }
  | { type: "expose" | "develop" | "reset" }
  | { type: "tick"; seconds: number };
export function reducePhotoHandsOn(
  state: PhotoHandsOnState,
  action: PhotoHandsOnAction
): PhotoHandsOnState {
  switch (action.type) {
    case "reset":
      return initialPhotoHandsOn();
    case "offset":
      return state.phase === "align" && Number.isFinite(action.value)
        ? {
            ...state,
            offset: Math.max(-36, Math.min(36, Math.round(action.value))),
          }
        : state;
    case "expose":
      return state.phase === "align"
        ? {
            ...state,
            phase: "exposing",
            exposureOffset: state.offset,
            exposureProgress: 0,
          }
        : state;
    case "develop":
      return state.phase === "exposed"
        ? { ...state, phase: "developing", developmentProgress: 0 }
        : state;
    case "tick": {
      if (!Number.isFinite(action.seconds) || action.seconds <= 0) return state;
      const seconds = Math.min(0.25, action.seconds);
      if (state.phase === "exposing") {
        const exposureProgress = unit(state.exposureProgress + seconds / 2.5);
        return {
          ...state,
          exposureProgress,
          phase: exposureProgress >= 1 ? "exposed" : "exposing",
        };
      }
      if (state.phase === "developing") {
        const developmentProgress = unit(
          state.developmentProgress + seconds / 4
        );
        return {
          ...state,
          developmentProgress,
          phase: developmentProgress >= 1 ? "complete" : "developing",
        };
      }
      return state;
    }
  }
}

export type GenericHandsOnProcess =
  | "wafer"
  | "oxidation"
  | "deposition"
  | "metal"
  | "eds"
  | "packaging";
export type GenericHandsOnState = {
  stage: number;
  running: boolean;
  progress: number;
  level: number;
  selection: number;
  mode: "film" | "implant";
};
export const initialGenericHandsOn = (): GenericHandsOnState => ({
  stage: 0,
  running: false,
  progress: 0,
  level: 60,
  selection: 5,
  mode: "film",
});
export type GenericHandsOnAction =
  | { type: "advance"; step: number }
  | { type: "start" | "pause" | "reset" }
  | { type: "tick"; seconds: number }
  | { type: "level" | "select"; value: number }
  | { type: "mode"; value: "film" | "implant" };
export function reduceGenericHandsOn(
  state: GenericHandsOnState,
  action: GenericHandsOnAction
): GenericHandsOnState {
  switch (action.type) {
    case "reset":
      return { ...initialGenericHandsOn(), mode: state.mode };
    case "mode":
      return action.value === state.mode
        ? state
        : { ...initialGenericHandsOn(), mode: action.value };
    case "advance":
      return action.step === state.stage && state.stage < 3 && !state.running
        ? { ...state, stage: state.stage + 1 }
        : state;
    case "start":
      return state.stage === 3 && state.progress < 1
        ? { ...state, running: true }
        : state;
    case "pause":
      return state.running ? { ...state, running: false } : state;
    case "level":
      return Number.isFinite(action.value)
        ? { ...state, level: percent(action.value) }
        : state;
    case "select":
      return state.stage >= 1 &&
        state.stage < 3 &&
        !state.running &&
        state.progress === 0 &&
        Number.isFinite(action.value)
        ? {
            ...state,
            selection: Math.max(0, Math.min(15, Math.round(action.value))),
          }
        : state;
    case "tick": {
      if (
        !state.running ||
        state.stage !== 3 ||
        !Number.isFinite(action.seconds) ||
        action.seconds <= 0
      )
        return state;
      // Fixed teaching progress: this is not a manufacturing rate or test result.
      const progress = unit(
        state.progress + Math.min(0.25, action.seconds) / 4
      );
      return { ...state, progress, running: progress < 1 };
    }
  }
}
