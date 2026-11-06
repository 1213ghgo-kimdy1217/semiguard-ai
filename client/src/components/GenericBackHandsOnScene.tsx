import React, { useId, type CSSProperties } from "react";
import { tr } from "../lib/productLanguage";
import type { GenericHandsOnSceneProps } from "./hands-on-scene-types";
import "./generic-back-hands-on-scene.css";

const bound = (value: number, max = 1) =>
  Number.isFinite(value) ? Math.max(0, Math.min(max, value)) : 0;
const pick = (value: number) => Math.round(bound(value, 15));
const dies = Array.from({ length: 16 }, (_, index) => ({
  x: 84 + (index % 4) * 42,
  y: 109 + Math.floor(index / 4) * 42,
}));
const pads = Array.from({ length: 16 }, (_, index) => {
  const side = Math.floor(index / 4),
    position = index % 4;
  if (side === 0)
    return {
      x: 193 + position * 32,
      y: 153,
      leadX: 193 + position * 32,
      leadY: 89,
    };
  if (side === 1)
    return {
      x: 307,
      y: 173 + position * 24,
      leadX: 383,
      leadY: 173 + position * 24,
    };
  if (side === 2)
    return {
      x: 289 - position * 32,
      y: 255,
      leadX: 289 - position * 32,
      leadY: 313,
    };
  return {
    x: 179,
    y: 245 - position * 24,
    leadX: 99,
    leadY: 245 - position * 24,
  };
});

