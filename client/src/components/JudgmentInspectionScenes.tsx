import React, { useId } from "react";
import { tr } from "../lib/productLanguage";
import { motionChannel, type MotionSceneProps } from "./process-motion-types";
import "./judgment-inspection-scenes.css";

const mint = "#8bdfcb",
  gold = "#e9bf79",
  ink = "#b8d4c5",
  muted = "#527d6a";
const clamp = (value: number, low: number, high: number) =>
  Number.isFinite(value) ? Math.max(low, Math.min(high, value)) : low;
const clock = (time: number) =>
  `${Math.floor(time / 60)
    .toString()
    .padStart(2, "0")}:${(time % 60).toString().padStart(2, "0")}`;
const surfaceCount = (value: number) =>
  Math.round(clamp(12 + (value - 100) * 1.55, 4, 43));
const surfaceAmplitude = (value: number) =>
  clamp(4 + Math.abs(value - 100) * 1.55, 3, 40);
const thicknessHeight = (value: number) =>
  clamp(26 + (value - 100) * 1.25, 10, 54);
const filmHeight = (value: number) => clamp(15 + (value - 60) * 1.15, 12, 70);
const traceAmplitude = (value: number) =>
  clamp(11 + (value - 100) * 1.6, 4, 43);

function signalControl(
  id: string,
  selected: boolean,
  label: string,
  onSelect?: (id: string) => void
) {
  return onSelect
    ? {
        role: "button" as const,
        tabIndex: 0,
        "aria-label": label,
        "aria-pressed": selected,
        onClick: () => onSelect(id),
        onKeyDown: (event: React.KeyboardEvent<SVGElement>) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onSelect(id);
          }
        },
      }
    : {};
}
function Reading({
  x,
  y,
  width,
  label,
  value,
  selected,
  accent,
  signal,
  onSelect,
}: {
  x: number;
  y: number;
  width: number;
  label: string;
  value: number;
  selected: boolean;
  accent: string;
  signal: string;
  onSelect?: (id: string) => void;
}) {
  return (
    <g
      className="ji-reading"
      transform={`translate(${x} ${y})`}
      data-reading={signal}
      data-signal={signal}
      data-value={value.toFixed(1)}
      {...signalControl(
        signal,
        selected,
        `${label} · ${value.toFixed(1)}`,
        onSelect
      )}
    >
      <rect
        width={width}
        height="43"
        rx="8"
        fill="#10291f"
        stroke={selected ? accent : muted}
        strokeWidth={selected ? 2 : 1}
      />
      <text x="10" y="15" fill={ink} fontSize="11">
        {label}
      </text>
      <text
        x={width - 10}
        y="34"
        textAnchor="end"
        fill={accent}
        fontSize="21"
        fontWeight="650"
      >
        {value.toFixed(1)}
      </text>
    </g>
  );
}

function waveform(
  x: number,
  y: number,
  width: number,
  amplitude: number,
  phase = 0
) {
  return Array.from({ length: 37 }, (_, index) => {
    const wave =
      Math.sin(index * 0.68 + phase) * 0.68 +
      Math.sin(index * 1.43 + phase) * 0.2;
    return `${index === 0 ? "M" : "L"}${(x + (index * width) / 36).toFixed(2)} ${(y - wave * amplitude).toFixed(2)}`;
  }).join(" ");
}

