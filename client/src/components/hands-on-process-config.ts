import type { GenericHandsOnProcess } from "../../../shared/processHandsOn";
type Copy = readonly [string, string, string];
type ConceptStep = { label: Copy; detail: Copy };
type ConceptConfig = {
  steps: readonly ConceptStep[];
  hints: readonly Copy[];
  complete: Copy;
  guide: Copy;
};
export const handsOnProcessConfig: Record<
  GenericHandsOnProcess,
  ConceptConfig
> = {
  wafer: {
    steps: [
      {
        label: ["웨이퍼 올리기", "Load wafer", "ウェーハを載せる"],
        detail: [
          "검사 위치로 옮겨요.",
          "Move to the inspection position.",
          "検査位置へ移動します。",
        ],
      },
      {
        label: ["검사 빛 켜기", "Turn on inspection light", "検査光を入れる"],
        detail: [
          "표면에 빛을 비춰요.",
          "Illuminate the surface.",
          "表面に光を当てます。",
        ],
      },
      {
        label: ["스캔 준비", "Prepare scan", "走査を準備"],
        detail: [
          "살펴볼 경로를 준비해요.",
          "Prepare the inspection path.",
          "観察する経路を準備します。",
        ],
      },
      {
        label: [
          "표면·형상 살펴보기",
          "Inspect surface and geometry",
          "表面・形状を観察",
        ],
        detail: [
          "빛의 이동과 확대 단면을 비교해요.",
          "Compare the moving light and enlarged section.",
          "光の移動と拡大断面を比べます。",
        ],
      },
    ],
    hints: [
      [
        "웨이퍼를 올려 검사부터 경험해 보세요.",
        "Load the wafer to explore inspection.",
        "ウェーハを載せて検査を体験しましょう。",
      ],
      [
        "검사 빛을 켜 표면을 비춰보세요.",
        "Turn on the inspection light.",
        "検査光を入れて表面を照らしましょう。",
      ],
      [
        "빛이 지나갈 스캔 경로를 준비하세요.",
        "Prepare a path for the scanning light.",
        "光が通る走査経路を準備しましょう。",
      ],
      [
        "스캔을 시작해 표면과 형상 표현을 함께 보세요.",
        "Start scanning and observe surface and geometry illustrations.",
        "走査を始めて表面と形状の図を観察しましょう。",
      ],
    ],
    complete: [
      "검사·계측의 역할을 살펴봤어요. 표시된 점과 형상은 설명용 예시예요.",
      "You explored inspection and metrology. Points and geometry are illustrative examples.",
      "検査・計測の役割を体験しました。点と形状は説明用の例です。",
    ],
    guide: ["비교 가이드", "Comparison guide", "比較ガイド"],
  },
  oxidation: {
    steps: [
      {
        label: [
          "웨이퍼 보트 넣기",
          "Load wafer boat",
          "ウェーハボートを入れる",
        ],
        detail: [
          "여러 장의 웨이퍼가 함께 들어가요.",
          "Load multiple wafers together.",
          "複数のウェーハを一緒に入れます。",
        ],
      },
      {
        label: ["반응 공간 닫기", "Close process space", "反応空間を閉じる"],
        detail: [
          "열처리를 준비해요.",
          "Prepare for thermal processing.",
          "熱処理を準備します。",
        ],
      },
      {
        label: [
          "산소 분위기 준비",
          "Prepare oxygen atmosphere",
          "酸素雰囲気を準備",
        ],
        detail: [
          "표면 반응에 필요한 분위기를 만들어요.",
          "Prepare the atmosphere for the surface reaction.",
          "表面反応の雰囲気を準備します。",
        ],
      },
      {
        label: ["산화막 성장 보기", "Watch oxide growth", "酸化膜の成長を見る"],
        detail: [
          "실리콘 표면의 층이 변해요.",
          "Watch the layer at the silicon surface change.",
          "シリコン表面の層が変わります。",
        ],
      },
    ],
    hints: [
      [
        "웨이퍼 보트를 열처리 공간으로 넣어보세요.",
        "Load the wafer boat into the thermal process space.",
        "ウェーハボートを熱処理空間へ入れましょう。",
      ],
      [
        "반응 공간을 닫아 다음 단계를 준비하세요.",
        "Close the process space for the next step.",
        "反応空間を閉じて次の段階を準備しましょう。",
      ],
      [
        "산소 분위기를 준비해 보세요.",
        "Prepare the oxygen atmosphere.",
        "酸素雰囲気を準備しましょう。",
      ],
      [
        "시작하면 확대 단면에서 산화막이 자라요.",
        "Start and observe oxide growth in the enlarged section.",
        "開始すると拡大断面で酸化膜が成長します。",
      ],
    ],
    complete: [
      "산화막이 자라는 모습을 확인했어요. 두께와 진행 속도는 개념 표현이에요.",
      "You observed oxide growth. Thickness and progress speed are conceptual.",
      "酸化膜の成長を確認しました。厚さと進行速度は概念表現です。",
    ],
    guide: ["처음 표면 가이드", "Original surface guide", "元の表面ガイド"],
  },
  deposition: {
    steps: [
      {
        label: ["웨이퍼 넣기", "Load wafer", "ウェーハを入れる"],
        detail: [
          "선택한 공정 공간으로 옮겨요.",
          "Move into the selected process space.",
          "選んだ工程の空間へ移動します。",
        ],
      },
      {
        label: ["공급원 준비", "Prepare source", "供給源を準備"],
        detail: [
          "성막 원료 또는 이온 빔을 준비해요.",
          "Prepare film precursor or an ion beam.",
          "成膜原料またはイオンビームを準備します。",
        ],
      },
      {
        label: ["진행 준비", "Prepare process", "工程を準備"],
        detail: [
          "그림의 관찰 구역을 선택할 수 있어요.",
          "You can select an observation area in the diagram.",
          "図の観察領域を選べます。",
        ],
      },
      {
        label: [
          "선택한 공정 진행",
          "Run selected process",
          "選んだ工程を進める",
        ],
        detail: [
          "표면의 막과 내부 이온의 차이를 보세요.",
          "Observe surface film versus ions inside silicon.",
          "表面の膜と内部のイオンの違いを見ます。",
        ],
      },
    ],
    hints: [
      [
        "성막 또는 이온 주입을 고르고 웨이퍼를 넣어보세요.",
        "Choose film deposition or implantation, then load the wafer.",
        "成膜かイオン注入を選び、ウェーハを入れましょう。",
      ],
      [
        "선택한 공정의 공급원을 준비하세요.",
        "Prepare the source for the selected process.",
        "選んだ工程の供給源を準備しましょう。",
      ],
      [
        "관찰 구역을 선택하고 진행을 준비하세요.",
        "Select an observation area and prepare to run.",
        "観察領域を選び、工程を準備しましょう。",
      ],
      [
        "시작해 표면에 쌓이는 막 또는 내부로 들어가는 이온을 보세요.",
        "Start to see surface film growth or ions entering silicon.",
        "開始して表面に積もる膜か内部へ入るイオンを見ましょう。",
      ],
    ],
    complete: [
      "두 공정의 역할을 구분해 봤어요. 모드를 바꾸면 새 체험으로 시작해요.",
      "Explore the distinct process roles. Switching modes starts a new exercise.",
      "工程の役割を体験しました。モード変更で新しく始まります。",
    ],
    guide: ["처음 표면 가이드", "Original surface guide", "元の表面ガイド"],
  },
  metal: {
    steps: [
      {
        label: ["웨이퍼 넣기", "Load wafer", "ウェーハを入れる"],
        detail: [
          "접촉부 단면을 함께 보세요.",
          "Observe the contact section.",
          "コンタクト断面も観察します。",
        ],
      },
      {
        label: ["플라스마 준비", "Prepare plasma", "プラズマを準備"],
        detail: [
          "금속 원자를 공급할 준비예요.",
          "Prepare to supply metal atoms.",
          "金属原子を供給する準備です。",
        ],
      },
      {
        label: ["타깃 준비", "Prepare target", "ターゲットを準備"],
        detail: [
          "타깃과 웨이퍼의 위치를 확인해요.",
          "Observe the target and wafer positions.",
          "ターゲットとウェーハの位置を見ます。",
        ],
      },
      {
        label: [
          "금속막 형성 보기",
          "Watch metal film formation",
          "金属膜の形成を見る",
        ],
        detail: [
          "원자가 표면으로 이동해 막을 만들어요.",
          "Atoms travel to the surface and form film.",
          "原子が表面へ移動し膜を作ります。",
        ],
      },
    ],
    hints: [
      [
        "웨이퍼를 넣고 접촉부 단면을 확인하세요.",
        "Load the wafer and inspect the contact section.",
        "ウェーハを入れてコンタクト断面を見ましょう。",
      ],
      [
        "플라스마를 준비해 보세요.",
        "Prepare the plasma.",
        "プラズマを準備しましょう。",
      ],
      [
        "타깃을 준비하고 관찰 구역을 골라보세요.",
        "Prepare the target and select an observation area.",
        "ターゲットを準備し観察領域を選びましょう。",
      ],
      [
        "시작하면 금속 원자가 이동하며 막이 형성돼요.",
        "Start to see atoms travel and metal film form.",
        "開始すると金属原子が移動し膜が形成されます。",
      ],
    ],
    complete: [
      "금속막·접촉부 형성의 개념이에요. 배선 전체의 완성이나 전기적 성능을 판정하지 않아요.",
      "This illustrates metal film and contact formation, without certifying completed interconnects or electrical performance.",
      "金属膜・コンタクト形成の概念です。配線全体の完成や電気性能を判定しません。",
    ],
    guide: ["처음 단면 가이드", "Original section guide", "元の断面ガイド"],
  },
  eds: {
    steps: [
      {
        label: ["웨이퍼 올리기", "Load wafer", "ウェーハを載せる"],
        detail: [
          "그림에서 검사할 칩을 고를 수 있어요.",
          "Select a die in the diagram.",
          "図で調べるチップを選べます。",
        ],
      },
      {
        label: ["프로브 접촉", "Contact probes", "プローブを接触"],
        detail: [
          "프로버가 칩 접점을 연결해요.",
          "The prober connects to die contacts.",
          "プローバーがチップ接点に接触します。",
        ],
      },
      {
        label: ["테스터 준비", "Prepare tester", "テスターを準備"],
        detail: [
          "테스터와 프로버의 역할을 구분해요.",
          "Distinguish tester and prober roles.",
          "テスターとプローバーの役割を区別します。",
        ],
      },
      {
        label: [
          "가상 신호 확인",
          "Explore illustrative signals",
          "仮想信号を確認",
        ],
        detail: [
          "선택한 칩과 신호의 연결을 봐요.",
          "Observe the selected die and signal connection.",
          "選んだチップと信号の関係を見ます。",
        ],
      },
    ],
    hints: [
      [
        "웨이퍼를 올려 전기 검사 흐름을 체험해 보세요.",
        "Load the wafer to explore electrical testing.",
        "ウェーハを載せて電気検査を体験しましょう。",
      ],
      [
        "그림에서 칩을 고른 다음 프로브를 접촉하세요.",
        "Choose a die in the diagram, then contact the probes.",
        "図でチップを選びプローブを接触させましょう。",
      ],
      [
        "선택한 칩을 확인하고 테스터를 준비하세요.",
        "Confirm your die selection and prepare the tester.",
        "選んだチップを確認しテスターを準備しましょう。",
      ],
      [
        "시작하면 선택한 칩의 설명용 신호가 나타나요.",
        "Start to display illustrative signals for the selected die.",
        "開始すると選んだチップの説明用信号が表示されます。",
      ],
    ],
    complete: [
      "테스터와 프로버의 역할을 확인했어요. 신호는 설명용이며 합불·수율 결과가 아니에요.",
      "You explored tester and prober roles. Signals are illustrative, not pass/fail or yield results.",
      "テスターとプローバーの役割を確認しました。信号は説明用で合否・歩留まり結果ではありません。",
    ],
    guide: ["연결 가이드", "Connection guide", "接続ガイド"],
  },
  packaging: {
    steps: [
      {
        label: ["칩 배치하기", "Place die", "チップを置く"],
        detail: [
          "패키지 안에 칩을 올려요.",
          "Place the die in the package.",
          "パッケージ内にチップを置きます。",
        ],
      },
      {
        label: [
          "본딩 패드 확인",
          "Check bonding pads",
          "ボンディングパッドを確認",
        ],
        detail: [
          "그림에서 연결할 위치를 골라요.",
          "Select a connection in the diagram.",
          "図で接続位置を選びます。",
        ],
      },
      {
        label: ["본딩 준비", "Prepare bonding", "ボンディングを準備"],
        detail: [
          "도구와 연결 위치를 맞춰요.",
          "Position the tool at the selected connection.",
          "道具と選んだ接続位置を合わせます。",
        ],
      },
      {
        label: ["와이어 연결하기", "Connect bonding wire", "ワイヤを接続"],
        detail: [
          "칩 패드에서 외부 단자로 이어져요.",
          "Connect a die pad to the package terminal.",
          "チップパッドから外部端子へ接続します。",
        ],
      },
    ],
    hints: [
      [
        "칩을 올려 와이어 본딩을 시작해 보세요.",
        "Place the die to explore wire bonding.",
        "チップを置いてワイヤボンディングを体験しましょう。",
      ],
      [
        "그림 속 패드를 골라 연결 위치를 바꿔보세요.",
        "Choose a pad in the diagram to change the connection.",
        "図のパッドを選び接続位置を変えましょう。",
      ],
      [
        "패드를 확인하고 본딩 도구를 준비하세요.",
        "Confirm the pad and prepare the bonding tool.",
        "パッドを確認しボンディング道具を準備しましょう。",
      ],
      [
        "시작하면 선택한 패드에서 와이어가 이어져요.",
        "Start to connect wire from the selected pad.",
        "開始すると選んだパッドからワイヤが接続されます。",
      ],
    ],
    complete: [
      "와이어가 칩과 외부 단자를 연결했어요. 몰딩은 별도의 후속 공정이에요.",
      "The wire connects die and package terminal. Molding is a separate subsequent process.",
      "ワイヤがチップと外部端子を接続しました。モールディングは別の後続工程です。",
    ],
    guide: ["연결 경로 가이드", "Connection path guide", "接続経路ガイド"],
  },
};
