import { useId } from "react";
import type { ProductLanguage } from "../lib/productLanguage";
import { tr } from "../lib/productLanguage";

type EquipmentView = "exterior" | "cutaway";

/** The exterior and the separate teaching cutaway are intentionally different models. */
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
  const exterior = view === "exterior";
  return (
    <svg
      className={`kp-equipment-svg kp-equipment-${view}`}
      viewBox="0 0 520 460"
      role="img"
      aria-label={
        exterior
          ? l(
              "닫힌 크림색 정면 캐비닛, 왼쪽 조작 화면과 비상정지 버튼, 전면 로드포트 3개를 갖춘 Kiyo 참고 외관 모형",
              "Kiyo-inspired exterior model with a closed cream cabinet, left control screen and emergency stop, and three front load ports",
              "閉じたクリーム色のキャビネット、左側操作画面と非常停止ボタン、前面ロードポート3基を備えたKiyo参考外観模型"
            )
          : l(
              "캐비닛과 별도로 만든 교육용 챔버 단면 모형. 가스 공급, 웨이퍼 받침과 배기 방향을 단순화한 설명 모형",
              "Separate teaching chamber cutaway, independent of the cabinet: a simplified gas supply, wafer support and exhaust path",
              "キャビネットとは別に作った教育用チャンバー断面模型。ガス供給、ウェーハ支持部、排気方向を簡略化した説明模型"
            )
      }
    >
      <title>
        {exterior
          ? l(
              "Kiyo 참고 외관 모형",
              "Kiyo-inspired exterior model",
              "Kiyo参考外観模型"
            )
          : l(
              "별도 교육용 챔버 단면",
              "Separate teaching chamber cutaway",
              "独立した教育用チャンバー断面"
            )}
      </title>
      <desc>
        {exterior
          ? l(
              "정면의 세 도어는 로드포트입니다. 내부 식각 챔버의 위치나 배치는 표현하지 않았습니다.",
              "The three front doors are load ports. Internal etch-chamber positions and layout are not represented.",
              "前面の3つのドアはロードポートです。内部エッチングチャンバーの位置や配置は表現していません。"
            )
          : l(
              "설명을 위해 별도의 받침 위에 만든 단순화 모형이며, Kiyo의 실제 내부 구조나 센서 배치도가 아닙니다.",
              "A simplified model on its own stand, not Kiyo's actual internal structure or sensor layout.",
              "説明のため別の台に置いた簡略模型であり、実際のKiyo内部構造やセンサー配置図ではありません。"
            )}
      </desc>
      <defs>
        <linearGradient id={`${id}-cream`} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#efeee2" />
          <stop offset="1" stopColor="#d8d9ca" />
        </linearGradient>
        <linearGradient id={`${id}-side`} x1="0" y1="0" x2="1" y2="0">
          <stop stopColor="#a5b3a3" />
          <stop offset="1" stopColor="#c5cbbd" />
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
          <stop stopColor="#829c90" />
          <stop offset=".3" stopColor="#d7e0d6" />
          <stop offset="1" stopColor="#8caa99" />
        </linearGradient>
      </defs>
      {exterior ? (
        <g transform="translate(0 -4) scale(1 1.29)">
          <ellipse
            cx="267"
            cy="321"
            rx="202"
            ry="18"
            fill="#000"
            opacity=".2"
          />
          {/* Closed exterior: no open chamber, side window, or implied internal placement. */}
          <path
            d="m65 65 40-22h360l-40 22z"
            fill={`url(#${id}-top)`}
            stroke="#a8b3a1"
          />
          <path
            d="m425 65 40-22v235l-40 22z"
            fill={`url(#${id}-side)`}
            stroke="#92a08f"
          />
          <rect
            x="65"
            y="65"
            width="360"
            height="235"
            rx="2"
            fill={`url(#${id}-cream)`}
            stroke="#a6b49f"
          />
          <path
            d="M65 129h360M157 129v171M65 230h92"
            fill="none"
            stroke="#a8b69f"
          />
          <text
            x="254"
            y="105"
            fill="#71846b"
            textAnchor="middle"
            fontSize="16"
            letterSpacing="3"
          >
            SemiGuard
          </text>
          <path d="M183 116h143" stroke="#bbc5b1" />
          <rect
            x="82"
            y="145"
            width="63"
            height="44"
            rx="1"
            fill={`url(#${id}-glass)`}
            stroke="#6d816a"
          />
          <path
            d="M89 155h30m-30 7h46m-46 7h20"
            stroke="#749385"
            opacity=".6"
          />
          <rect x="81" y="133" width="34" height="6" rx="1" fill="#7c9076" />
          <circle cx="88" cy="136" r="2" fill="#7c8b73" />
          <circle cx="91" cy="207" r="10" fill="#b9a94b" stroke="#8d914d" />
          <circle cx="91" cy="207" r="6.5" fill="#a84433" stroke="#be6a4a" />
          <path d="M111 201h25m-25 6h19m-19 6h25" stroke="#85997c" />
          <rect
            x="78"
            y="240"
            width="67"
            height="46"
            fill="none"
            stroke="#a7b49b"
          />
          <path d="M132 250v9" stroke="#7b8e73" strokeWidth="3" />
          {[0, 1, 2].map(port => (
            <g key={port} transform={`translate(${port * 79} 0)`}>
              <rect
                x="169"
                y="150"
                width="67"
                height="69"
                rx="2"
                fill="#a7b5a2"
                stroke="#859a7d"
              />
              <rect
                x="175"
                y="157"
                width="55"
                height="55"
                rx="4"
                fill="#e0e3d5"
                stroke="#91a486"
              />
              <circle cx="184" cy="171" r="3" fill="#426d71" />
              <circle cx="220" cy="199" r="3" fill="#426d71" />
              <rect x="181" y="141" width="12" height="4" fill="#84957b" />
              <path
                d="m163 228 9-12h65l9 12z"
                fill="#23322a"
                stroke="#435b44"
              />
              <rect
                x="163"
                y="228"
                width="83"
                height="8"
                fill="#101c16"
                stroke="#3d523b"
              />
              <rect
                x="169"
                y="239"
                width="70"
                height="65"
                fill={`url(#${id}-cream)`}
                stroke="#91a183"
              />
              <path d="M178 278h50m-50 5h50m-50 5h50" stroke="#bbc7af" />
              <text
                x="203"
                y="259"
                textAnchor="middle"
                fill="#6a8063"
                fontSize="8"
                letterSpacing="1"
              >
                LP {port + 1}
              </text>
            </g>
          ))}
          <path d="M69 303h354v8H69z" fill="#6b8260" />
          <path d="M82 311v8m325-8v8" stroke="#263a29" strokeWidth="8" />
          <path d="M415 65V35" stroke="#738369" strokeWidth="3" />
          <rect
            x="410"
            y="12"
            width="10"
            height="23"
            rx="2"
            fill="#829078"
            stroke="#82967a"
          />
          <path d="M410 19h10m-10 8h10" stroke="#576f50" />
          <path d="M294 317v13h100" fill="none" stroke="#839c80" />
          <text x="396" y="345" textAnchor="end" fill="#b0c2a8" fontSize="12">
            {l(
              "전면 로드포트 3개",
              "3 front load ports",
              "前面ロードポート3基"
            )}
          </text>
        </g>
      ) : (
        <g transform="translate(0 60)">
          <ellipse
            cx="257"
            cy="322"
            rx="195"
            ry="15"
            fill="#000"
            opacity=".2"
          />
          {/* Standalone teaching model: its own base physically separates it from the cabinet. */}
          <path d="m90 286 281 0 37-18H127z" fill="#a1b49b" stroke="#809777" />
          <path d="M90 286h281v22H90z" fill="#546e50" stroke="#809777" />
          <path d="m371 286 37-18v22l-37 18z" fill="#415b3e" stroke="#718b66" />
          <path
            d="M127 286V117c0-36 54-55 116-55s116 19 116 55v169"
            fill={`url(#${id}-vessel)`}
            stroke="#9eb29a"
            strokeWidth="2"
          />
          <path
            d="M149 278V130c0-23 41-35 94-35s94 12 94 35v148z"
            fill="#182e27"
            stroke="#91ab8a"
            strokeWidth="2"
          />
          <path d="M155 135h176" stroke="#acc3a2" strokeWidth="10" />
          <path
            d="M175 146v9m23-9v9m23-9v9m23-9v9m23-9v9m23-9v9m23-9v9"
            stroke="#7ca181"
            strokeWidth="2"
          />
          <path
            d="M243 63V32h73"
            fill="none"
            stroke="#b6c9ab"
            strokeWidth="11"
          />
          <path
            d="M243 63V32h73"
            fill="none"
            stroke="#4c7054"
            strokeWidth="5"
          />
          <path
            d="m267 27-9 5 9 5"
            fill="none"
            stroke="#e4aa55"
            strokeWidth="2"
          />
          <ellipse
            cx="243"
            cy="207"
            rx="68"
            ry="13"
            fill="#5c8976"
            stroke="#a5c3a0"
          />
          <path
            d="M175 207v13c0 17 136 17 136 0v-13"
            fill="#849e84"
            stroke="#9ab393"
          />
          <path d="M214 234h58v44h-58z" fill="#a1b49a" stroke="#718e71" />
          <ellipse
            cx="243"
            cy="202"
            rx="62"
            ry="9"
            fill="#769a98"
            stroke="#b2cfb8"
          />
          <ellipse
            cx="243"
            cy="177"
            rx="62"
            ry="18"
            fill={active && ledOn ? "#79bed5" : "#628d96"}
            opacity={active && ledOn ? ".28" : ".08"}
          />
          <path
            d="M188 176h110m-94-9h80m-63 18h45"
            stroke={active && ledOn ? "#a1d7e5" : "#739e9c"}
            strokeWidth="2"
            opacity={active && ledOn ? ".8" : ".25"}
          />
          <path
            d="M337 249h48v33"
            fill="none"
            stroke="#9aaf91"
            strokeWidth="12"
          />
          <path
            d="M337 249h48v33"
            fill="none"
            stroke="#355c3e"
            strokeWidth="5"
          />
          <path
            d="m355 244 9 5-9 5"
            fill="none"
            stroke="#e4aa55"
            strokeWidth="2"
          />
          <path
            d="M151 132H79m116 72H79m258 43h81"
            fill="none"
            stroke="#88a77f"
          />
          <text x="72" y="124" textAnchor="end" fill="#c2d4b8" fontSize="12">
            {l("가스 공급", "Gas in", "ガス供給")}
          </text>
          <text x="72" y="200" textAnchor="end" fill="#c2d4b8" fontSize="12">
            {l("웨이퍼", "Wafer", "ウェーハ")}
          </text>
          <text x="425" y="244" fill="#c2d4b8" fontSize="12">
            {l("배기", "Exhaust", "排気")}
          </text>
          <rect x="139" y="290" width="181" height="13" rx="2" fill="#1c3624" />
          <text
            x="230"
            y="300"
            textAnchor="middle"
            fill="#c7d5b9"
            fontSize="8"
            letterSpacing="1.5"
          >
            SEPARATE TEACHING MODEL
          </text>
          <text
            x="245"
            y="345"
            textAnchor="middle"
            fill="#b0c2a8"
            fontSize="12"
          >
            {l(
              "공정 표시용 LED · 플라즈마 실현 아님",
              "Process LED · no physical plasma",
              "プロセス表示LED・実プラズマなし"
            )}
          </text>
        </g>
      )}
    </svg>
  );
}
