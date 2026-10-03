import type { LocalizedText, ProcessId } from "./processScenarios";

type EquipmentContext = { name: string; context: LocalizedText; distinction: LocalizedText; sources: { name: string; url: string }[] };
// Public product examples explain equipment types, not the origin of our synthetic traces.
export const processEquipment: Record<ProcessId, EquipmentContext> = {
  wafer: {
    name: "KLA Surfscan SP7XP / PWG5",
    context: ["Surfscan은 패턴이 없는 웨이퍼의 표면 결함 검사, PWG는 웨이퍼 형상 계측에 연결되는 장비 사례입니다.", "Surfscan illustrates unpatterned-wafer surface inspection; PWG illustrates wafer geometry metrology.", "Surfscanはパターンのないウェーハの表面欠陥検査、PWGはウェーハ形状計測の装置例です。"],
    distinction: ["표면 검사와 형상 기록은 서로 다른 근거입니다. 이 연습의 표면·두께 상대지수는 제조사의 측정 출력이 아닙니다.", "Surface inspection and geometry are different evidence. The exercise's surface and thickness indices are not manufacturer measurement outputs.", "表面検査と形状記録は異なる根拠です。この練習の表面・厚さの相対指数はメーカーの測定出力ではありません。"],
    sources: [{ name: "KLA · Surfscan SP7XP / PWG5", url: "https://ir.kla.com/news-events/press-releases/detail/390/kla-introduces-two-new-systems-that-take-on-semiconductor" }],
  },
  oxidation: {
    name: "Tokyo Electron TELINDY PLUS",
    context: ["열처리 플랫폼의 산화·어닐링 용도를 통해 산화 공정 장비의 역할을 이해합니다.", "Its oxidation and annealing applications illustrate the role of thermal-processing equipment.", "熱処理プラットフォームの酸化・アニール用途から、酸化工程の装置の役割を理解します。"],
    distinction: ["조건이 달라지면 정상 참고도 달라질 수 있습니다. 연습의 온도·막 기록은 가상이며 실제 운전 조건이 아닙니다.", "Different conditions can need different normal references. The temperature and film records are fictional, not operating conditions.", "条件が異なれば正常参照も変わり得ます。温度・膜の記録は仮想で、実際の運転条件ではありません。"],
    sources: [{ name: "Tokyo Electron · TELINDY series", url: "https://www.tel.com/product/telindy.html" }],
  },
  photo: {
    name: "ASML TWINSCAN NXT:2100i",
    context: ["DUV 노광 장비의 패턴 형성과 정렬·오버레이 개념을 살펴보는 공개 장비 사례입니다.", "This DUV lithography example introduces pattern formation, alignment, and overlay concepts.", "DUV露光装置のパターン形成、位置合わせ、オーバーレイの概念を確認する公開装置例です。"],
    distinction: ["연습은 위치와 형상 검사 기록을 비교합니다. 노광 장비와 후속 검사 기록은 구분하며 실제 스캐너 출력을 재현하지 않습니다.", "Practice compares position and shape inspection records. Exposure equipment and subsequent inspection evidence are distinct; no scanner output is reproduced.", "位置と形状の検査記録を比較します。露光装置と後続の検査記録を区別し、実際のスキャナー出力を再現しません。"],
    sources: [{ name: "ASML · TWINSCAN NXT:2100i", url: "https://www.asml.com/en/products/duv-lithography-systems/twinscan-nxt2100i" }],
  },
  etch: {
    name: "Lam Research Kiyo",
    context: ["일반적인 플라즈마 식각 개념과 연결되는 도체 식각 장비 사례입니다.", "A conductor-etch equipment example connected to general plasma-etch concepts.", "一般的なプラズマエッチングの概念につながる導体エッチング装置例です。"],
    distinction: ["단계별 압력·유량·전력·온도는 교육용 상대지수이며 Kiyo 로그나 운전 기준이 아닙니다.", "Phase-based pressure, flow, power and temperature are teaching indices, not Kiyo logs or operating limits.", "段階別の圧力・流量・電力・温度は教育用の相対指数で、Kiyoのログや運転基準ではありません。"],
    sources: [{ name: "Lam Research · Kiyo", url: "https://www.lamresearch.com/product/kiyo-product-family/" }],
  },
  deposition: {
    name: "Tokyo Electron TELINDY / Applied Materials VIISta Trident",
    context: ["TELINDY의 성막 용도와 VIISta의 이온 주입 용도는 서로 다른 공정 역할의 장비 사례입니다.", "TELINDY film deposition and VIISta ion implantation illustrate distinct equipment roles.", "TELINDYの成膜とVIIStaのイオン注入は、異なる工程の役割を持つ装置例です。"],
    distinction: ["막 형성 기록과 전기적 특성 기록을 함께 비교하되, 하나의 장비가 두 기록을 모두 측정했다고 보지 않습니다.", "Compare film-formation and electrical-property evidence without assuming a single instrument measures both.", "膜形成と電気特性の記録を比較しますが、一つの装置が両方を測定したとは考えません。"],
    sources: [{ name: "Tokyo Electron · deposition platforms", url: "https://www.tel.com/product/telindy.html" }, { name: "Applied Materials · VIISta Trident", url: "https://www.appliedmaterials.com/us/en/product-library/viista-trident.html" }],
  },
  metal: {
    name: "Applied Materials Endura Ioniq W PVD",
    context: ["금속 접점과 배선 형성에 연결되는 증착 장비 사례로, 구조와 전기적 연결의 맥락을 살펴봅니다.", "A deposition-equipment example for metal contacts and interconnects provides context for structures and electrical connections.", "金属接点・配線形成につながる成膜装置例から、構造と電気的接続の背景を確認します。"],
    distinction: ["연습의 외관·연결 검사 지수는 후속 비교용 가상 기록입니다. PVD 장비가 이 두 값을 직접 측정한다고 주장하지 않습니다.", "Appearance and connection indices are fictional subsequent-inspection evidence, not claimed PVD instrument outputs.", "外観・接続検査の指数は後続比較用の仮想記録で、PVD装置の直接測定出力ではありません。"],
    sources: [{ name: "Applied Materials · Endura Ioniq W PVD", url: "https://www.appliedmaterials.com/eu/en/product-library/endura-ioniq-w-pvd.html" }],
  },
  eds: {
    name: "Advantest V93000",
    context: ["웨이퍼 단계와 최종 전기 검사에 사용되는 반도체 테스트 시스템 사례입니다. 테스트 시스템과 웨이퍼 프로버는 역할이 다릅니다.", "A semiconductor test-system example spanning wafer sort and final electrical test. A tester and wafer prober have different roles.", "ウェーハソートと最終電気検査に対応する半導体テストシステムの例です。テスターとウェーハプローバーは役割が異なります。"],
    distinction: ["연습의 재생 위치는 검사 구역을 펼치는 순서입니다. 실제 생산 시간이나 V93000 측정 파일이 아닙니다.", "Playback unfolds inspection regions; it is not production time or a V93000 measurement file.", "再生位置は検査領域を表示する順序です。実際の生産時間やV93000の測定ファイルではありません。"],
    sources: [{ name: "Advantest · V93000", url: "https://www.advantest.com/en/products/semiconductor-test-system/soc/v93000/" }],
  },
  packaging: {
    name: "ASMPT Eagle AERO",
    context: ["와이어 본딩은 칩과 외부 연결을 만드는 패키징 기술 중 하나입니다. Eagle AERO는 이를 이해하기 위한 장비 사례입니다.", "Wire bonding is one packaging technology for connecting a chip externally. Eagle AERO is a public equipment example.", "ワイヤーボンディングはチップと外部を接続するパッケージ技術の一つです。Eagle AEROはその装置例です。"],
    distinction: ["연결·외관 검사와 형성 장비의 상태는 같은 근거가 아닙니다. 연습 지수는 실제 본더의 신호나 설정값이 아닙니다.", "Connection and appearance inspection are distinct from equipment-state evidence. Exercise indices are not bonder signals or settings.", "接続・外観検査と形成装置の状態は同じ根拠ではありません。練習の指数は実際のボンダー信号や設定値ではありません。"],
    sources: [{ name: "ASMPT · Eagle AERO", url: "https://semi.asmpt.com/en/products/icd/wb/ball-bonding/eagle-aero/" }],
  },
};
