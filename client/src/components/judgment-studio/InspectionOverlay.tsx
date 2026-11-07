import { useId, type ReactNode } from "react";
import type { ProcessId } from "@shared/processScenarios";
import type { ProcessSceneState } from "@shared/processScene";
import type { Language } from "./studio-types";

type Props = {
  process: ProcessId;
  language: Language;
  current: ProcessSceneState;
  reference: ProcessSceneState;
};
type Metric = {
  id: string;
  name: string;
  value: number | null;
  reference: number | null;
  currentPosition: number;
  referencePosition: number;
  difference: number;
};
const C = {
  text: "#edf0eb",
  muted: "#adbdaf",
  faint: "#73917f",
  line: "#486252",
  gold: "#efb769",
  mint: "#a6d9bf",
  panel: "#16231de8",
  ink: "#0e1915",
};
const clamp = (n: number, low = -2, high = 2) =>
  Number.isFinite(n) ? Math.max(low, Math.min(high, n)) : 0;
const number = (n: number | null) => (n === null ? "—" : n.toFixed(1));
const choose = (language: Language, ko: string, en: string, ja: string) =>
  language === "ko" ? ko : language === "en" ? en : ja;

/** A picture of the selected snapshot, not a manufactured image or time history.
 * The selected reference supplies both the reference value and its display band.
 * Geometry encodes relative indices only; no physical thickness or die verdict is inferred.
 */
