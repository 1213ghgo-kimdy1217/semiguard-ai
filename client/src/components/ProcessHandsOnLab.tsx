import React, { useEffect, useReducer, useState } from "react";
import {
  initialEtchHandsOn,
  initialPhotoHandsOn,
  reduceEtchHandsOn,
  reducePhotoHandsOn,
  etchHandsOnReady,
  initialGenericHandsOn,
  reduceGenericHandsOn,
  type GenericHandsOnProcess,
  type GenericHandsOnAction,
  type GenericHandsOnState,
  type EtchHandsOnAction,
} from "../../../shared/processHandsOn";
import { processEquipment } from "../../../shared/processEquipment";
import { processLessons } from "../../../shared/learningHub";
import type { ProcessId } from "../../../shared/processScenarios";
import { tr, type ProductLanguage } from "../lib/productLanguage";
import EtchHandsOnScene from "./EtchHandsOnScene";
import PhotoHandsOnScene from "./PhotoHandsOnScene";
import GenericFrontHandsOnScene from "./GenericFrontHandsOnScene";
import GenericFilmHandsOnScene from "./GenericFilmHandsOnScene";
import GenericBackHandsOnScene from "./GenericBackHandsOnScene";
import { handsOnProcessConfig } from "./hands-on-process-config";
import "./process-hands-on-lab.css";

const processNames: Record<ProcessId, readonly [string, string, string]> = {
  wafer: ["웨이퍼", "Wafer", "ウェーハ"],
  oxidation: ["산화", "Oxidation", "酸化"],
  photo: ["포토", "Photolithography", "フォト"],
  etch: ["식각", "Etch", "エッチング"],
  deposition: [
    "증착·이온 주입",
    "Deposition / implantation",
    "成膜・イオン注入",
  ],
  metal: ["금속 배선", "Interconnect", "金属配線"],
  eds: ["EDS", "EDS", "EDS"],
  packaging: ["패키징", "Packaging", "パッケージング"],
};
const processOrder: ProcessId[] = [
  "wafer",
  "oxidation",
  "photo",
  "etch",
  "deposition",
  "metal",
  "eds",
  "packaging",
];
const genericProcesses: GenericHandsOnProcess[] = [
  "wafer",
  "oxidation",
  "deposition",
  "metal",
  "eds",
  "packaging",
];
function initialGenericStates() {
  return Object.fromEntries(
    genericProcesses.map(id => [id, initialGenericHandsOn()])
  ) as Record<GenericHandsOnProcess, GenericHandsOnState>;
}
function reduceGenericStates(
  states: Record<GenericHandsOnProcess, GenericHandsOnState>,
  event: { id: GenericHandsOnProcess; action: GenericHandsOnAction }
) {
  const state = reduceGenericHandsOn(states[event.id], event.action);
  return state === states[event.id] ? states : { ...states, [event.id]: state };
}
type StepProps = {
  number: number;
  label: string;
  detail: string;
  disabled?: boolean;
  done?: boolean;
  active?: boolean;
  onClick: () => void;
};
function Step({
  number,
  label,
  detail,
  disabled,
  done,
  active,
  onClick,
}: StepProps) {
  return (
    <button
      className="ho-step"
      type="button"
      disabled={disabled}
      data-done={done}
      data-active={active}
      onClick={onClick}
    >
      <span>{done ? "✓" : String(number).padStart(2, "0")}</span>
      <div>
        <strong>{label}</strong>
        <small>{detail}</small>
      </div>
      <i aria-hidden="true">{active ? "●" : "→"}</i>
    </button>
  );
}

