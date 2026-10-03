import React from "react";
import { processEquipment } from "../../../shared/processEquipment";
import type { ProcessId } from "../../../shared/processScenarios";
import { tr, type ProductLanguage } from "../lib/productLanguage";

export default function ProcessEquipmentReference({ processId, language }: { processId: ProcessId; language: ProductLanguage }) {
  const l = (ko: string, en: string, ja: string) => tr(language, ko, en, ja);
  const equipment = processEquipment[processId];
  return <section className="et-panel pt-reference"><p className="et-eyebrow">REAL EQUIPMENT CONTEXT / SYNTHETIC RECORDS</p>
    <h2>{l("이 연습과 연결되는 실제 장비 사례", "Real equipment context for this exercise", "この練習につながる実装置の例")}</h2>
    <h3>{equipment.name}</h3><p>{l(...equipment.context)}</p><p>{l(...equipment.distinction)}</p>
    <p className="et-caption">{l("공개 자료로 장비 유형을 이해하기 위한 참고입니다. 제조사 데이터로 만든 시뮬레이션이나 디지털 트윈이 아닙니다. 센서 위치·상대지수·시간축·참고 범위는 SemiGuard가 교육용으로 구성했으며, 제조사의 제휴·검증을 의미하지 않습니다.", "These public references explain equipment types. This is not a manufacturer-data simulation or digital twin. Locations, indices, timelines and ranges were created by SemiGuard for teaching; no affiliation or manufacturer validation is implied.", "公開資料で装置の種類を理解するための参考です。メーカーのデータに基づくシミュレーションやデジタルツインではありません。位置・指数・時間軸・参照範囲はSemiGuardが教育用に構成し、メーカーとの提携や検証を意味しません。")}</p>
    <ul>{equipment.sources.map(source => <li key={source.url}><a href={source.url} target="_blank" rel="noopener noreferrer">{source.name} ↗ {l("새 탭", "new tab", "新しいタブ")}</a></li>)}</ul>
  </section>;
}