/** Large inspection glyphs encode existing indices; they are not measured wafer geometry. */
function WaferJudgmentScene({
  scene,
  language,
  running,
  variant,
  selectedSignal,
  showReference,
  onSignalChange,
}: MotionSceneProps) {
  const id = `ji-wafer-${useId().replace(/:/g, "")}`;
  const l = (ko: string, en: string, ja: string) => tr(language, ko, en, ja);
  const surface = motionChannel(scene, "surface", variant),
    thickness = motionChannel(scene, "thickness", variant);
  const accent = variant === "reference" ? gold : mint,
    ghost = variant === "current" && showReference;
  const onSelect = variant === "current" ? onSignalChange : undefined;
  const count = surfaceCount(surface.value),
    amplitude = surfaceAmplitude(surface.value),
    band = thicknessHeight(thickness.value);
  const pattern = (value: number, outline = false) =>
    Array.from({ length: surfaceCount(value) }, (_, index) => {
      const column = index % 8,
        row = Math.floor(index / 8),
        r = 2.1 + clamp((value - 100) / 12, 0, 1.7);
      return (
        <g
          key={index}
          opacity={outline ? 0.55 : 0.32 + clamp((value - 100) / 26, 0, 0.6)}
        >
          <circle
            cx={60 + column * 28 + (row % 2) * 7}
            cy={116 + row * 22}
            r={r}
            fill={outline ? "none" : accent}
            stroke={outline ? gold : "none"}
            strokeWidth={outline ? 1 : undefined}
          />
          {index % 4 === 1 && !outline ? (
            <path
              d={`M${56 + column * 28 + (row % 2) * 7} ${110 + row * 22}l6 8 5-3`}
              stroke={accent}
              strokeWidth="1.4"
              fill="none"
            />
          ) : null}
        </g>
      );
    });
  return (
    <svg
      className="ji-scene ji-wafer"
      viewBox="0 0 480 330"
      role={onSelect ? "group" : "img"}
      aria-labelledby={`${id}-title ${id}-desc`}
      data-running={running}
      data-variant={variant}
      data-time={scene.time}
      data-surface-pattern-count={count}
      data-surface-amplitude={amplitude.toFixed(2)}
      data-thickness-height={band.toFixed(2)}
    >
      <title id={`${id}-title`}>
        {l(
          "A3 표면 검사와 별도 두께 기록 비교",
          "A3 surface inspection and separate thickness records",
          "A3表面検査と別の厚さ記録を比較"
        )}
      </title>
      <desc id={`${id}-desc`}>
        {l(
          "큰 검사 기호와 곡선은 기존 표면 지수의 비교 표현입니다. 기호 수는 결함 개수나 수율이 아니며, 아래 두께 띠도 실제 두께가 아닙니다.",
          "Large inspection symbols and curves encode the existing surface index. Symbol count is not a defect count or yield; the thickness band is not a physical measurement.",
          "大きな検査記号と曲線は既存の表面指数の比較表現です。記号数は欠陥数や歩留まりではなく、下の厚さ帯も実測厚さではありません。"
        )}
      </desc>
      <defs>
        <clipPath id={`${id}-wafer`}>
          <ellipse cx="163" cy="152" rx="141" ry="76" />
        </clipPath>
        <clipPath id={`${id}-surface`}>
          <rect x="320" y="92" width="134" height="106" rx="8" />
        </clipPath>
      </defs>
      <path d="M43 216V61h242v155" fill="none" stroke={muted} strokeWidth="9" />
      <path d="M49 61h230" stroke="#9fc7ae" strokeWidth="1.4" opacity=".6" />
      <rect
        x="139"
        y="46"
        width="49"
        height="30"
        rx="7"
        fill="#2a5340"
        stroke={ink}
        strokeWidth="1.5"
      />
      <ellipse cx="163" cy="79" rx="17" ry="4" fill={accent} opacity=".7" />
      <path
        className="ji-scan-glow"
        d="M151 84L112 159H214L175 84Z"
        fill={accent}
        opacity=".1"
      />
      <ellipse
        cx="163"
        cy="162"
        rx="145"
        ry="77"
        fill="#244c3b"
        stroke={muted}
        strokeWidth="1.5"
      />
      <ellipse
        cx="163"
        cy="152"
        rx="141"
        ry="76"
        fill="#356650"
        stroke={ink}
        strokeWidth="1.5"
      />
      <g clipPath={`url(#${id}-wafer)`}>
        <path
          d="M25 152H301M163 75V229"
          stroke="#bbd6c5"
          strokeDasharray="3 7"
          opacity=".18"
        />
        {ghost ? pattern(surface.reference, true) : null}
        {pattern(surface.value)}
        <rect
          className="ji-scan-line"
          x={52 + (scene.time % 30) * 7}
          y="76"
          width="5"
          height="153"
          fill={accent}
          opacity=".18"
        />
        <rect
          x="113"
          y="125"
          width="68"
          height="49"
          rx="8"
          fill="#103527"
          fillOpacity=".55"
          stroke={accent}
          strokeWidth={selectedSignal === "surface" ? 2.5 : 1.3}
        />
        <path
          d={waveform(122, 151, 50, amplitude * 0.5)}
          fill="none"
          stroke={accent}
          strokeWidth="2"
        />
      </g>
      <path
        d="M181 127L312 95M181 174L312 198"
        stroke={accent}
        strokeDasharray="3 5"
        opacity=".4"
      />
      <rect
        x="309"
        y="75"
        width="153"
        height="139"
        rx="12"
        fill="#102c20"
        stroke={selectedSignal === "surface" ? accent : muted}
        strokeWidth={selectedSignal === "surface" ? 2 : 1}
      />
      <text x="385" y="67" textAnchor="middle" fill={ink} fontSize="12">
        {l("A3 검사 확대", "A3 inspection detail", "A3検査の拡大")}
      </text>
      <g
        clipPath={`url(#${id}-surface)`}
        className="ji-target"
        data-signal="surface"
        {...signalControl(
          "surface",
          selectedSignal === "surface",
          l(
            "A3 표면 검사 선택",
            "Select A3 surface inspection",
            "A3表面検査を選択"
          ),
          onSelect
        )}
      >
        {[112, 145, 178].map(y => (
          <path key={y} d={`M318 ${y}H456`} stroke={muted} opacity=".3" />
        ))}
        {ghost ? (
          <path
            data-surface-reference="true"
            d={waveform(320, 145, 134, surfaceAmplitude(surface.reference))}
            fill="none"
            stroke={gold}
            strokeDasharray="4 4"
            strokeWidth="2"
            opacity=".75"
          />
        ) : null}
        <path
          data-surface-trace="true"
          d={waveform(320, 145, 134, amplitude)}
          fill="none"
          stroke={accent}
          strokeWidth="3"
        />
      </g>
      <Reading
        x={29}
        y={184}
        width={170}
        signal="surface"
        label={l("표면 편차 지수", "Surface deviation", "表面偏差指数")}
        value={surface.value}
        selected={selectedSignal === "surface"}
        accent={accent}
        onSelect={onSelect}
      />
      <rect
        x="24"
        y="244"
        width="438"
        height="71"
        rx="11"
        fill="#143423"
        stroke={selectedSignal === "thickness" ? accent : muted}
        strokeWidth={selectedSignal === "thickness" ? 2 : 1}
      />
      <text x="152" y="258" textAnchor="middle" fill={ink} fontSize="11">
        {l(
          "별도 두께 기록 · 지수 비교 띠",
          "Separate thickness-index band",
          "別の厚さ記録・指数比較帯"
        )}
      </text>
      <rect
        data-thickness-band="true"
        x="42"
        y={296 - band}
        width="220"
        height={band}
        fill={accent}
        opacity=".4"
        stroke={accent}
      />
      {ghost ? (
        <rect
          data-thickness-reference="true"
          x="42"
          y={296 - thicknessHeight(thickness.reference)}
          width="220"
          height={thicknessHeight(thickness.reference)}
          fill="none"
          stroke={gold}
          strokeDasharray="4 4"
          strokeWidth="1.7"
        />
      ) : null}
      <Reading
        x={285}
        y={260}
        width={165}
        signal="thickness"
        label={l("두께 검사 지수", "Thickness index", "厚さ検査指数")}
        value={thickness.value}
        selected={selectedSignal === "thickness"}
        accent={accent}
        onSelect={onSelect}
      />
      <text x="385" y="232" textAnchor="middle" fill="#92b49a" fontSize="10">
        {l(
          "검사 기호 · 지수 비교",
          "Symbols compare inspection indices",
          "検査記号・指数の比較"
        )}
      </text>
    </svg>
  );
}

