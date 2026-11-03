import { useId } from "react";
import type { ProductLanguage } from "../lib/productLanguage";
import { tr } from "../lib/productLanguage";

export default function KiyoEquipmentView({
  selected,
  active,
  fault,
  ledOn,
  language,
}: {
  selected: "A" | "B";
  active: boolean;
  fault: boolean;
  ledOn: boolean;
  language: ProductLanguage;
}) {
  const id = useId().replace(/:/g, "");
  const l = (ko: string, en: string, ja: string) => tr(language, ko, en, ja);
  return (
    <svg
      className="kp-equipment-svg"
      viewBox="0 0 760 450"
      role="img"
      aria-label={l(
        "세 개의 전면 로드포트와 후면 공정 모듈이 있는 식각 장비 교육용 모형",
        "Teaching model of an etch tool with three front load ports and rear process modules",
        "前面ロードポート3基と後部プロセスモジュールを備えたエッチング装置の教育用模型"
      )}
    >
      <title>
        {l(
          "Kiyo 공개 외관을 참고한 제작 구상",
          "Build concept inspired by public Kiyo imagery",
          "Kiyoの公開外観を参考にした製作案"
        )}
      </title>
      <desc>
        {l(
          "흰색 캐비닛과 전면 웨이퍼 투입부, 챔버 A와 확장 모듈 B를 단순화했습니다. 실제 내부 구조를 복제한 도면이 아닙니다.",
          "Simplified white cabinets, wafer load ports, chamber A and extension module B. This is not a reproduction of the internal design.",
          "白いキャビネット、ウェーハ投入口、チャンバーA、拡張モジュールBを簡略化しています。実際の内部構造の複製ではありません。"
        )}
      </desc>
      <defs>
        <linearGradient id={`${id}-front`} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#edf0ee" />
          <stop offset="1" stopColor="#c7d0cc" />
        </linearGradient>
        <linearGradient id={`${id}-side`} x1="0" y1="0" x2="1" y2="0">
          <stop stopColor="#9aaba3" />
          <stop offset="1" stopColor="#b9c5bf" />
        </linearGradient>
        <linearGradient id={`${id}-glass`} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#233b3c" />
          <stop offset="1" stopColor="#0c1c21" />
        </linearGradient>
        <linearGradient id={`${id}-top`} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#ffffff" />
          <stop offset="1" stopColor="#dce4de" />
        </linearGradient>
      </defs>
      <g
        className="kp-equipment-grid"
        fill="none"
        stroke="currentColor"
        strokeWidth=".7"
      >
        <path d="M60 300 405 440M100 270 490 428M160 240 568 404M220 210 646 381M290 184 710 352M96 358 425 165M175 390 505 198M260 423 585 230M350 439 668 256" />
      </g>
      <ellipse cx="388" cy="367" rx="260" ry="40" fill="#000" opacity=".23" />
      {/* Rear service cabinet and two simplified process modules. */}
      <path
        d="m278 113 269 54 85-50-270-53z"
        fill={`url(#${id}-top)`}
        stroke="#a8b7af"
      />
      <path
        d="m547 167 85-50v178l-85 50z"
        fill={`url(#${id}-side)`}
        stroke="#85988d"
      />
      <path
        d="m278 113 269 54v178l-269-54z"
        fill={`url(#${id}-front)`}
        stroke="#a8b7af"
      />
      <path d="m570 183 36-21v83l-36 21z" fill="#a5b4aa" stroke="#8d9f95" />
      <path
        d="m570 281 36-21m-36 8 36-21m-36 8 36-21"
        stroke="#61776b"
        strokeWidth="2"
      />
      <path
        d="m301 154 55 11v104l-55-11zm75 15 55 11v104l-55-11zm75 15 72 14v104l-72-14z"
        fill="none"
        stroke="#9aada1"
      />
      <path
        d="m344 218 2 .4m73 15 2 .4m90 17 2 .4"
        stroke="#657d6e"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <g
        className={
          selected === "B" ? "kp-module kp-module-selected" : "kp-module"
        }
      >
        <path
          d="m421 66 92 18 67-39-93-18z"
          fill={`url(#${id}-top)`}
          stroke="#acb9b2"
        />
        <path
          d="m421 66 92 18v87l-92-18z"
          fill={`url(#${id}-front)`}
          stroke="#a1b1a8"
        />
        <path
          d="m513 84 67-39v87l-67 39z"
          fill={`url(#${id}-side)`}
          stroke="#899d90"
        />
        <path d="m432 85 68 14v48l-68-14z" fill="#d0dbd4" stroke="#9aac9f" />
        <path d="m449 109 36 7" stroke="#8fa394" strokeWidth="3" />
        <path
          className="kp-module-outline"
          d="m421 66 66-39 93 18v87l-67 39-92-18z"
          fill="none"
          strokeWidth="2.5"
        />
        <text
          x="455"
          y="131"
          fill="#405b49"
          fontSize="14"
          fontWeight="600"
          transform="rotate(11 455 131)"
        >
          B
        </text>
      </g>
      <g
        className={
          selected === "A" ? "kp-module kp-module-selected" : "kp-module"
        }
      >
        <path
          d="m299 102 99 20 71-42-100-20z"
          fill={`url(#${id}-top)`}
          stroke="#acb9b2"
        />
        <path
          d="m299 102 99 20v94l-99-20z"
          fill={`url(#${id}-front)`}
          stroke="#9aad9f"
        />
        <path
          d="m398 122 71-42v94l-71 42z"
          fill={`url(#${id}-side)`}
          stroke="#899d90"
        />
        <path
          d="m315 127 63 13v50l-63-13z"
          fill={`url(#${id}-glass)`}
          stroke="#72877a"
        />
        <ellipse
          cx="348"
          cy="161"
          rx="19"
          ry="7"
          transform="rotate(11 348 161)"
          fill={active && ledOn ? "#82d2e0" : "#6c8780"}
          opacity={active && ledOn ? ".9" : ".35"}
        />
        <path
          d="m331 160 32 6m-25-13 28 5"
          stroke={active && ledOn ? "#b1edf4" : "#65857b"}
          strokeWidth="1.4"
          opacity=".8"
        />
        <path
          className="kp-module-outline"
          d="m299 102 70-42 100 20v94l-71 42-99-20z"
          fill="none"
          strokeWidth="2.5"
        />
        <text
          x="418"
          y="153"
          fill="#405b49"
          fontSize="14"
          fontWeight="600"
          transform="rotate(-30 418 153)"
        >
          A
        </text>
      </g>
      {/* Atmospheric transfer enclosure: a cabinet, not an exposed factory cylinder. */}
      <path
        d="m131 207 267 55 109-64-267-54z"
        fill={`url(#${id}-top)`}
        stroke="#b1bdb5"
      />
      <path
        d="m398 262 109-64v116l-109 64z"
        fill={`url(#${id}-side)`}
        stroke="#8a9e8e"
      />
      <path
        d="m131 207 267 55v116l-267-54z"
        fill={`url(#${id}-front)`}
        stroke="#aab8ae"
      />
      <path
        d="m144 222 53 11v35l-53-11z"
        fill={`url(#${id}-glass)`}
        stroke="#657c6d"
      />
      <path d="m151 230 30 6m-30 5 19 4" stroke="#8eaba4" opacity=".6" />
      <path d="m145 274 49 10v27l-49-10z" fill="none" stroke="#9cae9f" />
      <ellipse
        cx="153"
        cy="284"
        rx="6"
        ry="5"
        fill="#9f3e32"
        stroke="#d1a050"
        strokeWidth="2"
      />
      <text
        x="392"
        y="187"
        fill="#68816f"
        fontSize="9"
        letterSpacing="1.6"
        transform="rotate(12 392 187)"
      >
        SEMIGUARD
      </text>
      <path
        d="m153 294 93 19v34l-93-19zm112 23 109 22v34l-109-22z"
        fill="none"
        stroke="#9daf9f"
      />
      <path d="m238 327 .1 11m128 15 .1 11" stroke="#6b8171" strokeWidth="3" />
      {/* Three simplified, unoccupied front load ports; no attached FOUP is implied. */}
      <g>
        {[0, 1, 2].map(port => (
          <g key={port} transform={`translate(${port * 61} ${port * 12.5})`}>
            <path
              d="m208 239 50 10v51l-50-10z"
              fill="#9bad9f"
              stroke="#738b79"
            />
            <path d="m213 246 40 8v38l-40-8z" fill="#d9e1d8" stroke="#8b9e8b" />
            <ellipse cx="222" cy="260" rx="2.5" ry="2.2" fill="#4c797a" />
            <ellipse cx="244" cy="283" rx="2.5" ry="2.2" fill="#4c797a" />
            <path
              d="m202 242 12 2"
              stroke={active ? "#acd3b9" : "#728f79"}
              strokeWidth="3"
            />
            <path
              d="m183 307 56 12 24-14-56-12z"
              fill="#172322"
              stroke="#4b6355"
            />
            <path
              d="m183 307 56 12v8l-56-12z"
              fill="#0b1412"
              stroke="#314b3b"
            />
            <path
              d="m239 319 24-14v8l-24 14z"
              fill="#243b2c"
              stroke="#425e47"
            />
            <path d="m192 316 41 9v47l-41-9z" fill="#becbbd" stroke="#81987f" />
            <path
              d="m233 325 20-12v47l-20 12z"
              fill="#829b82"
              stroke="#718d71"
            />
            <path d="m197 344 30 6m-30 1 30 6m-30 1 30 6" stroke="#9caf98" />
          </g>
        ))}
      </g>
      <path
        d="m127 325 272 56 114-67v12l-114 67-272-56z"
        fill="#546e5d"
        stroke="#758d7a"
      />
      <path
        d="m147 339v10m229 39v10m116-69v10"
        stroke="#202f29"
        strokeWidth="10"
      />
      {/* Stack light represents the model's command state only. */}
      <path d="M588 83V52" stroke="#526c5a" strokeWidth="4" />
      <path
        d="M583 30h10v23h-10z"
        fill={active ? (fault ? "#e4aa55" : "#86c6ad") : "#67776d"}
        stroke="#738b7b"
      />
      <path d="M583 37h10m-10 8h10" stroke="#314e3f" />
      <g
        className="kp-equipment-callouts"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
      >
        <path d="M355 92V34h-77" />
        <path d="M188 316v55H82" />
        <path d="M591 59h70v54" />
      </g>
      <g
        className="kp-equipment-labels"
        fill="currentColor"
        fontSize="11"
        letterSpacing="1"
      >
        <text x="210" y="29">
          01 / PROCESS
        </text>
        <text x="30" y="389">
          02 / LOAD PORTS
        </text>
        <text x="628" y="133">
          03 / LED
        </text>
      </g>
    </svg>
  );
}
