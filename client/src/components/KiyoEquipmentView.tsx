import { useId } from "react";
import type { ProductLanguage } from "../lib/productLanguage";
import { tr } from "../lib/productLanguage";

type EquipmentView = "exterior" | "cutaway";

/** One model cabinet. Its optional observation window shows an educational layout. */
export default function KiyoEquipmentView({
  view,
  active,
  ledOn,
  language,
}: {
  view: EquipmentView;
  active: boolean;
  ledOn: boolean;
  language: ProductLanguage;
}) {
  const id = useId().replace(/:/g, "");
  const l = (ko: string, en: string, ja: string) => tr(language, ko, en, ja);
  const inside = view === "cutaway";
  return (
    <svg
      className={`kp-equipment-svg kp-equipment-${view}`}
      viewBox="0 0 620 460"
      role="img"
      aria-label={
        inside
          ? l(
              "전면 로드포트 3개가 있는 하나의 장비 모형. 측면 관찰창에 교육용으로 단순화한 챔버와 웨이퍼 받침이 보입니다.",
              "One equipment model with three front load ports. Its side observation window reveals a simplified educational chamber and wafer support.",
              "前面ロードポート3基を備えた1台の装置模型。側面観察窓に教育用に簡略化したチャンバーとウェーハ支持部が見えます。"
            )
          : l(
              "닫힌 크림색 캐비닛, 왼쪽 조작 화면과 장식 빨간 버튼, 전면 로드포트 3개를 갖춘 Kiyo 참고 외관 모형",
              "Kiyo-inspired exterior: a closed cream cabinet, left control screen and decorative red button, and three front load ports",
              "閉じたクリーム色のキャビネット、左側操作画面と装飾用の赤いボタン、前面ロードポート3基を備えたKiyo参考外観模型"
            )
      }
    >
      <title>
        {inside
          ? l(
              "장비 모형의 교육용 내부 보기",
              "Educational interior of the equipment model",
              "装置模型の教育用内部表示"
            )
          : l(
              "장비 모형 외관 보기",
              "Equipment model exterior",
              "装置模型の外観表示"
            )}
      </title>
      <desc>
        {l(
          "정면의 세 도어는 로드포트입니다. 측면 관찰창과 내부 챔버 배치는 모형 교육을 위해 설계했으며 실제 Kiyo 내부 구조나 위치를 재현한 것이 아닙니다. 외관 표시등과 빨간 버튼은 장식이며 USB 상태를 나타내지 않습니다.",
          "The three front doors are load ports. The side window and chamber layout are designed for model-based learning, not a reproduction of Kiyo's actual internal structure or positions. Exterior lights and the red button are decorative, not USB state indicators.",
          "前面の3つのドアはロードポートです。側面観察窓と内部チャンバー配置は模型教育用の設計で、実際のKiyo内部構造や位置の再現ではありません。外観表示灯と赤いボタンは装飾で、USB状態を示しません。"
        )}
      </desc>
      <defs>
        <linearGradient id={`${id}-cream`} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#efeee2" />
          <stop offset="1" stopColor="#d8d9ca" />
        </linearGradient>
        <linearGradient id={`${id}-side`} x1="0" y1="0" x2="1" y2="0">
          <stop stopColor="#a1b09e" />
          <stop offset="1" stopColor="#c4ccba" />
        </linearGradient>
        <linearGradient id={`${id}-top`} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#fffef1" />
          <stop offset="1" stopColor="#dfe4d5" />
        </linearGradient>
        <linearGradient id={`${id}-glass`} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#304744" />
          <stop offset="1" stopColor="#122420" />
        </linearGradient>
        <linearGradient id={`${id}-vessel`} x1="0" y1="0" x2="1" y2="0">
          <stop stopColor="#819b86" />
          <stop offset=".4" stopColor="#d2dfcd" />
          <stop offset="1" stopColor="#8da58c" />
        </linearGradient>
        <clipPath id={`${id}-window`}>
          <rect x="0" y="0" width="118" height="208" rx="3" />
        </clipPath>
      </defs>
      <ellipse cx="302" cy="389" rx="250" ry="20" fill="#000" opacity=".2" />
      <path
        d="m55 65 140-42h350L395 65z"
        fill={`url(#${id}-top)`}
        stroke="#a8b3a1"
      />
      <path
        d="m395 65 150-42v300l-150 42z"
        fill={`url(#${id}-side)`}
        stroke="#8f9f89"
      />
      {/* The side window belongs to this teaching model; it does not claim a real tool layout. */}
      {inside ? (
        <g transform="matrix(1 -0.3 0 1 411 117)">
          <rect
            x="0"
            y="0"
            width="118"
            height="208"
            rx="3"
            fill="#12261b"
            stroke="#b2c5a5"
            strokeWidth="2.5"
          />
          <g clipPath={`url(#${id}-window)`}>
            <path
              d="M16 186V58c0-18 21-28 43-28s43 10 43 28v128"
              fill={`url(#${id}-vessel)`}
              stroke="#a0ba96"
              strokeWidth="2"
            />
            <path
              d="M25 184V65c0-12 17-21 34-21s34 9 34 21v119z"
              fill="#203a27"
              stroke="#8da680"
            />
            <path
              d="M59 31V10h31"
              fill="none"
              stroke="#bdd0ac"
              strokeWidth="7"
            />
            <path
              d="M59 31V10h31"
              fill="none"
              stroke="#5e7c50"
              strokeWidth="3"
            />
            <path d="M29 73h60" stroke="#b6cfa7" strokeWidth="6" />
            <path
              d="M35 80v7m12-7v7m12-7v7m12-7v7m12-7v7"
              stroke="#85ab75"
              strokeWidth="1.5"
            />
            <ellipse
              cx="59"
              cy="113"
              rx="30"
              ry="15"
              fill={active && ledOn ? "#79cce2" : "#4c7464"}
              opacity={active && ledOn ? ".42" : ".08"}
            />
            <path
              d="M33 111h52m-45-7h38m-31 15h24"
              stroke={active && ledOn ? "#a7e4ed" : "#648666"}
              strokeWidth="1.6"
              opacity={active && ledOn ? ".9" : ".2"}
            />
            <ellipse
              cx="59"
              cy="138"
              rx="31"
              ry="7"
              fill="#719d92"
              stroke="#b7d1a7"
            />
            <path
              d="M28 140v8c0 10 62 10 62 0v-8"
              fill="#9fb59a"
              stroke="#789770"
            />
            <path d="M47 158h24v27H47z" fill="#b2c2a2" stroke="#7c9c6e" />
            <path
              d="M94 170h18v24"
              fill="none"
              stroke="#a2bc94"
              strokeWidth="7"
            />
            <path
              d="M94 170h18v24"
              fill="none"
              stroke="#476b40"
              strokeWidth="3"
            />
            <path d="M10 191h98" stroke="#6f8e65" strokeWidth="4" />
          </g>
          <circle cx="7" cy="7" r="2" fill="#d4dec7" />
          <circle cx="111" cy="7" r="2" fill="#d4dec7" />
          <circle cx="7" cy="201" r="2" fill="#d4dec7" />
          <circle cx="111" cy="201" r="2" fill="#d4dec7" />
        </g>
      ) : (
        <g>
          <path
            d="m411 119 118-35v208l-118 35z"
            fill="#afbea6"
            stroke="#8da481"
          />
          <path d="m422 140 94-28m-94 182 94-28" stroke="#9baf8d" />
          <path d="m429 210 0 18" stroke="#6e8662" strokeWidth="4" />
        </g>
      )}
      {/* Cream front stays identical in both views. The three interfaces are load ports. */}
      <rect
        x="55"
        y="65"
        width="340"
        height="300"
        rx="2"
        fill={`url(#${id}-cream)`}
        stroke="#a6b49f"
      />
      <path
        d="M55 190h340M157 190v175M55 284h102"
        fill="none"
        stroke="#a8b69f"
      />
      <text
        x="235"
        y="121"
        fill="#71846b"
        textAnchor="middle"
        fontSize="19"
        letterSpacing="3"
      >
        SemiGuard
      </text>
      <path d="M174 137h122" stroke="#bbc5b1" />
      <rect
        x="76"
        y="207"
        width="66"
        height="44"
        rx="1"
        fill={`url(#${id}-glass)`}
        stroke="#6d816a"
      />
      <path d="M83 217h32m-32 7h48m-48 7h23" stroke="#749385" opacity=".6" />
      <rect x="75" y="195" width="34" height="6" rx="1" fill="#7c9076" />
      <circle cx="82" cy="198" r="2" fill="#7c8b73" />
      <circle cx="86" cy="268" r="10" fill="#b9a94b" stroke="#8d914d" />
      <circle cx="86" cy="268" r="6.5" fill="#a84433" stroke="#be6a4a" />
      <path d="M105 262h28m-28 6h22m-22 6h28" stroke="#85997c" />
      <rect
        x="69"
        y="297"
        width="74"
        height="53"
        fill="none"
        stroke="#a7b49b"
      />
      <path d="M131 307v9" stroke="#7b8e73" strokeWidth="3" />
      {[0, 1, 2].map(port => (
        <g key={port} transform={`translate(${port * 72} 0)`}>
          <rect
            x="169"
            y="207"
            width="61"
            height="66"
            rx="2"
            fill="#a7b5a2"
            stroke="#859a7d"
          />
          <rect
            x="175"
            y="214"
            width="49"
            height="52"
            rx="4"
            fill="#e0e3d5"
            stroke="#91a486"
          />
          <circle cx="184" cy="227" r="3" fill="#426d71" />
          <circle cx="215" cy="254" r="3" fill="#426d71" />
          <rect x="181" y="197" width="12" height="4" fill="#84957b" />
          <path d="m164 282 8-10h59l8 10z" fill="#23322a" stroke="#435b44" />
          <rect
            x="164"
            y="282"
            width="75"
            height="8"
            fill="#101c16"
            stroke="#3d523b"
          />
          <rect
            x="169"
            y="293"
            width="65"
            height="73"
            fill={`url(#${id}-cream)`}
            stroke="#91a183"
          />
          <path d="M177 340h48m-48 5h48m-48 5h48" stroke="#bbc7af" />
          <text
            x="201"
            y="315"
            textAnchor="middle"
            fill="#6a8063"
            fontSize="9"
            letterSpacing="1"
          >
            LP {port + 1}
          </text>
        </g>
      ))}
      <path d="M59 367h334v8H59z" fill="#6b8260" />
      <path d="M72 375v8m305-8v8" stroke="#263a29" strokeWidth="8" />
      <path d="M383 65V35" stroke="#738369" strokeWidth="3" />
      <rect
        x="378"
        y="12"
        width="10"
        height="23"
        rx="2"
        fill="#829078"
        stroke="#82967a"
      />
      <path d="M378 19h10m-10 8h10" stroke="#576f50" />
      <path d="M274 385v15h95" fill="none" stroke="#839c80" />
      <text x="370" y="420" textAnchor="end" fill="#b0c2a8" fontSize="12">
        {l("전면 로드포트 3개", "3 front load ports", "前面ロードポート3基")}
      </text>
      {inside ? (
        <g>
          <path d="M530 283h52v45" fill="none" stroke="#d2b779" />
          <text x="581" y="347" textAnchor="end" fill="#e1c88f" fontSize="12">
            {l("교육용 관찰창", "Teaching window", "教育用観察窓")}
          </text>
        </g>
      ) : null}
    </svg>
  );
}