function OxidationJudgmentScene({
  scene,
  language,
  running,
  variant,
  selectedSignal,
  showReference,
  onSignalChange,
}: MotionSceneProps) {
  const id = `ji-oxide-${useId().replace(/:/g, "")}`;
  const l = (ko: string, en: string, ja: string) => tr(language, ko, en, ja);
  const film = motionChannel(scene, "film", variant),
    uniformity = motionChannel(scene, "uniformity", variant);
  const accent = variant === "reference" ? gold : mint,
    ghost = variant === "current" && showReference;
  const onSelect = variant === "current" ? onSignalChange : undefined;
  const group = scene.time < 30 ? "A" : "B",
    filmBand = filmHeight(film.value),
    uniformityBand = filmHeight(uniformity.value);
  const profile = (value: number) =>
    `M259 ${287 - filmHeight(value)}Q304 ${283 - filmHeight(value)} 348 ${287 - filmHeight(value)}T438 ${287 - filmHeight(value)}V289H259Z`;
  return (
    <svg
      className="ji-scene ji-oxidation"
      viewBox="0 0 480 330"
      role={onSelect ? "group" : "img"}
      aria-labelledby={`${id}-title ${id}-desc`}
      data-running={running}
      data-variant={variant}
      data-time={scene.time}
      data-group={group}
      data-film-height={filmBand.toFixed(2)}
      data-uniformity-height={uniformityBand.toFixed(2)}
    >
      <title id={`${id}-title`}>
        {l(
          "검사 묶음에 맞춰 막과 균일도 기록 비교",
          "Compare film and uniformity with matching group references",
          "検査グループに合う膜と均一性記録を比較"
        )}
      </title>
      <desc id={`${id}-desc`}>
        {l(
          "두 비교 도형의 높이는 기존 검사지수를 나타냅니다. 검사 묶음이 바뀌면 참고값도 함께 바뀌며, 실제 막 두께나 열처리 조건을 계산하지 않습니다.",
          "The two comparison shapes encode existing inspection indices. References change with the inspection group; no physical film thickness or thermal conditions are calculated.",
          "二つの比較図の高さは既存の検査指数です。検査グループと共に参考値も変わり、実際の膜厚や熱処理条件は計算しません。"
        )}
      </desc>
      <rect
        x="20"
        y="15"
        width="145"
        height="31"
        rx="8"
        fill="#254834"
        stroke={muted}
      />
      <text
        x="92"
        y="35"
        textAnchor="middle"
        fill={ink}
        fontSize="13"
        fontWeight="600"
      >
        {l(
          `검사 묶음 ${group}`,
          `Inspection group ${group}`,
          `検査グループ ${group}`
        )}
      </text>
      <text x="457" y="35" textAnchor="end" fill="#a7c7ae" fontSize="12">
        {clock(scene.time)}
      </text>
      <rect
        x="35"
        y="64"
        width="113"
        height="78"
        rx="14"
        fill="#264d37"
        stroke="#9fc2a8"
        strokeWidth="1.6"
      />
      <rect
        x="47"
        y="76"
        width="89"
        height="55"
        rx="8"
        fill="#123326"
        stroke={muted}
      />
      {[86, 99, 112, 125].map(y => (
        <ellipse
          key={y}
          cx="92"
          cy={y}
          rx="32"
          ry="4"
          fill="#487b5e"
          stroke={ink}
          strokeWidth="1"
        />
      ))}
      <path
        d="M28 76v55m127-55v55"
        stroke={gold}
        strokeWidth="4"
        opacity=".55"
      />
      <text x="92" y="159" textAnchor="middle" fill="#9fbea6" fontSize="11">
        {l("열처리 공정 맥락", "Thermal-process context", "熱処理工程の背景")}
      </text>
      <path
        d="M169 104H209m-8-7 8 7-8 7"
        stroke={muted}
        strokeWidth="2"
        fill="none"
      />
      <Reading
        x={236}
        y={65}
        width={222}
        signal="film"
        label={l("막 검사 지수", "Film inspection index", "膜検査指数")}
        value={film.value}
        selected={selectedSignal === "film"}
        accent={accent}
        onSelect={onSelect}
      />
      <Reading
        x={236}
        y={115}
        width={222}
        signal="uniformity"
        label={l("균일도 검사 지수", "Uniformity index", "均一性検査指数")}
        value={uniformity.value}
        selected={selectedSignal === "uniformity"}
        accent={accent}
        onSelect={onSelect}
      />
      <rect
        x="20"
        y="178"
        width="205"
        height="125"
        rx="12"
        fill="#133224"
        stroke={selectedSignal === "film" ? accent : muted}
        strokeWidth={selectedSignal === "film" ? 2.2 : 1}
      />
      <rect
        x="245"
        y="178"
        width="213"
        height="125"
        rx="12"
        fill="#133224"
        stroke={selectedSignal === "uniformity" ? accent : muted}
        strokeWidth={selectedSignal === "uniformity" ? 2.2 : 1}
      />
      <text x="122" y="198" textAnchor="middle" fill={ink} fontSize="11">
        {l(
          "막 기록의 높이 비교",
          "Film-index comparison",
          "膜記録の高さを比較"
        )}
      </text>
      <text x="351" y="198" textAnchor="middle" fill={ink} fontSize="11">
        {l(
          "별도 균일도 기록 비교",
          "Separate uniformity record",
          "別の均一性記録を比較"
        )}
      </text>
      <path d="M34 288H211M259 288H444" stroke="#72997e" strokeWidth="4" />
      <rect
        className="ji-target"
        data-signal="film"
        {...signalControl(
          "film",
          selectedSignal === "film",
          l("막 검사 선택", "Select film inspection", "膜検査を選択"),
          onSelect
        )}
        data-film-band="true"
        x="36"
        y={287 - filmBand}
        width="174"
        height={filmBand}
        fill={accent}
        opacity=".5"
        stroke={accent}
        strokeWidth="1.5"
      />
      {ghost ? (
        <rect
          data-film-reference="true"
          x="36"
          y={287 - filmHeight(film.reference)}
          width="174"
          height={filmHeight(film.reference)}
          fill="none"
          stroke={gold}
          strokeDasharray="5 4"
          strokeWidth="2"
        />
      ) : null}
      <path
        className="ji-target"
        data-signal="uniformity"
        {...signalControl(
          "uniformity",
          selectedSignal === "uniformity",
          l(
            "균일도 검사 선택",
            "Select uniformity inspection",
            "均一性検査を選択"
          ),
          onSelect
        )}
        data-uniformity-band="true"
        d={profile(uniformity.value)}
        fill={accent}
        fillOpacity=".38"
        stroke={accent}
        strokeWidth="2"
      />
      {ghost ? (
        <path
          data-uniformity-reference="true"
          d={profile(uniformity.reference)}
          fill="none"
          stroke={gold}
          strokeDasharray="5 4"
          strokeWidth="2"
        />
      ) : null}
      <text x="240" y="323" textAnchor="middle" fill="#9cbaa2" fontSize="11">
        {l(
          "같은 검사 묶음의 참고와 함께 비교",
          "Compare with the matching inspection-group reference",
          "同じ検査グループの参考値と比較"
        )}
      </text>
    </svg>
  );
}