/** Generic teaching artwork. Neither view reproduces a manufacturer's hardware or measured outputs. */
export default function GenericBackHandsOnScene({
  processId,
  state,
  language,
  showGuide,
  onSelect,
}: GenericHandsOnSceneProps) {
  const id = `gbh-${useId().replace(/:/g, "")}`;
  const l = (ko: string, en: string, ja: string) => tr(language, ko, en, ja);
  const eds = processId === "eds";
  const stage = Math.floor(bound(state.stage, 3));
  const progress = bound(state.progress);
  const level = bound(state.level, 100) / 100;
  const selection = pick(state.selection);
  const canSelect = stage >= 1 && stage < 3 && !state.running && progress === 0;
  const complete = progress >= 1;
  const running = stage === 3 && state.running && !complete;
  const die = dies[selection];
  const dieX = die.x + 18.5,
    dieY = die.y + 18.5;
  const pad = pads[selection];
  const midX = (pad.x + pad.leadX) / 2 + (pad.leadY === pad.y ? 0 : 20);
  const midY = (pad.y + pad.leadY) / 2 - (pad.leadX === pad.x ? 0 : 25);
  const wire = `M${pad.x} ${pad.y}Q${midX} ${midY} ${pad.leadX} ${pad.leadY}`;
  const toolT = stage >= 3 ? progress : 0;
  const toolX =
    (1 - toolT) ** 2 * pad.x +
    2 * (1 - toolT) * toolT * midX +
    toolT ** 2 * pad.leadX;
  const toolY =
    (1 - toolT) ** 2 * pad.y +
    2 * (1 - toolT) * toolT * midY +
    toolT ** 2 * pad.leadY;
  const signalPoints = Array.from({ length: 25 }, (_, index) => {
    const wave =
      Math.sin(index * 0.8 + selection * 0.37) + Math.sin(index * 1.9) * 0.28;
    return `${326 + index * 4.7},${227 - wave * level * 15}`;
  }).join(" ");

  const select = (value: number) => {
    if (canSelect) onSelect(pick(value));
  };
  const keySelect = (
    event: React.KeyboardEvent<SVGGElement>,
    index: number
  ) => {
    if (!canSelect) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      select(index);
      return;
    }
    const move =
      event.key === "ArrowLeft"
        ? -1
        : event.key === "ArrowRight"
          ? 1
          : event.key === "ArrowUp"
            ? eds
              ? -4
              : -1
            : event.key === "ArrowDown"
              ? eds
                ? 4
                : 1
              : null;
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? 15
          : move === null
            ? null
            : pick(index + move);
    if (next !== null) {
      event.preventDefault();
      select(next);
      event.currentTarget.ownerSVGElement
        ?.querySelector<SVGGElement>(`[data-pick-index="${next}"]`)
        ?.focus();
    }
  };
  const status = eds
    ? stage === 0
      ? l(
          "웨이퍼를 검사 위치로 옮겨보세요",
          "Load the wafer onto the probing stage",
          "ウェーハをプローブ位置へ載せましょう"
        )
      : stage < 3
        ? l(
            "다이를 눌러 접촉할 위치를 골라보세요",
            "Select a die for the probe contact",
            "ダイを選んで接触位置を決めましょう"
          )
        : complete
          ? l(
              "선택한 다이의 가상 신호 표시가 끝났어요",
              "The selected die's illustrative signal is complete",
              "選択したダイの仮想信号表示が完了しました"
            )
          : running
            ? l(
                "프로브 연결을 통해 가상 신호가 표시돼요",
                "An illustrative signal appears through the probe connection",
                "プローブ接続を通じて仮想信号が表示されます"
              )
            : l(
                "준비 완료 · 검사 시작을 눌러보세요",
                "Ready · start the test sequence",
                "準備完了・テストを開始しましょう"
              )
    : stage === 0
      ? l(
          "칩을 본딩 위치에 놓아보세요",
          "Load the chip into the bonding position",
          "チップをボンディング位置へ載せましょう"
        )
      : stage < 3
        ? l(
            "칩의 패드를 눌러 연결할 곳을 고르세요",
            "Select a chip pad to choose the connection",
            "チップのパッドを選んで接続先を決めましょう"
          )
        : complete
          ? l(
              "칩 패드와 바깥 리드가 와이어로 연결됐어요",
              "The wire now connects the chip pad and the outer lead",
              "チップのパッドと外側リードがワイヤでつながりました"
            )
          : running
            ? l(
                "선택한 패드에서 와이어 연결이 만들어져요",
                "A wire connection grows from the selected pad",
                "選択したパッドからワイヤ接続ができます"
              )
            : l(
                "캐필러리 준비 완료 · 본딩을 시작해보세요",
                "Capillary ready · start the bond sequence",
                "キャピラリー準備完了・ボンディングを始めましょう"
              );

  return (
    <svg
      className="gbh-scene"
      viewBox="0 0 480 360"
      role="group"
      aria-labelledby={`${id}-title ${id}-desc`}
      data-process={processId}
      data-stage={stage}
      data-running={running}
      data-progress={progress.toFixed(3)}
      data-selection={selection}
    >
      <title id={`${id}-title`}>
        {eds
          ? l(
              "다이 선택과 전기 검사 연결 체험",
              "Die selection and electrical-test connection",
              "ダイ選択と電気テスト接続の体験"
            )
          : l(
              "패드 선택과 와이어 본딩 체험",
              "Pad selection and wire-bonding concept",
              "パッド選択とワイヤボンディングの体験"
            )}
      </title>
      <desc id={`${id}-desc`}>
        {eds
          ? l(
              "웨이퍼 프로버는 접촉 위치를 만들고 테스터는 전기 신호를 주고받는 서로 다른 역할입니다. 선택한 한 다이의 학습용 신호만 나타내며 실제 측정값, 합격·불합격 또는 수율이 아닙니다.",
              "The wafer prober establishes contact; the tester sends and receives electrical signals. These are distinct roles. Only one selected die's teaching signal is shown, not measured data, a pass/fail result or yield.",
              "ウェーハプローバーは接触位置を作り、テスターは電気信号を送受信する別の役割です。選んだ一つのダイの学習用信号のみを示し、実測値・合否・歩留まりではありません。"
            )
          : l(
              "칩의 패드를 선택하면 바깥 리드와의 와이어 연결 위치가 달라집니다. 캐필러리는 연결 과정을 설명하는 그림이며 제조사 장비의 내부 구조, 실제 본딩 조건 또는 몰딩 공정을 재현하지 않습니다.",
              "Selecting a chip pad changes the illustrated wire connection to the outer lead. The capillary explains the connection concept, not manufacturer internals, real bonding conditions or molding.",
              "チップのパッドを選ぶと外側リードへのワイヤ接続位置が変わります。キャピラリーは接続の概念図で、メーカー装置の内部構造・実際の接合条件・モールド工程は再現しません。"
            )}
      </desc>
      <defs>
        <clipPath id={`${id}-signal`}>
          <rect x="323" y="196" width={120 * progress} height="62" />
        </clipPath>
      </defs>

      {eds ? (
        <>
          <g aria-hidden="true">
            <rect
              x="29"
              y="62"
              width="273"
              height="266"
              rx="22"
              fill="#15372d"
              stroke="#497d65"
              strokeWidth="1.5"
            />
            <path
              d="M45 301H286M74 317H258"
              stroke="#456d58"
              strokeWidth="4"
              strokeLinecap="round"
            />
            <text
              x="165"
              y="45"
              textAnchor="middle"
              fill="#bddac9"
              fontSize="14"
              fontWeight="600"
            >
              {l("웨이퍼", "Wafer", "ウェーハ")}
            </text>
            <g
              className="gbh-wafer"
              style={{
                transform: `translate(${stage >= 1 ? 0 : -24}px,${stage >= 1 ? 0 : -9}px)`,
                opacity: stage >= 1 ? 1 : 0.35,
              }}
            >
              <circle
                cx="165"
                cy="191"
                r="123"
                fill="#22554b"
                stroke="#9bcfbd"
                strokeWidth="2"
              />
              <path
                d="M146 311Q165 303 184 311"
                fill="#15372d"
                stroke="#9bcfbd"
                strokeWidth="1.5"
              />
              <path
                d="M74 122Q165 62 257 122"
                fill="none"
                stroke="#77ad99"
                opacity=".4"
              />
            </g>
            <rect
              x="320"
              y="65"
              width="138"
              height="101"
              rx="13"
              fill="#234735"
              stroke={stage >= 3 ? "#9ce3c7" : "#729d82"}
              strokeWidth="1.6"
            />
            <path
              d="M336 144H444M339 88H378m-39 9h57"
              stroke="#5d9677"
              strokeWidth="3"
              strokeLinecap="round"
            />
            <circle
              cx="439"
              cy="86"
              r="4"
              fill={stage >= 3 ? "#9ce3c7" : "#52725e"}
            />
            <text
              x="389"
              y="121"
              textAnchor="middle"
              fill="#c4e5d0"
              fontSize="14"
              fontWeight="600"
            >
              {l("테스터", "Tester", "テスター")}
            </text>
            <rect
              x="315"
              y="182"
              width="148"
              height="106"
              rx="11"
              fill="#0c2821"
              stroke="#426c55"
              strokeWidth="1.3"
            />
            <path
              d="M326 227H451M327 204V249"
              stroke="#355b48"
              strokeWidth="1"
            />
            <g clipPath={`url(#${id}-signal)`}>
              <polyline
                data-signal-trace="true"
                points={signalPoints}
                fill="none"
                stroke="#9be5ca"
                strokeWidth="2.4"
                strokeLinejoin="round"
              />
            </g>
            <text
              x="389"
              y="263"
              textAnchor="middle"
              fill="#b0cdbb"
              fontSize="11.5"
            >
              {l("가상 신호", "Illustrative signal", "仮想信号")}
            </text>
            <text
              x="389"
              y="279"
              textAnchor="middle"
              fill="#97bca5"
              fontSize="10.5"
            >
              {l(
                "합불·수율 표시 없음",
                "No pass/fail or yield",
                "合否・歩留まり表示なし"
              )}
            </text>
            <text
              x="389"
              y="311"
              textAnchor="middle"
              fill="#97bca5"
              fontSize="10.5"
            >
              {l(
                "테스터 ≠ 웨이퍼 프로버",
                "Tester ≠ wafer prober",
                "テスター ≠ ウェーハプローバー"
              )}
            </text>
            <text
              x="165"
              y="321"
              textAnchor="middle"
              fill="#a9c9b4"
              fontSize="11.5"
            >
              {l(
                "프로버 · 웨이퍼 접촉 위치",
                "Prober · wafer contact position",
                "プローバー・ウェーハ接触位置"
              )}
            </text>
          </g>
          {dies.map((item, index) => (
            <g
              key={index}
              className="gbh-picker"
              data-pick-index={index}
              data-selected={index === selection}
              data-enabled={canSelect}
              role="button"
              tabIndex={canSelect ? 0 : -1}
              aria-disabled={!canSelect}
              aria-pressed={index === selection}
              aria-label={l(
                `다이 ${index + 1} 선택`,
                `Select die ${index + 1}`,
                `ダイ${index + 1}を選択`
              )}
              onClick={() => select(index)}
              onKeyDown={event => keySelect(event, index)}
            >
              <rect
                className="gbh-focus"
                x={item.x - 2}
                y={item.y - 2}
                width="41"
                height="41"
                rx="6"
                fill="none"
                stroke="#ddffe7"
                strokeWidth="2.5"
              />
              <rect
                x={item.x}
                y={item.y}
                width="37"
                height="37"
                rx="4"
                fill={index === selection ? "#427562" : "#315c50"}
                stroke={index === selection ? "#edc780" : "#729e89"}
                strokeWidth={index === selection ? 2 : 0.8}
                opacity={stage >= 1 ? 1 : 0.32}
              />
              <path
                d={`M${item.x + 7} ${item.y + 12}h23m-23 7h23m-23 7h14`}
                stroke="#8bb19a"
                strokeWidth="1.4"
                opacity=".65"
                pointerEvents="none"
              />
              <text
                x={item.x + 18.5}
                y={item.y + 10}
                textAnchor="middle"
                fill={index === selection ? "#f4dba5" : "#a5c5b1"}
                fontSize="8"
                pointerEvents="none"
              >
                {String(index + 1).padStart(2, "0")}
              </text>
            </g>
          ))}
          {stage >= 2 ? (
            <g aria-hidden="true">
              <path
                className="gbh-signal-cable"
                d={`M${dieX} ${dieY - 24}V77H306V139H320`}
                fill="none"
                stroke="#9bdcc2"
                strokeWidth="3"
                strokeLinejoin="round"
              />
              <g
                className="gbh-probe-head"
                transform={`translate(${dieX} ${dieY})`}
              >
                <rect
                  x="-23"
                  y="-28"
                  width="46"
                  height="14"
                  rx="4"
                  fill="#3c6450"
                  stroke="#c1d7ba"
                  strokeWidth="1.1"
                />
                {[-13, -4, 5, 14].map(x => (
                  <path
                    key={x}
                    d={`M${x} -14v11`}
                    stroke="#efce85"
                    strokeWidth="2"
                  />
                ))}
                <rect
                  x="-21"
                  y="-21"
                  width="42"
                  height="42"
                  rx="7"
                  fill="none"
                  stroke="#efce85"
                  strokeWidth="1.5"
                  strokeDasharray="3 4"
                />
              </g>
            </g>
          ) : null}
          {showGuide && canSelect ? (
            <text
              x="165"
              y="92"
              textAnchor="middle"
              fill="#dcc897"
              fontSize="10.5"
            >
              {l("다이를 눌러 선택", "Select a die", "ダイを押して選択")}
            </text>
          ) : null}
        </>
      ) : (
        <>
          <g aria-hidden="true">
            <rect
              x="57"
              y="65"
              width="366"
              height="264"
              rx="19"
              fill="#15372b"
              stroke="#527f61"
              strokeWidth="1.5"
            />
            <path
              d="M70 80H411M71 314H411"
              stroke="#638b67"
              strokeWidth="2"
              opacity=".5"
            />
            <rect
              x="159"
              y="134"
              width="168"
              height="138"
              rx="8"
              fill="#2d5140"
              stroke="#729c76"
              strokeWidth="1.2"
            />
            <g
              className="gbh-chip"
              style={{
                opacity: stage >= 1 ? 1 : 0.3,
                transform: `translate(${stage >= 1 ? 0 : -22}px,${stage >= 1 ? 0 : -13}px)`,
              }}
            >
              <rect
                x="173"
                y="145"
                width="140"
                height="116"
                rx="5"
                fill="#284e43"
                stroke="#b1d4b6"
                strokeWidth="1.7"
              />
              <rect
                x="194"
                y="171"
                width="98"
                height="67"
                rx="2"
                fill="#1b3a31"
                stroke="#597c5d"
                strokeWidth="1"
              />
              {[0, 1, 2, 3].map(i => (
                <path
                  key={i}
                  d={`M${202 + i * 23} 179v50M202 ${182 + i * 15}h80`}
                  stroke="#527a5c"
                  strokeWidth="1"
                />
              ))}
              <text
                x="243"
                y="212"
                textAnchor="middle"
                fill="#aed1b4"
                fontSize="13"
                fontWeight="600"
              >
                {l("칩", "Chip", "チップ")}
              </text>
            </g>
            {pads.map((item, index) => (
              <g key={index} opacity={stage >= 1 ? 1 : 0.35}>
                <rect
                  x={item.leadX - 13}
                  y={item.leadY - 9}
                  width="26"
                  height="18"
                  rx="3"
                  fill={index === selection ? "#bf9e55" : "#746a46"}
                  stroke={index === selection ? "#f6d998" : "#b8a77b"}
                  strokeWidth="1"
                />
                {showGuide &&
                index === selection &&
                stage >= 1 &&
                progress === 0 ? (
                  <path
                    d={wire}
                    fill="none"
                    stroke="#c9b781"
                    strokeWidth="1.2"
                    strokeDasharray="4 5"
                    opacity=".6"
                  />
                ) : null}
              </g>
            ))}
            <text
              x="243"
              y="55"
              textAnchor="middle"
              fill="#bdd8bb"
              fontSize="13"
            >
              {l(
                "와이어 본딩 · 패드와 리드 연결",
                "Wire bonding · connect pad to lead",
                "ワイヤボンディング・パッドとリードの接続"
              )}
            </text>
            <text
              x="243"
              y="296"
              textAnchor="middle"
              fill="#9bb89d"
              fontSize="11.5"
            >
              {l("바깥 리드", "Outer leads", "外側リード")}
            </text>
          </g>
          {pads.map((item, index) => (
            <g
              key={index}
              className="gbh-picker gbh-pad"
              data-pick-index={index}
              data-selected={index === selection}
              data-enabled={canSelect}
              role="button"
              tabIndex={canSelect ? 0 : -1}
              aria-disabled={!canSelect}
              aria-pressed={index === selection}
              aria-label={l(
                `칩 패드 ${index + 1} 선택`,
                `Select chip pad ${index + 1}`,
                `チップのパッド${index + 1}を選択`
              )}
              onClick={() => select(index)}
              onKeyDown={event => keySelect(event, index)}
            >
              <rect
                x={item.x - 12}
                y={item.y - 12}
                width="24"
                height="24"
                rx="5"
                fill="transparent"
              />
              <rect
                className="gbh-focus"
                x={item.x - 12}
                y={item.y - 12}
                width="24"
                height="24"
                rx="5"
                fill="none"
                stroke="#ddffe7"
                strokeWidth="2"
              />
              <rect
                x={item.x - 6}
                y={item.y - 6}
                width="12"
                height="12"
                rx="1.5"
                fill={index === selection ? "#e8c57b" : "#aaa276"}
                stroke={index === selection ? "#ffe6ac" : "#d8cd9c"}
                strokeWidth="1"
                opacity={stage >= 1 ? 1 : 0.3}
              />
              {index === selection ? (
                <circle
                  cx={item.x}
                  cy={item.y}
                  r="10"
                  fill="none"
                  stroke="#f3d794"
                  strokeWidth="1.4"
                  opacity=".9"
                />
              ) : null}
            </g>
          ))}
          {stage >= 3 ? (
            <g aria-hidden="true">
              <path
                className="gbh-bond-wire"
                data-wire-progress={progress.toFixed(3)}
                d={wire}
                pathLength="1"
                fill="none"
                stroke="#f0cd80"
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray="1"
                strokeDashoffset={1 - progress}
                opacity={0.55 + level * 0.45}
              />
              {progress > 0 ? (
                <circle cx={pad.x} cy={pad.y} r="4.1" fill="#f1d593" />
              ) : null}
              {complete ? (
                <circle cx={pad.leadX} cy={pad.leadY} r="3.5" fill="#f1d593" />
              ) : null}
              <g
                className="gbh-capillary"
                style={
                  {
                    transform: `translate(${toolX}px,${toolY - (complete ? 35 : 0)}px)`,
                  } as CSSProperties
                }
              >
                <path
                  d="M-8-57H8L6-17 2-3H-2L-6-17Z"
                  fill="#b4c8b0"
                  stroke="#e5edce"
                  strokeWidth="1.1"
                />
                <path d="M0-57V-3" stroke="#f0cf82" strokeWidth="1.3" />
                <path d="M-5-49H5M-5-43H5" stroke="#5f8065" strokeWidth="1" />
              </g>
            </g>
          ) : null}
          {showGuide && canSelect ? (
            <text
              x="243"
              y="120"
              textAnchor="middle"
              fill="#dcc897"
              fontSize="11"
            >
              {l(
                "금색 패드를 눌러 선택",
                "Select a gold chip pad",
                "金色のパッドを押して選択"
              )}
            </text>
          ) : null}
        </>
      )}
      <text
        x="240"
        y="351"
        textAnchor="middle"
        fill="#c3d9c4"
        fontSize={language === "en" ? 10.5 : 11.5}
        fontWeight="500"
      >
        {status}
      </text>
    </svg>
  );
}
