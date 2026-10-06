import type { processLessons } from "./learningHub";

export type ProcessLessonId = (typeof processLessons)[number]["id"];
type VisualCopy = { labels: readonly [string, string, string]; explanation: string; observe: string };

// Original educational illustrations: no manufacturer artwork or equipment specifications.
export const processVisuals = {
  wafer: {
    ko: { labels: ["실리콘 단결정", "얇은 원판", "다듬어진 표면"], explanation: "실리콘 기둥에서 얇은 원판을 얻고 표면을 다듬어 회로를 만들 바탕을 준비합니다.", observe: "표면 검사 결과를 같은 위치·조건끼리 비교하세요." },
    en: { labels: ["Silicon ingot", "Thin discs", "Polished surface"], explanation: "Thin discs from a silicon ingot are finished to provide a foundation for circuits.", observe: "Compare surface inspection results at the same location and under matching conditions." },
    ja: { labels: ["シリコン単結晶", "薄い円板", "整えた表面"], explanation: "シリコンの柱から薄い円板を得て表面を整え、回路を作る土台を準備します。", observe: "表面検査は同じ位置・条件の結果を比較しましょう。" },
  },
  oxidation: {
    ko: { labels: ["실리콘 표면", "형성된 산화막", "두께·균일도 확인"], explanation: "실리콘 표면의 산화막은 절연·보호에 쓰입니다. 막과 그 아래 실리콘을 구분해 보세요.", observe: "막이 보인다는 사실과 막 두께가 균일하다는 판단은 다릅니다." },
    en: { labels: ["Silicon surface", "Oxide layer", "Thickness checks"], explanation: "An oxide layer provides insulation or protection. Distinguish the layer from the silicon beneath it.", observe: "Seeing a layer does not establish that its thickness is uniform." },
    ja: { labels: ["シリコン表面", "形成した酸化膜", "膜厚・均一性の確認"], explanation: "表面の酸化膜は絶縁・保護に使われます。膜とその下のシリコンを区別して見ましょう。", observe: "膜が見える事実と、膜厚が均一だという判断は別です。" },
  },
  photo: {
    ko: { labels: ["빛 + 마스크 패턴", "감광막에 전달", "현상 후 감광막 패턴"], explanation: "빛으로 패턴을 전달하고 현상해 감광막 패턴을 만듭니다. 아래 재료를 제거하는 식각과는 다른 단계입니다.", observe: "패턴 위치·형상 검사와 장비 센서 기록을 구분해 비교하세요." },
    en: { labels: ["Light + mask", "Resist exposure", "Developed resist"], explanation: "Exposure and development form a pattern in photoresist. Etching the material beneath it is a separate step.", observe: "Distinguish pattern-position and shape inspections from equipment sensor records." },
    ja: { labels: ["光とマスク", "感光膜へ転写", "現像後の膜パターン"], explanation: "露光と現像で感光膜にパターンを作ります。下の材料を除去するエッチングとは別の段階です。", observe: "パターンの位置・形状の検査と装置センサー記録を分けて比較しましょう。" },
  },
  etch: {
    ko: { labels: ["패턴이 있는 막", "노출 부분 제거", "남겨진 구조"], explanation: "패턴으로 가린 부분은 남기고 노출된 재료를 선택적으로 제거하는 모습을 단순화했습니다.", observe: "결과 형상과 같은 단계의 압력·유량 등 센서 기록은 별도의 근거입니다." },
    en: { labels: ["Patterned layer", "Exposed removal", "Remaining structure"], explanation: "This simplified view shows selective removal of exposed material while masked areas remain.", observe: "Result geometry and same-stage pressure or flow records are distinct evidence." },
    ja: { labels: ["パターン付きの膜", "露出部分を除去", "残った構造"], explanation: "覆われた部分を残し、露出した材料を選択的に除去する様子を単純化しています。", observe: "結果の形状と同じ段階の圧力・流量などの記録は別の根拠です。" },
  },
  deposition: {
    ko: { labels: ["증착: 표면에 새 막", "이온 주입: 내부 도입", "목적·검사도 다름"], explanation: "왼쪽은 표면에 막을 더하는 증착, 오른쪽은 전기적 특성을 조절하는 이온 주입입니다. 두 그림은 연속 작업 순서가 아닙니다.", observe: "막 두께 검사와 전기적 특성 검사를 서로 바꿔 해석하지 마세요." },
    en: { labels: ["Deposition: new film", "Implantation: ions", "Different checks"], explanation: "Left: a deposited film. Right: ion introduction to modify electrical properties. These are separate concepts, not consecutive steps.", observe: "Film-thickness and electrical-property measurements are not interchangeable." },
    ja: { labels: ["成膜：表面に新しい膜", "注入：内部にイオン", "目的・検査も異なる"], explanation: "左は表面に膜を加える成膜、右は電気特性を調整するイオン注入です。連続した作業順序ではありません。", observe: "膜厚検査と電気特性検査を入れ替えて解釈しないでください。" },
  },
  metal: {
    ko: { labels: ["소자", "배선·층간 연결", "절연 영역"], explanation: "금속 경로가 소자를 연결하고 절연 영역이 불필요한 연결을 막습니다. 여러 층의 연결을 단순화한 단면입니다.", observe: "배선이 보이는 것과 전기적으로 정상 연결된 것은 구분하세요." },
    en: { labels: ["Devices", "Lines + vias", "Insulation"], explanation: "Metal paths connect devices while insulation separates unwanted connections. This is a simplified multilayer cross-section.", observe: "A visible metal line does not prove a sound electrical connection." },
    ja: { labels: ["素子", "配線・層間接続", "絶縁領域"], explanation: "金属の経路で素子をつなぎ、絶縁領域で不要な接続を防ぎます。多層接続を単純化した断面です。", observe: "配線が見えることと電気的に正常につながることは区別しましょう。" },
  },
  eds: {
    ko: { labels: ["웨이퍼 위 칩", "프로브 접촉 검사", "칩별 결과 맵"], explanation: "웨이퍼 위 개별 칩을 전기적으로 검사하고 위치별 결과를 남깁니다. 오른쪽 색은 결과 구분의 예시이며 실제 검사 데이터가 아닙니다.", observe: "칩의 검사 결과만으로 제조 장비의 고장 원인을 확정할 수 없습니다." },
    en: { labels: ["Dies on a wafer", "Probe contact", "Die-result map"], explanation: "Electrical checks produce location-specific die results. Map colors illustrate result categories, not real test data.", observe: "Die results alone cannot establish the cause of a manufacturing-equipment fault." },
    ja: { labels: ["ウェーハ上のチップ", "プローブ接触検査", "チップ別の結果マップ"], explanation: "各チップを電気的に検査し、位置ごとの結果を残します。右の色は分類例で、実際の検査データではありません。", observe: "チップ検査だけでは製造装置の故障原因を確定できません。" },
  },
  packaging: {
    ko: { labels: ["개별 칩", "외부 연결", "보호 구조"], explanation: "칩과 외부 단자를 연결하고 보호 구조로 감쌉니다. 와이어 연결 방식의 개념 예시이며 패키지마다 구조가 다릅니다.", observe: "외관과 전기적 연결은 서로 다른 항목으로 확인하세요." },
    en: { labels: ["Individual die", "External connection", "Protection"], explanation: "A die connects to external terminals inside a protective structure. This wire-bond example does not represent every package type.", observe: "Inspect appearance and electrical connections as separate evidence." },
    ja: { labels: ["個別のチップ", "外部への接続", "保護構造"], explanation: "チップを外部端子につなぎ、保護構造で包みます。ワイヤ接続方式の概念例で、構造はパッケージにより異なります。", observe: "外観と電気的接続を別の項目として確認しましょう。" },
  },
} as const satisfies Record<ProcessLessonId, Record<"ko" | "en" | "ja", VisualCopy>>;