export default function ProcessHandsOnLab({
  language = "ko",
  initialProcess = "etch",
}: {
  language?: ProductLanguage;
  initialProcess?: ProcessId;
}) {
  const l = (ko: string, en: string, ja: string) => tr(language, ko, en, ja);
  const [module, setModule] = useState<ProcessId>(initialProcess);
  const [generic, dispatchGeneric] = useReducer(
    reduceGenericStates,
    undefined,
    initialGenericStates
  );
  const genericId = module !== "etch" && module !== "photo" ? module : null;
  const genericState = genericId ? generic[genericId] : null;
  const genericConfig = genericId ? handsOnProcessConfig[genericId] : null;
  const genericTicks = !!genericState?.running;
  const [etch, dispatchEtch] = useReducer(
    reduceEtchHandsOn,
    undefined,
    initialEtchHandsOn
  );
  const [photo, dispatchPhoto] = useReducer(
    reducePhotoHandsOn,
    undefined,
    initialPhotoHandsOn
  );
  const [activeAction, setActiveAction] = useState("load"),
    [showGuide, setShowGuide] = useState(true),
    [adjustmentsOpen, setAdjustmentsOpen] = useState(false);
  const etchTicks =
    module === "etch" && (etch.pump === "pumping" || etch.running);
  const photoTicks =
    module === "photo" &&
    (photo.phase === "exposing" || photo.phase === "developing");
  useEffect(() => {
    if (!etchTicks) return;
    const timer = window.setInterval(() => {
      if (!document.hidden) dispatchEtch({ type: "tick", seconds: 0.1 });
    }, 100);
    return () => window.clearInterval(timer);
  }, [etchTicks]);
  useEffect(() => {
    if (!photoTicks) return;
    const timer = window.setInterval(() => {
      if (!document.hidden) dispatchPhoto({ type: "tick", seconds: 0.1 });
    }, 100);
    return () => window.clearInterval(timer);
  }, [photoTicks]);
  useEffect(() => {
    if (!genericId || !genericTicks) return;
    const timer = window.setInterval(() => {
      if (!document.hidden)
        dispatchGeneric({
          id: genericId,
          action: { type: "tick", seconds: 0.1 },
        });
    }, 100);
    return () => window.clearInterval(timer);
  }, [genericId, genericTicks]);
  const genericAct = (action: GenericHandsOnAction) => {
    if (genericId) dispatchGeneric({ id: genericId, action });
  };
  const selectProcess = (id: ProcessId) => {
    if (module === "etch") dispatchEtch({ type: "pause" });
    if (genericId)
      dispatchGeneric({ id: genericId, action: { type: "pause" } });
    setModule(id);
  };
  const act = (action: EtchHandsOnAction) => {
    setActiveAction(action.type);
    if (action.type === "rf" && !etch.rfOn) setAdjustmentsOpen(true);
    if (action.type === "reset") setAdjustmentsOpen(false);
    dispatchEtch(action);
  };
  const equipment = processEquipment[module],
    lesson = processLessons.find(item => item.id === module)!;
  const complete = genericState
    ? genericState.progress >= 1
    : module === "etch"
      ? etch.progress >= 1
      : photo.phase === "complete";
  const hint =
    genericState && genericConfig
      ? l(
          ...(complete
            ? genericConfig.complete
            : genericConfig.hints[genericState.stage])
        )
      : module === "etch"
        ? !etch.loaded
          ? l(
              "먼저 웨이퍼를 넣어보세요.",
              "Start by loading the wafer.",
              "まずウェーハを入れてみましょう。"
            )
          : etch.pump === "off"
            ? l(
                "챔버를 준비하면 공기 표현이 빠져나가요.",
                "Prepare the chamber and watch the air representation leave.",
                "チャンバーを準備し、空気の表示が抜ける様子を見ましょう。"
              )
            : etch.pump === "pumping"
              ? l(
                  "챔버 준비 중…",
                  "Preparing the chamber…",
                  "チャンバー準備中…"
                )
              : etch.progress >= 1
                ? l(
                    "마스크 사이의 막이 제거됐어요. 남은 구조를 살펴보세요.",
                    "The exposed film has been removed. Inspect the remaining structure.",
                    "露出した膜が除去されました。残った構造を確認しましょう。"
                  )
                : !etch.gasOn
                  ? l(
                      "가스를 열어 입자 흐름을 만들어보세요.",
                      "Open the gas to create the particle flow.",
                      "ガスを開いて粒子の流れを作りましょう。"
                    )
                  : etch.gasLevel <= 0
                    ? l(
                        "조절 막대에서 가스 흐름을 올려보세요.",
                        "Increase the model gas flow with its slider.",
                        "スライダーで模型のガス流量を上げましょう。"
                      )
                    : etch.rfLevel <= 0
                      ? l(
                          "조절 막대에서 RF 세기를 올린 뒤 켜보세요.",
                          "Raise the model RF level, then turn it on.",
                          "模型のRF強さを上げてから入れましょう。"
                        )
                      : !etch.rfOn
                        ? l(
                            "RF를 켜면 챔버 안의 빛이 켜져요.",
                            "Turn on RF and watch the chamber light up.",
                            "RFを入れてチャンバーの光を確認しましょう。"
                          )
                        : etch.running
                          ? l(
                              "마스크가 보호하는 곳과 노출된 곳을 비교해 보세요.",
                              "Compare protected and exposed areas.",
                              "マスクで保護された場所と露出部分を比較しましょう。"
                            )
                          : l(
                              "식각을 시작해 막이 어떻게 바뀌는지 확인하세요.",
                              "Start etching and watch the film change.",
                              "エッチングを始めて膜の変化を見ましょう。"
                            )
        : photo.phase === "align"
          ? l(
              "그림 속 마스크를 좌우로 끌어 설계 위치에 맞춰보세요.",
              "Drag the mask left or right to match the design position.",
              "図のマスクを左右にドラッグして設計位置に合わせましょう。"
            )
          : photo.phase === "exposing"
            ? l(
                "열린 부분을 통과한 빛이 감광막에 닿고 있어요.",
                "Light passes through the openings onto the photoresist.",
                "開口部を通った光が感光膜に当たっています。"
              )
            : photo.phase === "exposed"
              ? l(
                  "노광 완료! 현상해서 패턴을 드러내보세요.",
                  "Exposure complete. Develop to reveal the pattern.",
                  "露光完了。現像してパターンを見てみましょう。"
                )
              : photo.phase === "developing"
                ? l(
                    "양성 레지스트의 노광된 부분이 제거되고 있어요.",
                    "The exposed positive photoresist is being removed.",
                    "露光されたポジ型レジストが除去されています。"
                  )
                : l(
                    "내가 맞춘 마스크 위치가 패턴으로 남았어요.",
                    "Your mask alignment is now visible in the pattern.",
                    "合わせたマスク位置がパターンに表れました。"
                  );
  return (
    <main className="ho-lab">
      <header className="ho-intro">
        <div>
          <p>SEMIGUARD / HANDS-ON CONCEPT LAB</p>
          <h1>
            {l(
              "직접 움직여, 공정을 만들어보세요.",
              "Build the process with your own actions.",
              "自分で動かして工程を作ってみましょう。"
            )}
          </h1>
        </div>
        <span>
          {l(
            "개념 체험 · 저장 없음",
            "Concept experience · not saved",
            "概念体験・保存なし"
          )}
        </span>
      </header>
      <div
        className="ho-module-tabs"
        role="group"
        aria-label={l("체험할 공정", "Process to try", "体験する工程")}
      >
        {processOrder.map((id, index) => (
          <button
            key={id}
            type="button"
            aria-pressed={module === id}
            data-module={id}
            onClick={() => selectProcess(id)}
          >
            <span>{String(index + 1).padStart(2, "0")}</span>
            {l(...processNames[id])}
          </button>
        ))}
      </div>
      <section
        className="ho-experience"
        data-module={module}
        data-complete={complete}
      >
        <div className="ho-workspace">
          <header>
            <div>
              <span>
                {l(
                  "연결되는 장비 사례",
                  "Related equipment example",
                  "関連する装置例"
                )}
              </span>
              <strong>
                {module === "deposition"
                  ? generic.deposition.mode === "film"
                    ? "Tokyo Electron TELINDY PLUS"
                    : "Applied Materials VIISta Trident"
                  : equipment.name}
              </strong>
            </div>
            <label>
              <input
                type="checkbox"
                checked={showGuide}
                onChange={event => setShowGuide(event.target.checked)}
              />
              {genericConfig
                ? l(...genericConfig.guide)
                : module === "etch"
                  ? l("처음 막 겹치기", "Original film guide", "元の膜を重ねる")
                  : l("설계 위치 가이드", "Design guide", "設計位置ガイド")}
            </label>
          </header>
          {genericId && genericState ? (
            module === "wafer" || module === "oxidation" ? (
              <GenericFrontHandsOnScene
                processId={genericId}
                state={genericState}
                language={language}
                showGuide={showGuide}
                onSelect={value => genericAct({ type: "select", value })}
              />
            ) : module === "deposition" || module === "metal" ? (
              <GenericFilmHandsOnScene
                processId={genericId}
                state={genericState}
                language={language}
                showGuide={showGuide}
                onSelect={value => genericAct({ type: "select", value })}
              />
            ) : (
              <GenericBackHandsOnScene
                processId={genericId}
                state={genericState}
                language={language}
                showGuide={showGuide}
                onSelect={value => genericAct({ type: "select", value })}
              />
            )
          ) : module === "etch" ? (
            <EtchHandsOnScene
              state={etch}
              language={language}
              activeAction={activeAction}
              showGuide={showGuide}
            />
          ) : (
            <PhotoHandsOnScene
              state={photo}
              language={language}
              showGuide={showGuide}
              onOffsetChange={value => dispatchPhoto({ type: "offset", value })}
            />
          )}
          <p className="ho-hint" role="status" aria-live="polite">
            {hint}
          </p>
        </div>
        <aside
          className="ho-controls"
          aria-label={l("직접 조작하기", "Hands-on controls", "自分で操作")}
        >
          <p className="ho-controls-title">
            {l("한 단계씩 눌러보세요", "Try each step", "順番に試しましょう")}
          </p>
          {genericId && genericState && genericConfig ? (
            <>
              {module === "deposition" ? (
                <div
                  className="ho-mode"
                  role="group"
                  aria-label={l(
                    "공정 역할 선택",
                    "Select process role",
                    "工程の役割を選択"
                  )}
                >
                  {(["film", "implant"] as const).map(mode => (
                    <button
                      type="button"
                      key={mode}
                      aria-pressed={genericState.mode === mode}
                      onClick={() => genericAct({ type: "mode", value: mode })}
                    >
                      {mode === "film"
                        ? l("성막", "Film deposition", "成膜")
                        : l("이온 주입", "Ion implantation", "イオン注入")}
                    </button>
                  ))}
                </div>
              ) : null}
              {genericConfig.steps.map((step, index) => (
                <Step
                  key={`${module}-${index}`}
                  number={index + 1}
                  label={
                    index === 3 && genericState.running
                      ? l("일시 정지", "Pause", "一時停止")
                      : l(...step.label)
                  }
                  detail={l(...step.detail)}
                  done={index < 3 ? genericState.stage > index : complete}
                  active={index === 3 && genericState.running}
                  disabled={
                    index < 3
                      ? genericState.stage !== index
                      : genericState.stage !== 3 || complete
                  }
                  onClick={() =>
                    genericAct(
                      index < 3
                        ? { type: "advance", step: index }
                        : { type: genericState.running ? "pause" : "start" }
                    )
                  }
                />
              ))}
              {["oxidation", "deposition", "metal"].includes(module) ? (
                <details className="ho-adjustments">
                  <summary>
                    {l(
                      "빛·입자 표현 조절",
                      "Adjust light / particle appearance",
                      "光・粒子の表現を調整"
                    )}
                  </summary>
                  <label>
                    {l(
                      "그림의 표현 세기 · 실제 설정 아님",
                      "Visual intensity · not a real setting",
                      "図の表現強度・実設定ではありません"
                    )}
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={genericState.level}
                      onChange={event =>
                        genericAct({
                          type: "level",
                          value: Number(event.target.value),
                        })
                      }
                    />
                  </label>
                </details>
              ) : null}
              <div className="ho-progress">
                <span>
                  {l("체험 진행", "Experience progress", "体験の進行")}
                </span>
                <progress max={1} value={genericState.progress} />
                <strong>{Math.round(genericState.progress * 100)}%</strong>
              </div>
            </>
          ) : module === "etch" ? (
            <>
              <Step
                number={1}
                label={l("웨이퍼 넣기", "Load wafer", "ウェーハを入れる")}
                detail={l(
                  "웨이퍼가 챔버 안으로 이동해요.",
                  "Move the wafer into the chamber.",
                  "ウェーハがチャンバーへ移動します。"
                )}
                done={etch.loaded}
                disabled={etch.loaded}
                onClick={() => act({ type: "load" })}
              />
              <Step
                number={2}
                label={l("챔버 준비", "Prepare chamber", "チャンバー準備")}
                detail={l(
                  "감압의 기본 개념을 확인해요.",
                  "Explore the concept of evacuation.",
                  "減圧の基本概念を確認します。"
                )}
                done={etch.pump === "ready"}
                active={etch.pump === "pumping"}
                disabled={!etch.loaded || etch.pump !== "off"}
                onClick={() => act({ type: "pump" })}
              />
              <Step
                number={3}
                label={
                  etch.gasOn
                    ? l("가스 닫기", "Close gas", "ガスを閉じる")
                    : l("가스 열기", "Open gas", "ガスを開く")
                }
                detail={l(
                  "입자 흐름이 생겨요.",
                  "Create a visible particle stream.",
                  "粒子の流れができます。"
                )}
                done={etch.gasOn}
                disabled={etch.pump !== "ready" || complete}
                onClick={() => act({ type: "gas" })}
              />
              <Step
                number={4}
                label={
                  etch.rfOn
                    ? l("RF 끄기", "Turn RF off", "RFを切る")
                    : l("RF 켜기", "Turn RF on", "RFを入れる")
                }
                detail={l(
                  "빛과 파형의 변화가 보여요.",
                  "Watch light and waveform changes.",
                  "光と波形の変化を見ます。"
                )}
                done={etch.rfOn}
                disabled={
                  !etch.gasOn ||
                  etch.gasLevel <= 0 ||
                  etch.rfLevel <= 0 ||
                  complete
                }
                onClick={() => act({ type: "rf" })}
              />
              <Step
                number={5}
                label={
                  etch.running
                    ? l("식각 멈추기", "Pause etch", "エッチング停止")
                    : complete
                      ? l("패턴 완성", "Pattern complete", "パターン完成")
                      : l("식각 시작", "Start etch", "エッチング開始")
                }
                detail={l(
                  "노출된 막이 줄어들어요.",
                  "Watch the exposed film shrink.",
                  "露出した膜が減ります。"
                )}
                active={etch.running}
                done={complete}
                disabled={!etch.running && !etchHandsOnReady(etch)}
                onClick={() => act({ type: etch.running ? "pause" : "start" })}
              />
              <details
                className="ho-adjustments"
                open={adjustmentsOpen}
                onToggle={event => setAdjustmentsOpen(event.currentTarget.open)}
              >
                <summary>
                  {l(
                    "가스·RF 세기 조절",
                    "Adjust gas / RF levels",
                    "ガス・RF強さの調整"
                  )}
                </summary>
                <label>
                  {l("가스 흐름 · 모형", "Gas flow · model", "ガス流量・模型")}
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={etch.gasLevel}
                    onChange={event =>
                      act({
                        type: "gasLevel",
                        value: Number(event.target.value),
                      })
                    }
                  />
                </label>
                <label>
                  {l("RF 세기 · 모형", "RF level · model", "RF強さ・模型")}
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={etch.rfLevel}
                    onChange={event =>
                      act({
                        type: "rfLevel",
                        value: Number(event.target.value),
                      })
                    }
                  />
                </label>
              </details>
              <div className="ho-progress">
                <span>{l("막 제거 과정", "Film removal", "膜の除去")}</span>
                <progress max={1} value={etch.progress} />
                <strong>{Math.round(etch.progress * 100)}%</strong>
              </div>
            </>
          ) : (
            <>
              <div className="ho-mask-control">
                <span>01</span>
                <strong>
                  {l("마스크 맞추기", "Align mask", "マスク位置合わせ")}
                </strong>
                <p>
                  {l(
                    "그림을 끌거나 아래 막대로 움직여보세요.",
                    "Drag the diagram or use the slider.",
                    "図をドラッグするかスライダーを使います。"
                  )}
                </p>
                <label>
                  {l(
                    "마스크 좌우 위치",
                    "Mask horizontal position",
                    "マスクの左右位置"
                  )}
                  <input
                    type="range"
                    min={-36}
                    max={36}
                    value={photo.offset}
                    disabled={photo.phase !== "align"}
                    onChange={event =>
                      dispatchPhoto({
                        type: "offset",
                        value: Number(event.target.value),
                      })
                    }
                  />
                </label>
                <button
                  type="button"
                  disabled={photo.phase !== "align"}
                  onClick={() => dispatchPhoto({ type: "offset", value: 0 })}
                >
                  {l("가운데 맞추기", "Center mask", "中央に合わせる")}
                </button>
              </div>
              <Step
                number={2}
                label={
                  photo.phase === "exposing"
                    ? l("노광 중…", "Exposing…", "露光中…")
                    : l("빛으로 노광하기", "Expose with light", "光で露光")
                }
                detail={l(
                  "마스크의 열린 부분으로 빛이 지나가요.",
                  "Light passes through mask openings.",
                  "マスク開口部を光が通ります。"
                )}
                active={photo.phase === "exposing"}
                done={["exposed", "developing", "complete"].includes(
                  photo.phase
                )}
                disabled={photo.phase !== "align"}
                onClick={() => dispatchPhoto({ type: "expose" })}
              />
              <Step
                number={3}
                label={
                  photo.phase === "developing"
                    ? l("현상 중…", "Developing…", "現像中…")
                    : l(
                        "현상해서 패턴 보기",
                        "Develop to reveal pattern",
                        "現像してパターンを見る"
                      )
                }
                detail={l(
                  "노광된 양성 레지스트가 제거돼요.",
                  "Remove exposed positive photoresist.",
                  "露光したポジ型レジストを除去します。"
                )}
                active={photo.phase === "developing"}
                done={complete}
                disabled={photo.phase !== "exposed"}
                onClick={() => dispatchPhoto({ type: "develop" })}
              />
              <div className="ho-progress">
                <span>
                  {photo.phase === "developing" || complete
                    ? l("현상 과정", "Development", "現像")
                    : l("노광 과정", "Exposure", "露光")}
                </span>
                <progress
                  max={1}
                  value={
                    photo.phase === "developing" || complete
                      ? photo.developmentProgress
                      : photo.exposureProgress
                  }
                />
                <strong>
                  {Math.round(
                    (photo.phase === "developing" || complete
                      ? photo.developmentProgress
                      : photo.exposureProgress) * 100
                  )}
                  %
                </strong>
              </div>
            </>
          )}
          <button
            className="ho-reset"
            type="button"
            onClick={() => {
              if (genericId) genericAct({ type: "reset" });
              else if (module === "etch") act({ type: "reset" });
              else dispatchPhoto({ type: "reset" });
            }}
          >
            {l(
              "처음부터 다시 해보기 ↻",
              "Try again from the start ↻",
              "最初からやり直す ↻"
            )}
          </button>
        </aside>
      </section>
      <p className="ho-scope">
        {l(
          "공개 원리를 단순화한 개념 체험입니다. 실제 장비 설정·물리량·공정 시간을 재현하거나 장비를 제어하지 않습니다.",
          "A simplified concept experience based on public principles. It does not reproduce equipment settings, physical quantities or process timing, or control equipment.",
          "公開原理を簡略化した概念体験です。実際の装置設定・物理量・工程時間を再現せず、装置を制御しません。"
        )}
      </p>
      <section className="ho-equipment">
        <div>
          <p>
            {l(
              "체험에서 원문으로",
              "FROM EXPERIENCE TO THE SOURCE",
              "体験から原文へ"
            )}
          </p>
          <h2>
            {l(
              "이 조작은 어떤 장비와 연결되나요?",
              "Which equipment does this relate to?",
              "この操作はどの装置に関係しますか？"
            )}
          </h2>
          <strong>{equipment.name}</strong>
          <p>{l(...equipment.context)}</p>
          {module === "photo" ? (
            <p>
              {l(
                "마스크 정렬·노광은 노광 장비와, 현상은 후속 공정의 개념과 연결해 구분합니다.",
                "Mask alignment and exposure relate to the scanner; development is a distinct subsequent process.",
                "マスク位置合わせ・露光は露光装置、現像は別の後続工程として区別します。"
              )}
            </p>
          ) : null}
        </div>
        <div className="ho-source-links">
          {equipment.sources.map(source => (
            <a
              key={source.url}
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              {source.name} ·{" "}
              {l("회사 원문", "Manufacturer source", "メーカー原文")} ↗
            </a>
          ))}
          <a href={lesson.source} target="_blank" rel="noopener noreferrer">
            {l(
              "삼성반도체 · 공정 원리 원문",
              "Samsung · process concept source",
              "Samsung・工程原理の原文"
            )}{" "}
            ↗
          </a>
        </div>
        <details>
          <summary>
            {l(
              "원문과 이 체험의 연결 범위",
              "How the source relates to this experience",
              "原文と体験の関係"
            )}
          </summary>
          <p>
            {l(
              "회사 원문은 장비 유형과 공정 역할을 이해하기 위한 자료입니다. 체험의 조작 순서·상대적인 세기·그림은 학습을 위해 단순화했으며, 해당 제품의 조작 화면이나 제조사 검증을 의미하지 않습니다.",
              "Manufacturer sources explain equipment types and process roles. Controls, relative levels and diagrams are simplified for learning; they are not the product's operator interface or manufacturer validation.",
              "メーカー原文は装置の種類と工程の役割を理解する資料です。操作順序・相対強度・図は学習用に簡略化しており、製品の操作画面やメーカー検証を意味しません。"
            )}
          </p>
        </details>
      </section>
      <details className="ho-all-equipment">
        <summary>
          {l(
            "8대 공정의 장비 회사 원문 함께 보기",
            "Explore equipment sources for all eight processes",
            "8大工程の装置メーカー原文を見る"
          )}
        </summary>
        <div>
          {(Object.keys(processEquipment) as ProcessId[]).map(id => (
            <article key={id}>
              <span>{l(...processNames[id])}</span>
              <strong>{processEquipment[id].name}</strong>
              {id === "wafer" ? (
                <small>
                  {l(
                    "표면 검사·형상 계측 사례",
                    "Surface inspection / geometry metrology",
                    "表面検査・形状計測の例"
                  )}
                </small>
              ) : id === "eds" ? (
                <small>
                  {l(
                    "테스트 시스템 · 프로버와 역할 구분",
                    "Test system · distinct from a prober",
                    "テストシステム・プローバーと役割を区別"
                  )}
                </small>
              ) : null}
              {processEquipment[id].sources.map(source => (
                <a
                  key={source.url}
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {source.name} ↗
                </a>
              ))}
            </article>
          ))}
        </div>
      </details>
    </main>
  );
}
