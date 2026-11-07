import type { LocalizedText, ProcessId } from "@shared/processScenarios";

export const depositionStages = { etched: 0, cvd: .12, mask: .56, implant: .66 } as const;
export const metalStages = { liner: 0, fill: .20, planarize: .40, trench: .56, route: .76, copperPolish: .90 } as const;

export type ProcessGuideStep = {
  id: string;
  start: number;
  snapshot: number;
  title: LocalizedText;
  detail: LocalizedText;
};

export const processGuides: Partial<Record<ProcessId, readonly ProcessGuideStep[]>> = {
  deposition: [
    { id: "etched", start: depositionStages.etched, snapshot: 0,
      title: ["식각 뒤 단차", "Etched profile", "エッチング後の段差"],
      detail: ["감광막을 걷어낸 단면에서 남은 패턴의 윗면·옆벽·바닥을 살펴봐요.", "With the resist removed, look for the tops, sidewalls, and floors of the remaining pattern.", "レジストを除去した断面で、残ったパターンの上面・側壁・底面を見ます。"] },
    { id: "cvd", start: depositionStages.cvd, snapshot: .55,
      title: ["CVD 박막 형성", "CVD film formation", "CVDによる成膜"],
      detail: ["이 예에서는 노출된 단차 표면에 얇은 막이 더해져요. 원래 층과 새 막의 경계를 따라가 보세요.", "In this example a thin film coats the exposed profile. Follow the boundary between the original layers and the new film.", "この例では、露出した段差の表面に薄い膜が形成されます。元の層と新しい膜の境界をたどりましょう。"] },
    { id: "mask", start: depositionStages.mask, snapshot: .58,
      title: ["별도 이온주입 시편", "Separate implant sample", "イオン注入用の別の試料"],
      detail: ["다른 실리콘 시편의 마스크가 주입할 위치를 정해요. 어느 부분이 열려 있는지 확인해요.", "A mask on a separate silicon sample defines where ions can enter. Find the openings.", "別のシリコン試料にあるマスクが、イオンを注入する位置を決めます。開口部を確認しましょう。"] },
    { id: "implant", start: depositionStages.implant, snapshot: 1,
      title: ["실리콘 안에 이온주입", "Ion implantation into silicon", "シリコンへのイオン注入"],
      detail: ["마스크의 열린 부분 아래에 들어간 도펀트 분포를 살펴봐요. 윗면 높이는 그대로예요.", "Look for the dopant distribution inside silicon under the openings. The surface height stays the same.", "開口部の下で、シリコン内部のドーパント分布を見ます。表面の高さは変わりません。"] },
  ],
  metal: [
    { id: "liner", start: metalStages.liner, snapshot: metalStages.fill,
      title: ["W 라이너 · PVD", "W liner · PVD", "Wライナー・PVD"],
      detail: ["얇은 텅스텐 막이 접점 구멍의 벽과 바닥을 덮고, 안쪽 공간은 열려 있어요.", "A thin tungsten layer coats the contact walls and floors, leaving space inside.", "薄いタングステン膜がコンタクト穴の側壁と底面を覆い、内部に空間が残ります。"] },
    { id: "fill", start: metalStages.fill, snapshot: metalStages.planarize,
      title: ["W 접점 충전 · CVD", "W contact fill · CVD", "Wコンタクト充填・CVD"],
      detail: ["CVD로 텅스텐을 채워 세로 접점을 만들어요. 윗면에도 여분의 금속이 남아요.", "CVD fills the openings with tungsten to form vertical contacts. Excess metal remains on the field.", "CVDで開口部をタングステンで埋め、縦方向のコンタクトを作ります。上面にも余分な金属が残ります。"] },
    { id: "planarize", start: metalStages.planarize, snapshot: metalStages.trench,
      title: ["W 표면 평탄화 · CMP", "W planarization · CMP", "W表面の平坦化・CMP"],
      detail: ["윗면의 여분 금속을 연마해 걷어내고, 구멍 안에 채워진 접점이 남아요.", "Polishing removes the excess metal at the surface and leaves tungsten in the contacts.", "表面の余分な金属を研磨して取り除き、穴の中に埋め込まれたコンタクトを残します。"] },
    { id: "trench", start: metalStages.trench, snapshot: metalStages.route,
      title: ["배선 홈과 밑막", "Trench and seed layers", "配線溝と下地膜"],
      detail: ["새 절연층에 배선 홈을 내고, 확산 방지막과 도금이 시작될 시드층을 입혀요.", "A trench is etched into a new dielectric layer and lined with a diffusion barrier and a seed layer for plating.", "新しい絶縁層に配線溝を作り、拡散バリア膜と、めっきの起点となるシード層を形成します。"] },
    { id: "route", start: metalStages.route, snapshot: 1,
      title: ["Cu 배선 완성", "Completed copper route", "Cu配線の完成"],
      detail: ["구리로 홈을 채운 뒤 윗면의 여분을 CMP로 걷어내요. 홈 안에 남은 구리선이 두 접점을 이어요.", "Copper fills the trench, then CMP removes the excess above it. The copper left in the trench connects two contacts.", "溝に銅を埋め込み、CMPで上面の余分を除去します。溝に残った銅配線が二つのコンタクトをつなぎます。"] },
  ],
};

export const guideHeading = ["공정 단면 단계", "Process cross-section steps", "工程断面のステップ"] as const;
export const guideReplay = ["단계를 눌러 단면을 다시 볼 수 있어요.", "Select a step to revisit its cross-section.", "ステップを選ぶと、その断面を見直せます。"] as const;