export default function InspectionOverlay({
  process,
  language,
  current,
  reference,
}: Props) {
  const id = useId().replace(/:/g, "");
  const l = (ko: string, en: string, ja: string) =>
    choose(language, ko, en, ja);
  const metrics = current.channels.map(channel => {
    const ref = reference.channels.find(row => row.id === channel.id);
    const value = Number.isFinite(channel.value) ? channel.value : null;
    const referenceValue =
      ref && Number.isFinite(ref.reference) ? ref.reference : null;
    const goodBand =
      !!ref &&
      Number.isFinite(ref.low) &&
      Number.isFinite(ref.high) &&
      ref.high > ref.low;
    const centre = goodBand
      ? (ref!.low + ref!.high) / 2
      : (referenceValue ?? 0);
    const half = goodBand ? Math.max(0.0001, (ref!.high - ref!.low) / 2) : 1;
    const currentPosition = value === null ? 0 : clamp((value - centre) / half);
    const referencePosition =
      referenceValue === null ? 0 : clamp((referenceValue - centre) / half);
    return {
      id: channel.id,
      name: channel.name[language === "ko" ? 0 : language === "en" ? 1 : 2],
      value,
      reference: referenceValue,
      currentPosition,
      referencePosition,
      difference: clamp(currentPosition - referencePosition),
    } satisfies Metric;
  });
  const metric = (name: string) =>
    metrics.find(row => row.id === name) ?? {
      id: name,
      name: "—",
      value: null,
      reference: null,
      currentPosition: 0,
      referencePosition: 0,
      difference: 0,
    };
  const obs = l("관측", "Observed", "観測");
  const refLabel = l("참고", "Reference", "参照");
  const label = (
    text: string,
    x: number,
    y: number,
    size = 9,
    fill = C.muted,
    anchor: "start" | "middle" | "end" = "start",
    slotWidth?: number
  ) => (
    <text
      x={x}
      y={y}
      fill={fill}
      fontSize={size}
      textAnchor={anchor}
      data-slot-width={slotWidth}
    >
      {text}
    </text>
  );
  const marker = (x: number, y: number, isReference = false) =>
    isReference ? (
      <path
        d={`M${x},${y - 3.3}l3.3,3.3 -3.3,3.3 -3.3,-3.3z`}
        fill={C.ink}
        stroke={C.mint}
        strokeWidth={1.3}
      />
    ) : (
      <circle
        cx={x}
        cy={y}
        r={3.1}
        fill={C.gold}
        stroke={C.ink}
        strokeWidth={0.8}
      />
    );
  const compare = (m: Metric, x: number, y: number, width = 138) => (
    <g>
      <line
        x1={x}
        y1={y}
        x2={x + width}
        y2={y}
        stroke={C.line}
        strokeWidth={1}
      />
      <line
        x1={x + width * 0.25}
        y1={y}
        x2={x + width * 0.75}
        y2={y}
        stroke={C.mint}
        strokeWidth={5}
        opacity={0.13}
      />
      {marker(x + width * (0.5 + m.referencePosition * 0.23), y, true)}
      {marker(x + width * (0.5 + m.currentPosition * 0.23), y)}
    </g>
  );
  const values = (m: Metric, x: number, y: number, width = 150) => (
    <g>
      {label(m.name, x, y, 10, C.text, "start", width)}
      {label(
        `${l("관측", "Obs.", "観測")} ${number(m.value)}`,
        x,
        y + 15,
        10,
        C.gold,
        "start",
        width * 0.48
      )}
      {label(
        `${l("참고", "Ref.", "参照")} ${number(m.reference)}`,
        x + width,
        y + 15,
        10,
        C.mint,
        "end",
        width * 0.48
      )}
    </g>
  );
  const box = (x: number, y: number, w: number, h: number) => (
    <rect
      x={x}
      y={y}
      width={w}
      height={h}
      rx={5}
      fill={C.ink}
      fillOpacity={0.35}
      stroke={C.line}
      strokeWidth={0.7}
    />
  );
  const circleMap = (
    cx: number,
    cy: number,
    radius: number,
    m: Metric,
    isReference: boolean
  ) => (
    <g>
      <circle
        cx={cx}
        cy={cy}
        r={radius}
        fill={C.ink}
        stroke={isReference ? C.mint : C.gold}
        strokeWidth={1.1}
      />
      <path
        d={`M${cx - radius * 0.74} ${cy + radius * 0.65}q${radius * 0.74} ${radius * 0.32} ${radius * 1.48} 0`}
        fill="none"
        stroke={C.line}
      />
      {Array.from({ length: 25 }, (_, i) => {
        const col = (i % 5) - 2,
          row = Math.floor(i / 5) - 2;
        return col * col + row * row < 6 ? (
          <circle
            key={i}
            cx={cx + col * radius * 0.3}
            cy={cy + row * radius * 0.3}
            r={isReference ? 2.3 : clamp(2.3 + m.difference * 0.65, 1, 4)}
            fill={isReference ? C.mint : C.gold}
            opacity={0.66}
          />
        ) : null;
      })}
    </g>
  );
  const dial = (m: Metric, x: number, y: number, radius = 34) => {
    const point = (position: number) => {
      const a = ((-90 + position * 48) * Math.PI) / 180;
      return { x: x + Math.cos(a) * radius, y: y + Math.sin(a) * radius };
    };
    const cp = point(m.currentPosition),
      rp = point(m.referencePosition);
    return (
      <g>
        <circle cx={x} cy={y} r={radius} fill={C.ink} stroke={C.line} />
        <circle
          cx={x}
          cy={y}
          r={radius - 6}
          fill="none"
          stroke={C.line}
          strokeDasharray="1 6"
          opacity={0.65}
        />
        <path
          d={`M${x} ${y}L${rp.x} ${rp.y}`}
          stroke={C.mint}
          strokeWidth={1}
          strokeDasharray="3 3"
        />
        <path
          d={`M${x} ${y}L${cp.x} ${cp.y}`}
          stroke={C.gold}
          strokeWidth={1.6}
        />
        {marker(rp.x, rp.y, true)}
        {marker(cp.x, cp.y)}
        <circle cx={x} cy={y} r={2} fill={C.text} />
      </g>
    );
  };
  let drawing: ReactNode;
  let note = l(
    "지수를 도식화한 그림이에요.\n실제 장비 영상이 아니에요.",
    "Index schematic.\nNot an equipment image.",
    "指数の模式図です。\n実際の装置画像ではありません。"
  );

  switch (process) {
    case "wafer": {
      const surface = metric("surface"),
        thickness = metric("thickness");
      drawing = (
        <g>
          {label(
            l(
              "표면 지수의 지도 표현",
              "Surface-index map",
              "表面指数のマップ表示"
            ),
            17,
            54,
            10,
            C.text
          )}
          {circleMap(61, 103, 35, surface, false)}
          {circleMap(148, 103, 35, surface, true)}
          {label(obs, 61, 150, 8, C.gold, "middle")}
          {label(refLabel, 148, 150, 8, C.mint, "middle")}
          {box(203, 64, 139, 93)}
          {label(
            l("두께 지수 비교", "Thickness-index comparison", "厚さ指数の比較"),
            272,
            79,
            8.5,
            C.text,
            "middle"
          )}
          <path
            d="M215 102H330M215 116H330M224 96v26M321 96v26"
            stroke={C.faint}
            strokeWidth={1}
            fill="none"
          />
          {compare(thickness, 216, 137, 112)}
          {values(surface, 17, 174, 158)}
          {values(thickness, 203, 174, 139)}
        </g>
      );
      note = l(
        "점은 지수의 그림 표현이에요.\n실제 결함의 위치를 뜻하지 않아요.",
        "Dots encode an index.\nThey are not measured defect locations.",
        "点は指数の表現です。\n実際の欠陥位置ではありません。"
      );
      break;
    }
    case "oxidation": {
      const film = metric("film"),
        uniformity = metric("uniformity");
      drawing = (
        <g>
          {label(
            l(
              "선택한 조건의 참고와 비교",
              "Compare with the selected reference",
              "選択した条件の参照と比較"
            ),
            17,
            54,
            10,
            C.text
          )}
          {dial(film, 94, 106)}
          {dial(uniformity, 263, 106)}
          {label(
            l("막 검사", "Film inspection", "膜検査"),
            94,
            153,
            9,
            C.muted,
            "middle"
          )}
          {label(
            l("균일도 검사", "Uniformity inspection", "均一性検査"),
            263,
            153,
            9,
            C.muted,
            "middle"
          )}
          {values(film, 17, 174, 150)}
          {values(uniformity, 195, 174, 148)}
        </g>
      );
      note = l(
        "바늘은 검사 지수를 보여줘요.\n실제 산화막 두께를 뜻하지 않아요.",
        "Needles show inspection indices,\nnot physical oxide thickness.",
        "針は検査指数を示します。\n実際の酸化膜厚ではありません。"
      );
      break;
    }
    case "photo": {
      const position = metric("position"),
        shape = metric("shape"),
        shift = position.difference * 11,
        width = clamp(27 + shape.difference * 7, 13, 43);
      drawing = (
        <g>
          {label(
            l(
              "위치와 형상을 따로 보기",
              "View position and shape separately",
              "位置と形状を分けて見る"
            ),
            17,
            54,
            10,
            C.text
          )}
          {box(17, 64, 157, 94)}
          {box(191, 64, 152, 94)}
          <path
            d="M38 110H155M96 76V145"
            stroke={C.faint}
            strokeDasharray="3 3"
          />
          <path
            d="M77 91h38v38H77zM96 85V135M71 110h50"
            fill="none"
            stroke={C.mint}
            strokeWidth={1.2}
            strokeDasharray="3 2"
          />
          <path
            d={`M${77 + shift} 91h38v38h-38zM${96 + shift} 85V135M${71 + shift} 110h50`}
            fill={C.gold}
            fillOpacity={0.09}
            stroke={C.gold}
            strokeWidth={1.3}
          />
          {[0, 1, 2].map(i => (
            <g key={i}>
              <rect
                x={210 + i * 41}
                y={85}
                width={27}
                height={48}
                fill="none"
                stroke={C.mint}
                strokeDasharray="3 2"
              />
              <rect
                x={210 + i * 41 + (27 - width) / 2}
                y={85}
                width={width}
                height={48}
                fill={C.gold}
                fillOpacity={0.09}
                stroke={C.gold}
              />
            </g>
          ))}
          {values(position, 17, 174, 150)}
          {values(shape, 194, 174, 149)}
        </g>
      );
      note = l(
        "교차선과 폭은 지수의 그림 표현이에요.\n실측 길이나 실제 패턴 사진이 아니에요.",
        "Offsets and widths illustrate indices.\nThey are not measured lengths or pattern images.",
        "位置や幅は指数の表現です。\n実測した長さや実際のパターン画像ではありません。"
      );
      break;
    }
    case "etch": {
      const pressure = metric("pressure"),
        flow = metric("flow"),
        rf = metric("rf"),
        temperature = metric("temperature");
      const node = (
        m: Metric,
        x: number,
        y: number,
        side: "left" | "right"
      ) => (
        <g>
          {label(m.name, x, y, 10, C.text, "start", 102)}
          {label(
            `${obs} ${number(m.value)}`,
            x,
            y + 14,
            10,
            C.gold,
            "start",
            102
          )}
          {label(
            `${refLabel} ${number(m.reference)}`,
            x,
            y + 28,
            10,
            C.mint,
            "start",
            102
          )}
          {compare(m, x, y + 39, 102)}
          <path
            d={
              side === "left"
                ? `M${x + 107} ${y + 19}H143L157 111`
                : `M${x - 4} ${y + 19}H217L203 111`
            }
            fill="none"
            stroke={C.faint}
            strokeWidth={0.8}
          />
        </g>
      );
      drawing = (
        <g>
          {label(
            l(
              "한 시점의 4신호 비교",
              "Four-signal snapshot comparison",
              "同じ時点の4信号を比較"
            ),
            17,
            54,
            10,
            C.text
          )}
          <path
            d="M156 89q24-12 48 0v46q-24 12-48 0z"
            fill={C.ink}
            stroke={C.line}
          />
          <ellipse
            cx={180}
            cy={89}
            rx={24}
            ry={6}
            fill="none"
            stroke={C.line}
          />
          <path d="M162 112H198M166 120H194" stroke={C.mint} opacity={0.65} />
          {node(pressure, 17, 75, "left")}
          {node(flow, 239, 75, "right")}
          {node(rf, 17, 143, "left")}
          {node(temperature, 239, 143, "right")}
        </g>
      );
      note = l(
        "연결선은 각 신호의 역할을 보여줘요.\n과거의 측정 추세를 만든 그림이 아니에요.",
        "Lines identify the signals.\nThey are not historical measurements.",
        "接続線は各信号の役割を示します。\n過去の測定推移を表すものではありません。"
      );
      break;
    }
    case "deposition": {
      const film = metric("film"),
        electrical = metric("electrical");
      drawing = (
        <g>
          {label(
            l(
              "막 기록과 별도 전기 기록",
              "Film and separate electrical records",
              "膜と別の電気的記録"
            ),
            17,
            54,
            10,
            C.text
          )}
          {box(17, 64, 157, 94)}
          {box(191, 64, 152, 94)}
          <path
            d="M36 128V110H71V91H119V110H154V128Z"
            fill="#60775f66"
            stroke={C.faint}
          />
          <path
            d="M36 105H67V86H123V105H154"
            fill="none"
            stroke={C.mint}
            strokeWidth={4}
          />
          {compare(film, 35, 144, 122)}
          <path
            d="M210 91H245V124H316V91H280M245 104h-9v18h18v-18zM269 124v-13m-4 0h8m-8-4h8m-4-16v16"
            stroke={C.faint}
            strokeWidth={1.4}
            fill="none"
          />
          <circle cx={269} cy={91} r={8} fill={C.ink} stroke={C.mint} />
          {marker(269 + electrical.difference * 6, 91)}
          {values(film, 17, 174, 150)}
          {values(electrical, 194, 174, 149)}
        </g>
      );
      note = l(
        "막 모양은 고정된 원리도예요.\n막·전기 기록은 서로 다른 자료예요.",
        "The film shape is a fixed schematic.\nFilm and electrical records are separate evidence.",
        "膜形状は固定した原理図です。\n膜と電気的記録は、それぞれ別の資料です。"
      );
      break;
    }
    case "metal": {
      const connection = metric("connection"),
        appearance = metric("appearance");
      drawing = (
        <g>
          {label(
            l(
              "전기적 연결과 외관 구분",
              "Separate connection from appearance",
              "電気的接続と外観を区別"
            ),
            17,
            54,
            10,
            C.text
          )}
          {box(17, 64, 157, 94)}
          {box(191, 64, 152, 94)}
          <path
            d="M34 113H65V85H112V128H155M42 133H85V104H143"
            fill="none"
            stroke={C.gold}
            strokeWidth={3}
            strokeLinejoin="round"
          />
          {[34, 65, 112, 155].map((x, i) => (
            <circle
              key={x}
              cx={x}
              cy={[113, 85, 128, 128][i]}
              r={3.5}
              fill={C.ink}
              stroke={C.mint}
            />
          ))}
          {compare(connection, 34, 146, 123)}
          <rect
            x={214}
            y={81}
            width={104}
            height={58}
            rx={3}
            fill="none"
            stroke={C.mint}
            strokeDasharray="3 2"
          />
          <path
            d="M220 123H243V92H271V125H310"
            fill="none"
            stroke={C.faint}
            strokeWidth={3}
          />
          <path
            d="M211 99V78h23M299 78h22v21M211 122v21h23M299 143h22v-21"
            fill="none"
            stroke={C.gold}
            strokeWidth={1}
          />
          {marker(266 + appearance.difference * 6, 111)}
          {values(connection, 17, 174, 150)}
          {values(appearance, 194, 174, 149)}
        </g>
      );
      note = l(
        "배선 경로는 끊어진 것으로 표시하지 않아요.\n지수만으로 단선·고장을 확정하지 않아요.",
        "Paths remain intact in this illustration.\nAn index alone does not prove a broken connection.",
        "配線は切断した形で表示しません。\n指数だけで断線や故障を確定しません。"
      );
      break;
    }
    case "eds": {
      const die = metric("die"),
        comparison = metric("comparison");
      const shade = 0.18 + Math.abs(die.difference) * 0.16;
      drawing = (
        <g>
          {label(
            l(
              "현재 구역의 지수를 맵으로 보기",
              "Map the current region's index",
              "現在の領域の指数をマップで見る"
            ),
            17,
            54,
            10,
            C.text
          )}
          <circle cx={91} cy={109} r={47} fill={C.ink} stroke={C.line} />
          {Array.from({ length: 49 }, (_, i) => {
            const col = (i % 7) - 3,
              row = Math.floor(i / 7) - 3;
            if (col * col + row * row > 10) return null;
            const active = col === 0 || col === 1;
            return (
              <rect
                key={i}
                x={86 + col * 12}
                y={104 + row * 12}
                width={10}
                height={10}
                rx={1}
                fill={active ? C.gold : C.faint}
                fillOpacity={active ? shade : 0.14}
                stroke={active ? C.gold : C.line}
                strokeWidth={0.55}
              />
            );
          })}
          <path
            d="M84 64V155M108 64V155"
            stroke={C.mint}
            strokeDasharray="3 3"
            strokeWidth={0.8}
          />
          {box(186, 64, 157, 94)}
          {label(
            l("별도의 비교 기록", "Separate comparison record", "別の比較記録"),
            264,
            81,
            8.5,
            C.text,
            "middle"
          )}
          <path
            d="M201 98H328M201 115H328M201 132H328"
            stroke={C.line}
            strokeDasharray="2 3"
          />
          {compare(comparison, 204, 115, 121)}
          {values(die, 17, 174, 151)}
          {values(comparison, 186, 174, 157)}
        </g>
      );
      note = l(
        "구역 색은 지수의 그림 표현이에요.\n개별 칩의 합격·불합격을 뜻하지 않아요.",
        "Cell colors encode an index.\nThey are not verdicts for individual dies.",
        "区画の色は指数の表現です。\n個別チップの良否判定ではありません。"
      );
      break;
    }
    case "packaging": {
      const connection = metric("connection"),
        appearance = metric("appearance");
      drawing = (
        <g>
          {label(
            l(
              "연결 기록과 외관 기록 비교",
              "Compare connection and appearance",
              "接続記録と外観記録を比較"
            ),
            17,
            54,
            10,
            C.text
          )}
          {box(17, 64, 157, 94)}
          {box(191, 64, 152, 94)}
          <path
            d="M34 132H157M53 118V95H125V118Z"
            fill="#455b4d66"
            stroke={C.faint}
          />
          {[0, 1, 2].map(i => (
            <path
              key={i}
              d={`M${61 + i * 25} 96Q${51 + i * 29} ${69 + i * 3} ${36 + i * 56} 132`}
              fill="none"
              stroke={C.gold}
              strokeWidth={1.3}
            />
          ))}
          {compare(connection, 35, 146, 121)}
          <rect
            x={217}
            y={84}
            width={101}
            height={55}
            rx={9}
            fill={C.ink}
            stroke={C.mint}
          />
          <rect
            x={242}
            y={98}
            width={51}
            height={27}
            rx={2}
            fill="#53674c55"
            stroke={C.line}
          />
          {[0, 1, 2, 3, 4].map(i => (
            <g key={i}>
              <path
                d={`M${231 + i * 18} 76v8M${231 + i * 18} 139v9`}
                stroke={C.faint}
                strokeWidth={2}
              />
            </g>
          ))}
          {marker(266 + appearance.difference * 6, 111)}
          {values(connection, 17, 174, 150)}
          {values(appearance, 194, 174, 149)}
        </g>
      );
      note = l(
        "와이어 모양은 연결을 설명하는 그림이에요.\n파손이나 연결 불량을 확정하지 않아요.",
        "The wires illustrate connections.\nThis does not establish damage or connection failure.",
        "ワイヤーの形は接続を説明する図です。\n破損や接続不良を確定するものではありません。"
      );
      break;
    }
  }
  const title = l(
    "가상 검사 지수의 그림 표현",
    "Illustration of synthetic inspection indices",
    "仮想検査指数の図示"
  );
  const description = l(
    "선택한 시점의 관측값과 선택한 참고값을 비교하는 교육용 도식입니다. 실제 장비 이미지나 물리적 측정값은 아닙니다.",
    "An educational schematic comparing the selected observation and reference. It is not an equipment image or a physical measurement.",
    "選択した時点の観測値と参照値を比較する教育用の模式図です。実際の装置画像や物理的な測定値ではありません。"
  );
  return (
    <svg
      className="studio-inspection-overlay"
      viewBox="0 0 360 242"
      width="360"
      height="242"
      role="img"
      aria-labelledby={`${id}-title ${id}-desc`}
      style={{
        display: "block",
        width: "100%",
        height: "auto",
        fontFamily:
          'Inter,"Noto Sans KR","Noto Sans JP","Malgun Gothic",sans-serif',
      }}
      data-process={process}
      data-time={current.time}
    >
      <title id={`${id}-title`}>{title}</title>
      <desc id={`${id}-desc`}>{description}</desc>
      <rect
        x={0.5}
        y={0.5}
        width={359}
        height={241}
        rx={9}
        fill={C.panel}
        stroke={C.line}
      />
      {label(title, 12, 17, 9.5, C.text)}
      {label(
        process === "eds"
          ? l(
              `재생 ${current.time}`,
              `Replay ${current.time}`,
              `再生 ${current.time}`
            )
          : l(`${current.time}초`, `${current.time}s`, `${current.time}秒`),
        348,
        33,
        8,
        C.muted,
        "end"
      )}
      <circle cx={16} cy={32} r={2.5} fill={C.gold} />
      {label(obs, 24, 35, 8, C.gold)}
      <path d="M95 29l3 3 -3 3 -3-3z" fill={C.ink} stroke={C.mint} />
      {label(refLabel, 104, 35, 8, C.mint)}
      {drawing}
      <line
        x1={12}
        y1={198}
        x2={348}
        y2={198}
        stroke={C.line}
        strokeWidth={0.6}
      />
      <text fill={C.muted} fontSize={10.5} data-slot-width={336}>
        {note.split("\n").map((line, index) => (
          <tspan key={index} x={12} y={215 + index * 15}>
            {line}
          </tspan>
        ))}
      </text>
    </svg>
  );
}