function EdsJudgmentScene({
  scene,
  language,
  running,
  variant,
  selectedSignal,
  showReference,
  onSignalChange,
}: MotionSceneProps) {
  const id = `ji-eds-${useId().replace(/:/g, "")}`;
  const l = (ko: string, en: string, ja: string) => tr(language, ko, en, ja);
  const die = motionChannel(scene, "die", variant),
    comparison = motionChannel(scene, "comparison", variant);
  const accent = variant === "reference" ? gold : mint,
    ghost = variant === "current" && showReference;
  const onSelect = variant === "current" ? onSignalChange : undefined;
  const regionIndex = Math.min(2, Math.floor(scene.time / 30)),
    region = ["A", "B", "C"][regionIndex],
    phase = scene.time * 0.025;
  const amplitude = traceAmplitude(die.value),
    compareAmplitude = traceAmplitude(comparison.value);
  const activeX = [75, 151, 227][regionIndex];
  return (
    <svg
      className="ji-scene ji-eds"
      viewBox="0 0 480 330"
      role={onSelect ? "group" : "img"}
      aria-labelledby={`${id}-title ${id}-desc`}
      data-running={running}
      data-variant={variant}
      data-time={scene.time}
      data-region={region}
      data-die-amplitude={amplitude.toFixed(2)}
      data-comparison-amplitude={compareAmplitude.toFixed(2)}
    >
      <title id={`${id}-title`}>
        {l(
          "웨이퍼 검사 구역과 두 검사 기록 비교",
          "Wafer inspection regions and two inspection records",
          "ウェーハ検査領域と二つの検査記録を比較"
        )}
      </title>
      <desc id={`${id}-desc`}>
        {l(
          "검사 구역은 기록을 펼치는 순서이며 실제 제조 시간이 아닙니다. 곡선 크기는 기존 검사지수의 비교 표현으로 합불·수율·장비 고장을 뜻하지 않습니다.",
          "Regions unfold inspection records, not manufacturing time. Curve size encodes existing inspection indices, not pass/fail, yield or equipment faults.",
          "検査領域は記録を表示する順序であり実際の製造時間ではありません。曲線の大きさは既存検査指数の比較表現で、合否・歩留まり・装置故障を意味しません。"
        )}
      </desc>
      <defs>
        <clipPath id={`${id}-wafer`}>
          <ellipse cx="171" cy="166" rx="147" ry="88" />
        </clipPath>
        <clipPath id={`${id}-signal`}>
          <rect x="334" y="81" width="112" height="149" rx="4" />
        </clipPath>
      </defs>
      <text x="23" y="24" fill={ink} fontSize="13" fontWeight="600">
        {l(
          `현재 검사 기록 · 구역 ${region}`,
          `Current inspection record · region ${region}`,
          `現在の検査記録・領域 ${region}`
        )}
      </text>
      <path d="M49 233V59H290V233" fill="none" stroke={muted} strokeWidth="9" />
      <rect
        x="139"
        y="44"
        width="66"
        height="35"
        rx="8"
        fill="#2a533d"
        stroke={ink}
      />
      <path
        d={`M150 78L${activeX + 30} 146m22-68L${activeX + 38} 146m-9-68L${activeX + 46} 146`}
        stroke={gold}
        strokeWidth="1.3"
      />
      <ellipse
        cx="171"
        cy="177"
        rx="149"
        ry="89"
        fill="#244b39"
        stroke={muted}
      />
      <ellipse
        cx="171"
        cy="166"
        rx="147"
        ry="88"
        fill="#365d4c"
        stroke={ink}
        strokeWidth="1.6"
      />
      <g clipPath={`url(#${id}-wafer)`}>
        {Array.from({ length: 5 }, (_, row) =>
          Array.from({ length: 9 }, (_, column) => (
            <rect
              key={`${row}-${column}`}
              x={38 + column * 30}
              y={99 + row * 29}
              width="25"
              height="23"
              rx="2"
              fill="#335647"
              stroke="#8eb49a"
              strokeWidth=".7"
              opacity=".65"
            />
          ))
        )}
        <rect
          x={activeX - 19}
          y="79"
          width="76"
          height="175"
          fill={accent}
          fillOpacity=".14"
          stroke={accent}
          strokeWidth="2"
        />
        <path
          d={waveform(activeX - 12, 173, 62, amplitude * 0.7, phase)}
          fill="none"
          stroke={accent}
          strokeWidth={selectedSignal === "die" ? 3 : 2}
        />
        {ghost ? (
          <path
            data-region-reference="true"
            d={waveform(
              activeX - 12,
              173,
              62,
              traceAmplitude(die.reference) * 0.7,
              phase
            )}
            fill="none"
            stroke={gold}
            strokeDasharray="4 3"
            strokeWidth="1.7"
          />
        ) : null}
        <path
          className="ji-scan-line"
          d={`M${activeX - 16} 100H${activeX + 54}`}
          stroke={accent}
          strokeWidth="4"
          opacity=".35"
        />
      </g>
      <path
        d="M290 95C325 91 307 54 330 67"
        fill="none"
        stroke={muted}
        strokeWidth="5"
      />
      <rect
        x="325"
        y="57"
        width="132"
        height="190"
        rx="12"
        fill="#163b28"
        stroke={ink}
        strokeWidth="1.5"
      />
      <rect
        x="333"
        y="80"
        width="115"
        height="151"
        rx="5"
        fill="#0d2b1e"
        stroke={muted}
      />
      <text x="391" y="73" textAnchor="middle" fill={ink} fontSize="11">
        {l("검사 기록 비교", "Inspection records", "検査記録の比較")}
      </text>
      <g clipPath={`url(#${id}-signal)`}>
        {[106, 143, 180, 216].map(y => (
          <path key={y} d={`M335 ${y}H446`} stroke={muted} opacity=".35" />
        ))}
        {ghost ? (
          <path
            data-die-reference="true"
            d={waveform(335, 128, 110, traceAmplitude(die.reference), phase)}
            fill="none"
            stroke={gold}
            strokeDasharray="4 3"
            strokeWidth="1.8"
          />
        ) : null}
        <path
          className="ji-target"
          data-die-trace="true"
          d={waveform(335, 128, 110, amplitude, phase)}
          fill="none"
          stroke={accent}
          strokeWidth={selectedSignal === "die" ? 3 : 2}
        />
        <rect
          className="ji-target"
          data-signal="die"
          x="333"
          y="82"
          width="115"
          height="86"
          fill="transparent"
          {...signalControl(
            "die",
            selectedSignal === "die",
            l("칩 검사 선택", "Select die inspection", "チップ検査を選択"),
            onSelect
          )}
        />{" "}
        {ghost ? (
          <path
            data-comparison-reference="true"
            d={waveform(
              335,
              199,
              110,
              traceAmplitude(comparison.reference),
              phase
            )}
            fill="none"
            stroke={gold}
            strokeDasharray="4 3"
            strokeWidth="1.8"
          />
        ) : null}
        <path
          className="ji-target"
          data-comparison-trace="true"
          d={waveform(335, 199, 110, compareAmplitude, phase)}
          fill="none"
          stroke={accent}
          strokeWidth={selectedSignal === "comparison" ? 3 : 2}
        />
        <rect
          className="ji-target"
          data-signal="comparison"
          x="333"
          y="170"
          width="115"
          height="61"
          fill="transparent"
          {...signalControl(
            "comparison",
            selectedSignal === "comparison",
            l("비교 기록 선택", "Select comparison record", "比較記録を選択"),
            onSelect
          )}
        />{" "}
      </g>
      <text x="391" y="160" textAnchor="middle" fill="#91b99b" fontSize="10">
        {l(
          "칩 검사 / 별도 비교",
          "Die / separate comparison",
          "チップ検査／別の比較"
        )}
      </text>
      <text x="171" y="263" textAnchor="middle" fill="#98baa0" fontSize="10">
        {l(
          "구역 강조는 기록 위치 · 합불 맵 아님",
          "Region focus identifies records, not pass/fail",
          "領域の強調は記録位置・合否マップではありません"
        )}
      </text>
      <Reading
        x={24}
        y={277}
        width={207}
        signal="die"
        label={l(
          "칩 검사 편차 지수",
          "Die deviation index",
          "チップ検査偏差指数"
        )}
        value={die.value}
        selected={selectedSignal === "die"}
        accent={accent}
        onSelect={onSelect}
      />
      <Reading
        x={249}
        y={277}
        width={207}
        signal="comparison"
        label={l("검사 비교 지수", "Comparison index", "検査比較指数")}
        value={comparison.value}
        selected={selectedSignal === "comparison"}
        accent={accent}
        onSelect={onSelect}
      />
    </svg>
  );
}

export default function JudgmentInspectionScenes(props: MotionSceneProps) {
  return props.scene.processId === "wafer" ? (
    <WaferJudgmentScene {...props} />
  ) : props.scene.processId === "oxidation" ? (
    <OxidationJudgmentScene {...props} />
  ) : props.scene.processId === "eds" ? (
    <EdsJudgmentScene {...props} />
  ) : null;
}
