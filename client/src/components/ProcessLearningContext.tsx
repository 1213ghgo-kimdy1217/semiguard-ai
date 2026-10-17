import React from "react";
import { tr, type ProductLanguage } from "../lib/productLanguage";
import "./process-learning-context.css";

type Props = { kind: "wafer" | "oxidation" | "photo"; language: ProductLanguage };
/** Fixed explanatory structure. No result values or future samples are encoded. */
export default function ProcessLearningContext({ kind, language }: Props) {
  const l = (ko: string, en: string, ja: string) => tr(language, ko, en, ja);
  const titles = {
    wafer: l("웨이퍼 기판의 위치별 검사", "Location-based wafer substrate inspection", "ウェーハ基板の位置別検査"),
    oxidation: l("실리콘 표면에 산화막 형성", "Oxide formation at a silicon surface", "シリコン表面での酸化膜形成"),
    photo: l("감광막에 패턴 전사", "Pattern transfer into photoresist", "感光膜へのパターン転写"),
  };
  return <aside className="pl-context" aria-label={titles[kind]}>
    <figure><svg viewBox="0 0 280 150" role="img" aria-label={titles[kind]}>
      {kind === "wafer" ? <g><ellipse cx="140" cy="80" rx="103" ry="55" fill="#355768" stroke="#a5d5dc" strokeWidth="2" />
        {[0, 1, 2].map(row => [0, 1, 2].map(col => <rect key={`${row}:${col}`} x={89 + col * 37} y={45 + row * 25} width="28" height="17" rx="3" fill="#91cfc2" opacity=".65" />))}
      </g> : <g>
        <rect x="25" y="100" width="230" height="35" fill="#355768" stroke="#a5d5dc" />
        {kind === "oxidation" ? <g><rect x="25" y="86" width="230" height="14" fill="#a7d9cd" />
          {[65, 115, 165, 215].map(x => <path key={x} d={`M${x} 30V73l-5 -7m5 7l5 -7`} fill="none" stroke="#a7d9cd" strokeWidth="2" />)}
        </g> : <g>
          <rect x="25" y="79" width="230" height="21" fill="#947cab" />
          <path d="M25 34H100M135 34H255" stroke="#dbe9eb" strokeWidth="8" />
          {[108, 118, 128].map(x => <path key={x} d={`M${x} 8V69l-3 -6m3 6l3 -6`} fill="none" stroke="#e8c985" strokeWidth="2" />)}
        </g>}
      </g>}
    </svg><figcaption>{titles[kind]}</figcaption></figure>
    <div><p>{kind === "wafer" ? l("같은 위치의 표면과 두께를 비교하세요. 이 연습은 웨이퍼 제조 전체가 아니라 기판 검사 판단의 일부를 다룹니다.", "Compare surface and thickness at the same location. This exercise covers a substrate-inspection judgment task, not the complete wafer-manufacturing process.", "同じ位置の表面と厚さを比較します。この練習は基板検査判断の一部で、ウェーハ製造全体ではありません。") : kind === "oxidation" ? l("산화는 실리콘 표면에서 산화막을 형성하는 개념입니다. 아래에서는 그림의 막 두께가 아니라 검사 묶음과 일치하는 참고 기준을 선택하세요.", "Oxidation forms an oxide at the silicon surface. Below, select the reference matching the inspection group; do not read thickness from this drawing.", "酸化はシリコン表面で酸化膜を形成する概念です。下では図の膜厚ではなく検査グループに一致する基準を選びます。") : l("마스크를 통한 노광의 개념도입니다. 아래 패턴 비교 도구에서 위치와 형상을 따로 살펴보고, 관측한 앞뒤 시점을 비교하세요.", "This illustrates exposure through a mask. Use the pattern tool below to inspect position and shape separately and compare observed earlier/later frames.", "マスクを通した露光の概念図です。下のパターン比較で位置と形状を別々に確認し、観測済みの前後時点を比較します。")}</p>
    <small>{l("설명용 구조이며 실제 영상·막 두께·결함 수·장비 상태가 아닙니다. 실제 판단 근거는 아래의 기존 가상 검사 기록입니다.", "Explanatory structure, not an actual image, film thickness, defect count or equipment condition. Evidence comes from the existing synthetic records below.", "説明用構造で実画像・膜厚・欠陥数・装置状態ではありません。判断根拠は下の既存仮想検査記録です。")}</small></div>
  </aside>;
}
