import React, { useState } from "react";
import { getProcessScenario, processSample } from "../../../shared/processScenarios";
import { tr, type ProductLanguage } from "../lib/productLanguage";
import "./process-concepts.css";

const scenario = getProcessScenario("metal")!;
export default function MetalLayerConcept({ time, language }: { time: number; language: ProductLanguage }) {
  const [view, setView] = useState<"connection" | "appearance">("connection");
  const sample = processSample(scenario, view, time);
  const l = (ko: string, en: string, ja: string) => tr(language, ko, en, ja);
  const connection = view === "connection";
  return <section className="pc-view" aria-label={l("금속 배선 검사 관점", "Metal interconnect inspection perspectives", "金属配線検査の観点")}>
    <h3>{l("연결과 외관은 같은 근거인가요?", "Do connection and appearance provide the same evidence?", "接続と外観は同じ根拠ですか？")}</h3>
    <div className="pc-controls" role="group" aria-label={l("검사 관점 선택", "Choose inspection perspective", "検査観点を選択")}>
      <button type="button" aria-pressed={connection} onClick={() => setView("connection")}>{l("연결 기록 보기", "View connection", "接続記録を見る")}</button>
      <button type="button" aria-pressed={!connection} onClick={() => setView("appearance")}>{l("외관 기록 보기", "View appearance", "外観記録を見る")}</button>
    </div>
    <div className="pc-layout"><figure>
      <svg viewBox="0 0 400 250" role="img" aria-label={l("금속 배선·절연막·층간 연결의 설명용 단면", "Conceptual metal lines, dielectric and interlayer via", "金属配線・絶縁膜・層間接続の説明用断面")}>
        <rect x="30" y="40" width="340" height="170" fill="#263e45" stroke="#a5d5dc" />
        <path d="M55 170H175V90H345" fill="none" stroke="#e8c985" strokeWidth="24" />
        {connection ? <path d="M55 170H175V90H345" fill="none" stroke="#fff0ca" strokeWidth="4" strokeDasharray="8 5" /> : <path d="M35 40H365" stroke="#fff0ca" strokeWidth="6" />}
        <text x="225" y="180" fill="#dbe9eb" fontSize="14">{l("절연막", "Dielectric", "絶縁膜")}</text>
      </svg>
      <figcaption>{l("연결 관점은 배선 경로를, 외관 관점은 표면을 강조합니다. 실제 구조·단선·검사 영상·전류 흐름을 재현하지 않습니다.", "Connection highlights a path; appearance highlights a surface. This is not an actual structure, broken-wire image, inspection scan or current simulation.", "接続は配線経路、外観は表面を強調します。実構造・断線・検査画像・電流シミュレーションではありません。")}</figcaption>
    </figure><div><h4>{connection ? l("연결 기록", "Connection record", "接続記録") : l("외관 기록", "Appearance record", "外観記録")} · {sample.time}s</h4>
      <p>{sample.value.toFixed(1)} / {sample.reference.toFixed(1)} · {l("이번 / 정상 참고", "Current / normal reference", "今回 / 正常参照")}</p>
      <p>{l("참고 띠", "Reference band", "基準帯")} {sample.low}–{sample.high} · {sample.value >= sample.low && sample.value <= sample.high ? l("띠 안", "Inside band", "基準帯内") : l("띠 밖", "Outside band", "基準帯外")}</p>
      <p>{l("외관 기록이 띠 안이어도 연결 기록의 편차가 사라지지는 않습니다. 아래 구간 도구에서 일시 복귀 뒤에도 편차가 반복되는지 확인하세요.", "Appearance inside its band does not erase a connection deviation. Use the original interval board below to inspect recurrence after a temporary return.", "外観が帯内でも接続記録の偏差は消えません。下の区間ツールで一時復帰後の再発を確認してください。")}</p>
    </div></div>
    <p className="pc-limit">{l("색은 검사 관점 선택이며 불량 표시가 아닙니다. 그림 선택은 기존 구간·재생·답안·저장·AI 입력을 바꾸지 않습니다.", "Highlight marks inspection perspective, not a defect. Selection changes no original interval, playback, answer, save or AI input.", "色は検査観点で不良表示ではありません。図の選択は既存区間・再生・回答・保存・AI入力を変更しません。")}</p>
  </section>;
}
