import type {ProcessId} from "@shared/processScenarios";
import type {ProcessContent} from "./studio-types";
/** Equipment roles: official primary sources. Questions: educational suggestions, not operating procedures. All inspection records are synthetic. Reviewed independently in English and Japanese. */
export const studioContent:Record<ProcessId,ProcessContent>={
  "wafer": {
    "id": "wafer",
    "name": [
      "웨이퍼 제조",
      "Wafer preparation",
      "ウェーハ製造"
    ],
    "headline": [
      "회로를 만들기 전, 바탕부터 살펴봐요.",
      "Before building a circuit, explore the wafer surface.",
      "回路を作る前に、土台となる表面を見てみましょう。"
    ],
    "question": [
      "표면이 매끈해 보이면, 두께도 같을까요?",
      "Does a smooth-looking surface also have uniform thickness?",
      "表面が滑らかに見えれば、厚さも均一でしょうか？"
    ],
    "objective": [
      "이번 체험에서는 웨이퍼 표면을 다듬는 원리와, 표면·두께 검사의 서로 다른 역할을 알아봐요.",
      "Explore surface polishing and the different roles of surface and thickness inspection.",
      "表面を磨く原理と、表面検査・厚さ検査の役割の違いを学びます。"
    ],
    "steps": [
      [
        "웨이퍼 옮기기",
        "Transfer the wafer",
        "ウェーハを搬送する"
      ],
      [
        "연마 헤드 내리기",
        "Lower the polishing head",
        "研磨ヘッドを下げる"
      ],
      [
        "검사 헤드 준비",
        "Reveal the inspection head",
        "検査ヘッドを表示する"
      ]
    ],
    "parameterLabel": [
      "표면 관찰 위치",
      "Surface viewing position",
      "表面の観察位置"
    ],
    "parameterHint": [
      "슬라이더를 움직여 검사 헤드가 레일을 따라 이동하는 모습과 표면의 관찰 위치를 함께 보세요.",
      "Move the slider to follow the inspection head along its rail and see where it scans the surface.",
      "スライダーを動かし、検査ヘッドがレールに沿って移動する様子と、表面の観察位置を見比べましょう。"
    ],
    "reaction": [
      "누르고 연마·검사 원리 관찰",
      "Hold to explore polishing and inspection",
      "押し続けて研磨・検査の原理を見る"
    ],
    "observe": [
      "같은 위치의 표면 기록과 두께 기록을 각각의 참고와 비교해보세요. 두 기록이 같은 이야기를 하는지도 살펴봐요.",
      "Compare surface and thickness records with their own references at the same location. Do both records support the same observation?",
      "同じ位置の表面記録と厚さ記録を、それぞれの参照と比べてください。二つの記録が同じ観察を裏付けるかも確認しましょう。"
    ],
    "lesson": [
      "연마는 표면의 요철을 줄이는 과정이에요. 표면이 평탄한지, 결함이 보이는지, 두께가 어떤지는 서로 다른 검사로 확인해요.",
      "Polishing reduces surface unevenness. Surface flatness, defects, and thickness require different types of inspection.",
      "研磨は表面の凹凸を小さくする工程です。平坦さ、見える欠陥、厚さは、それぞれ異なる検査項目です。"
    ],
    "review": [
      "이 기록에서는 표면 쪽 추세가 참고와 달라지는 동안 두께 기록은 참고 띠 안에 있어요. 표면의 변화만으로 두께 이상이나 특정 장비 고장을 함께 확정할 수는 없어요.",
      "Here, the surface record differs from its reference while the thickness record stays within its reference band. A surface change alone does not establish a thickness problem or an equipment fault.",
      "この記録では表面の傾向が参照と異なる一方、厚さは基準帯内にあります。表面の変化だけで、厚さの異常や特定の装置故障まで確定することはできません。"
    ],
    "parts": [
      {
        "id": "load",
        "name": [
          "웨이퍼 이송",
          "Wafer transfer",
          "ウェーハ搬送"
        ],
        "description": [
          "이송 포크가 얇은 웨이퍼를 연마 헤드 아래로 옮겨요. 헤드가 웨이퍼를 잡으면 포크가 원래 자리로 돌아가요.",
          "The transfer fork carries the thin wafer beneath the polishing head. Once the head holds the wafer, the fork retracts.",
          "搬送フォークが薄いウェーハを研磨ヘッドの下へ運びます。ヘッドがウェーハを保持すると、フォークは元の位置に戻ります。"
        ]
      },
      {
        "id": "process",
        "name": [
          "연마 헤드와 패드",
          "Polishing head and pad",
          "研磨ヘッドとパッド"
        ],
        "description": [
          "구동축이 연마 헤드를 돌리고, 헤드 아래 웨이퍼가 회전 패드에 맞닿아요. 이 모형에서는 별도 공급부에서 노즐로 연마액을 보내 패드 중앙 가까이에 떨어뜨려요.",
          "The drive shaft turns the polishing head, and the wafer held beneath it contacts the rotating pad. Here, a separate supply feeds the nozzle, which dispenses slurry near the center of the pad.",
          "駆動軸が研磨ヘッドを回し、その下に保持されたウェーハが回転するパッドに接します。この模型では、別の供給部からノズルへスラリーを送り、パッドの中心付近に滴下します。"
        ]
      },
      {
        "id": "inspect",
        "name": [
          "표면 검사 위치",
          "Surface inspection area",
          "表面の検査位置"
        ],
        "description": [
          "웨이퍼 표면의 작은 부분을 확대했어요. 높낮이는 연마 전후 차이가 보이도록 크게 표시했어요.",
          "This is a magnified view of a small patch of the wafer surface. The height variations are exaggerated so you can compare the surface before and after polishing.",
          "ウェーハ表面の一部を拡大しています。研磨前後の違いが分かるように、高さの差を強調しています。"
        ]
      },
      {
        "id": "dicing",
        "name": ["후공정 예시 · 절단한 다이", "Later example · separated dies", "後工程の例・分割したダイ"],
        "description": [
          "회로를 만든 웨이퍼를 절단해 다이로 나눈 예시예요. 테이프가 다이를 받치고, 각 다이에는 회로 배선과 접속 패드를 확대해 표시했어요.",
          "This example shows dies separated by dicing a patterned wafer. Tape holds the dies, whose surfaces show enlarged examples of wiring and bond pads.",
          "回路を形成したウェーハを切断して、ダイに分けた例です。テープがダイを支え、各ダイの配線と接続パッドを拡大して示しています。"
        ]
      }
    ],
    "equipment": [
      {
        "name": "EBARA F-REX",
        "role": [
          "웨이퍼 표면을 화학적·기계적으로 연마하는 CMP 장비 사례예요. 웨이퍼 제조 전체를 대표하는 장비는 아니에요.",
          "An example of a CMP system that polishes wafer surfaces using chemical and mechanical action. It does not represent the entire wafer-manufacturing process.",
          "ウェーハ表面を化学的・機械的に研磨するCMP装置の例です。ウェーハ製造の全工程を代表するものではありません。"
        ],
        "question": [
          "어느 표면을 다듬었고, 결과를 어떤 위치에서 검사했는지 확인해보세요.",
          "Which surface was polished, and where was the result inspected?",
          "どの表面を磨き、結果をどの位置で検査したか確認しましょう。"
        ],
        "sourceTitle": "EBARA · F-REX",
        "url": "https://www.ebara.com/global-en/products/FREX/"
      },
      {
        "name": "KLA Surfscan SP7XP / PWG5",
        "role": [
          "패턴이 없는 웨이퍼의 결함 검사와 형상 계측을 설명하는 장비 사례예요. 두 검사는 같은 정보가 아니에요.",
          "Examples of unpatterned-wafer defect inspection and wafer-geometry metrology. These provide different kinds of evidence.",
          "パターンのないウェーハの欠陥検査と形状計測の装置例です。二つの検査から得られる情報は異なります。"
        ],
        "question": [
          "표면 기록과 두께·형상 기록을 같은 측정으로 생각하지 않았나요?",
          "Have you kept surface evidence separate from thickness and geometry evidence?",
          "表面の記録を、厚さ・形状の記録と同じ測定だと考えていませんか？"
        ],
        "sourceTitle": "KLA · Surfscan / PWG",
        "url": "https://ir.kla.com/news-events/press-releases/detail/390/kla-introduces-two-new-systems-that-take-on-semiconductor"
      },
      {
        "name": "DISCO DDS2010",
        "role": [
          "완성된 웨이퍼의 다이를 분리하고, 다이 사이 간격을 유지한 채 테이프 프레임으로 옮기는 장비 사례예요.",
          "An example of equipment that separates dies and transfers them to a tape frame while preserving the gaps between them.",
          "ダイを分割し、間隔を維持したままテープフレームに移す装置の例です。"
        ],
        "question": [
          "연마 장면의 원판과 테이프 위 다이에서 표면과 가장자리의 차이를 찾아보세요.",
          "Compare the surfaces and edges of the disk being polished and the dies on tape.",
          "研磨する円板とテープ上のダイで、表面と縁の違いを見比べましょう。"
        ],
        "sourceTitle": "DISCO · DDS2010",
        "url": "https://www-hq.disco.co.jp/eg/products/separator/dds2010.html"
      }
    ]
  },
  "oxidation": {
    "id": "oxidation",
    "name": [
      "산화",
      "Oxidation",
      "酸化"
    ],
    "headline": [
      "얇은 산화막, 표면의 반응에서 시작돼요.",
      "An oxide film starts with a surface reaction.",
      "薄い酸化膜は、表面の反応から生まれます。"
    ],
    "question": [
      "검사값이 바뀌면, 정말 이상일까요?",
      "Does a changed reading necessarily mean a deviation?",
      "検査値が変われば、必ず異常なのでしょうか？"
    ],
    "objective": [
      "열과 산소가 실리콘 표면에 미치는 작용을 보고, 조건에 맞는 검사 참고를 선택해요.",
      "See how heat and oxygen help form oxide on silicon, then choose references that match the inspection conditions.",
      "加熱したシリコン表面で酸素が反応する様子を観察し、検査条件に合う参照記録を選びます。"
    ],
    "steps": [
      [
        "보트 올리기",
        "Raise the wafer boat",
        "ウェーハボートを上げる"
      ],
      [
        "산소 경로 살펴보기",
        "Explore the oxygen path",
        "酸素の経路を見る"
      ],
      [
        "히터와 반응관 확인",
        "Find the heater and reaction tube",
        "ヒーターと反応管を確認する"
      ]
    ],
    "parameterLabel": [
      "표면 관찰 위치",
      "Surface viewing position",
      "表面の観察位置"
    ],
    "parameterHint": [
      "산화막과 실리콘의 경계를 다른 위치에서 살펴봐요. 실제 온도나 산소 유량을 조절하지 않아요.",
      "Explore different points along the oxide–silicon interface. This does not set temperature or oxygen flow.",
      "酸化膜とシリコンの境界を、別の位置から見ます。実際の温度や酸素流量を調整する操作ではありません。"
    ],
    "reaction": [
      "누르고 산화 반응 관찰",
      "Hold to observe oxidation",
      "押し続けて酸化反応を見る"
    ],
    "observe": [
      "검사 묶음 A와 B를 각각 해당 참고와 비교해보세요. 관측값뿐 아니라 비교 기준이 함께 달라졌는지도 살펴봐요.",
      "Compare groups A and B with their corresponding references. Check whether the reference changes along with the reading.",
      "検査グループAとBを、それぞれに対応する参照と比べてください。観測値と一緒に比較基準も変わったか確認しましょう。"
    ],
    "lesson": [
      "건식 열산화에서는 산소가 기존 산화막을 지나 실리콘과 산화막의 경계에 도달해요. 그곳에서 실리콘 일부가 반응해 새 산화막이 생겨요.",
      "In dry thermal oxidation, oxygen travels through the existing oxide to the silicon–oxide interface. There it reacts with silicon, consuming some of it as new oxide forms.",
      "乾式熱酸化では、酸素が既存の酸化膜を通ってシリコンと酸化膜の界面に達します。そこでシリコンの一部が反応し、新しい酸化膜が形成されます。"
    ],
    "review": [
      "A에서 B로 넘어갈 때 관측값과 참고값이 함께 바뀌었어요. 이 기록은 각 묶음의 참고 띠 안에 있으므로, 숫자가 달라졌다는 이유만으로 이탈이라고 판단하지 않아요.",
      "Both readings and references change when the record switches from A to B. Each observed reading stays within its matching reference band, so a change in value alone does not indicate a deviation.",
      "AからBへの切替では、観測値と参照値が一緒に変わりました。各記録は対応する基準帯内にあるため、数値が変わっただけで偏差とは判断しません。"
    ],
    "parts": [
      {
        "id": "load",
        "name": [
          "웨이퍼 보트",
          "Wafer boat",
          "ウェーハボート"
        ],
        "description": [
          "여러 장의 웨이퍼를 지지하고 반응관 안으로 이동해요. 같은 보트에 있어도 검사 조건과 묶음 식별은 확인해야 해요.",
          "It supports multiple wafers and moves them into the reaction tube. You still need to identify inspection groups and conditions.",
          "複数のウェーハを支えて反応管へ運びます。同じボートでも、検査グループと条件の確認は必要です。"
        ]
      },
      {
        "id": "process",
        "name": [
          "히터와 산소 경로",
          "Heater and oxygen path",
          "ヒーターと酸素の経路"
        ],
        "description": [
          "산소가 가열된 웨이퍼 묶음 주변으로 흐르고, 남은 가스는 아래 배기구로 나가요. 확대 단면에서는 산소가 실리콘과 반응하는 경계를 살펴봐요.",
          "Oxygen flows around the heated wafer stack, and the remaining gas leaves through the lower exhaust. The enlarged section shows the interface where oxygen reacts with silicon.",
          "酸素が加熱したウェーハの束の周囲を流れ、残ったガスは下部の排気口から出ます。拡大断面では、酸素がシリコンと反応する界面を見ます。"
        ]
      },
      {
        "id": "inspect",
        "name": [
          "산화막 경계와 검사",
          "Oxide interface and inspection",
          "酸化膜の境界と検査"
        ],
        "description": [
          "산화막 형성 모형과 막 검사 지수는 역할이 달라요. 가상 지수를 실제 두께인 nm로 해석하지 않아요.",
          "The growth model and film-inspection index have different roles. The synthetic index is not a thickness in nanometers.",
          "膜形成の模型と膜検査指数は役割が異なります。仮想指数を、nm単位の実際の膜厚として解釈しません。"
        ]
      }
    ],
    "equipment": [
      {
        "name": "Tokyo Electron TELINDY PLUS",
        "role": [
          "산화·어닐링·성막에 사용하는 배치형 열처리 장비 사례예요. 이 모형은 건식 열산화 원리에 초점을 맞춰요.",
          "A batch thermal-processing platform used for oxidation, annealing, and deposition. This model focuses on dry thermal oxidation.",
          "酸化・アニール・成膜に使うバッチ式熱処理装置の例です。この模型では乾式熱酸化の原理に注目します。"
        ],
        "question": [
          "어느 배치·공정 방식의 결과인지 확인한 뒤 같은 조건의 참고를 골라보세요.",
          "Identify the batch and process type before choosing a matching reference.",
          "バッチと処理方式を確認してから、同じ条件の参照を選びましょう。"
        ],
        "sourceTitle": "Tokyo Electron · TELINDY PLUS",
        "url": "https://www.tel.com/product/telindy.html"
      },
      {
        "name": "HORIBA",
        "role": [
          "산화막 두께·계면·막 균일도 등을 평가하는 광학 측정의 사례예요. 열처리 장비와 측정 장비의 역할을 구분해요.",
          "An optical-metrology example for oxide thickness, interfaces, and film uniformity. Processing and measurement have distinct roles.",
          "酸化膜厚・界面・膜の均一性などを評価する光学計測の例です。熱処理装置と測定装置の役割を区別します。"
        ],
        "question": [
          "측정 항목·위치·단위와 참고 기준이 서로 맞는지 확인해보세요.",
          "Do the measurement type, location, and units match those of the reference record?",
          "測定項目・位置・単位と参照基準が対応しているか確認しましょう。"
        ],
        "sourceTitle": "HORIBA · Thin-film measurement",
        "url": "https://www.horiba.com/sgp/materials/material-types/raw-materials-for-semiconductors/film-thickness-measurement-for-semiconductor-raw-materials/"
      }
    ]
  },
  "photo": {
    "id": "photo",
    "name": [
      "포토",
      "Photolithography",
      "フォトリソグラフィ"
    ],
    "headline": [
      "빛으로 패턴을 옮기고, 위치를 확인해요.",
      "Transfer a pattern with light, then check its position.",
      "光でパターンを転写し、位置を確かめます。"
    ],
    "question": [
      "모양이 맞으면, 위치도 맞을까요?",
      "Can the shape be right while the position is wrong?",
      "形が合っていても、位置がずれていることはあるでしょうか？"
    ],
    "objective": [
      "마스크·빛·감광막의 역할을 보고, 패턴의 위치와 형상을 나누어 관찰해요.",
      "Explore the mask, light, and photoresist, then inspect pattern position separately from shape.",
      "マスク・光・フォトレジストの役割を見て、パターンの位置と形状を分けて観察します。"
    ],
    "steps": [
      [
        "웨이퍼 올리기",
        "Place the wafer",
        "ウェーハを載せる"
      ],
      [
        "마스크 위치 맞추기",
        "Position the mask",
        "マスクの位置を合わせる"
      ],
      [
        "광로 살펴보기",
        "Explore the optical path",
        "光路を見る"
      ]
    ],
    "parameterLabel": [
      "모형의 마스크 정렬 위치",
      "Mask alignment in the model",
      "模型のマスク位置合わせ"
    ],
    "parameterHint": [
      "준비 중 마스크와 정렬 표시를 옮겨 웨이퍼의 표시와 비교해요. 노광·현상 모형은 정렬을 맞춘 기준 위치에서 진행해요.",
      "During setup, move the mask and compare the projected alignment mark with the wafer mark. The exposure and development demonstration uses the aligned position.",
      "準備中にマスクを動かし、投影した位置合わせマークをウェーハ上のマークと比べます。露光・現像の模型は、位置を合わせた状態で進みます。"
    ],
    "reaction": [
      "누르고 노광·현상 원리 관찰",
      "Hold to explore exposure and development",
      "押し続けて露光・現像の原理を見る"
    ],
    "observe": [
      "위치와 형상 기록을 각각의 참고와 비교해요. 차이가 어느 구간에 있었고, 이후에도 이어졌는지 확인해보세요.",
      "Compare the position and shape records with their corresponding references. When does a difference appear, and does it persist?",
      "位置と形状の記録を、それぞれの参照と比べます。差が現れた区間と、その後も続いたかを確認してください。"
    ],
    "lesson": [
      "노광하면 양성 감광막에서 빛을 받은 부분이 현상액에 잘 녹게 돼요. 웨이퍼가 별도 현상 모듈로 이동하면 그 부분이 제거돼 아래 막이 드러나요. 이어지는 식각 공정에서 열린 부분의 아래 막을 제거해요.",
      "Exposure makes the illuminated areas of positive photoresist more soluble in developer. The wafer moves to a separate development module, where those areas are removed to uncover the underlying film. A later etch step removes the film in those openings.",
      "ポジ型フォトレジストは、光が当たった部分が現像液に溶けやすくなります。ウェーハを別の現像モジュールに移すと、露光部分が除去されて下の膜が現れます。その後のエッチング工程で、開口部の下の膜を除去します。"
    ],
    "review": [
      "위치 기록의 짧은 편차는 나중에 참고 띠로 돌아왔어요. 이 복귀만으로 실제 고장이 해결됐다고 말할 수는 없으며, 형상 기록과도 따로 비교해야 해요.",
      "The brief position deviation later returns to the reference band. That return does not prove a real fault was fixed; the shape record needs its own comparison.",
      "位置記録の一時的な偏差は、その後基準帯へ戻りました。この復帰だけで実際の故障が解消したとは言えず、形状記録も別に比較する必要があります。"
    ],
    "parts": [
      {
        "id": "load",
        "name": [
          "감광막이 있는 웨이퍼",
          "Photoresist-coated wafer",
          "フォトレジストを塗布したウェーハ"
        ],
        "description": [
          "이 체험은 감광막이 준비된 상태에서 시작해요. 빛을 받는 위치와 나중에 남는 패턴을 연결해보세요.",
          "This model begins with photoresist already applied. Relate the illuminated areas to the pattern revealed later.",
          "この模型はフォトレジストを塗った状態から始まります。光が当たる位置と、後で現れるパターンを結び付けましょう。"
        ]
      },
      {
        "id": "process",
        "name": [
          "마스크와 투영 광학계",
          "Mask and projection optics",
          "マスクと投影光学系"
        ],
        "description": [
          "광학계가 마스크 패턴을 감광막에 비춰요. 노광이 끝나면 이송 포크가 웨이퍼를 별도 현상 모듈로 옮겨요.",
          "The optics project the mask pattern onto the resist. After exposure, the transfer fork carries the wafer to a separate development module.",
          "光学系がマスクのパターンをレジストに投影します。露光後、搬送フォークがウェーハを別の現像モジュールへ運びます。"
        ]
      },
      {
        "id": "inspect",
        "name": [
          "패턴 위치·형상 검사",
          "Pattern-position and shape inspection",
          "パターン位置・形状の検査"
        ],
        "description": [
          "어디에 놓였는지와 어떤 모양인지는 다른 질문이에요. 어느 기록을 비교했는지 근거에 남겨보세요.",
          "Where a pattern is and what shape it has are different questions. Record which evidence you compared.",
          "どこにあるかと、どのような形かは異なる問いです。どの記録を比べたか、根拠として残しましょう。"
        ]
      }
    ],
    "equipment": [
      {
        "name": "ASML TWINSCAN NXT:2100i",
        "role": [
          "DUV 노광 장비 사례예요. 패턴을 투영하는 역할을 보여주며, 모형이 실제 스캐너의 광학 설계나 출력을 재현하는 것은 아니에요.",
          "An example of a DUV lithography system used to project patterns. The model does not reproduce the scanner's optical design or output.",
          "DUV露光装置の例です。パターンを投影する役割を示しますが、模型は実際の光学設計や出力を再現しません。"
        ],
        "question": [
          "패턴을 옮기는 장비와 그 위치를 측정하는 장비의 역할을 구분해보세요.",
          "Which tool transfers the pattern, and which tool measures its position?",
          "パターンを転写する装置と、その位置を測る装置の役割を区別しましょう。"
        ],
        "sourceTitle": "ASML · TWINSCAN NXT:2100i",
        "url": "https://www.asml.com/en/products/duv-lithography-systems/twinscan-nxt2100i"
      },
      {
        "name": "ASML YieldStar",
        "role": [
          "층 사이의 정렬 정도인 오버레이 등을 확인하는 광학 계측 사례예요. 노광과 계측은 서로 다른 역할이에요.",
          "An optical metrology example for checking how accurately patterns on different layers line up (overlay). Exposure and metrology serve different roles.",
          "層間の重ね合わせ精度（オーバーレイ）などを測る光学計測の例です。露光と計測は異なる役割を持ちます。"
        ],
        "question": [
          "같은 위치·같은 층 조합의 참고와 비교했는지 확인해보세요.",
          "Are you comparing the same location and the same pair of layers?",
          "同じ位置・同じ層の組合せの参照と比べているか確認しましょう。"
        ],
        "sourceTitle": "ASML · Measuring accuracy",
        "url": "https://www.asml.com/en/technology/lithography-principles/measuring-accuracy"
      }
    ]
  },
  "etch": {
    "id": "etch",
    "name": [
      "식각",
      "Etching",
      "エッチング"
    ],
    "headline": [
      "남길 부분을 보호하고, 필요한 곳을 제거해요.",
      "Protect what stays. Remove material where needed.",
      "残す部分を守り、必要な場所の材料を取り除きます。"
    ],
    "question": [
      "공정 단계가 바뀐 걸까요, 같은 단계에서 달라진 걸까요?",
      "Did the stage change, or did a signal change within the same stage?",
      "工程の段階が切り替わったのでしょうか。それとも同じ段階の中で変わったのでしょうか？"
    ],
    "objective": [
      "플라즈마 식각의 선택적 제거를 관찰하고, 같은 단계의 여러 센서 기록을 함께 비교해요.",
      "Explore selective removal in plasma etching, then compare multiple sensor records within the same stage.",
      "プラズマエッチングの選択的な除去を見て、同じ段階の複数のセンサー記録を比較します。"
    ],
    "steps": [
      [
        "웨이퍼 올리기",
        "Place the wafer",
        "ウェーハを載せる"
      ],
      [
        "챔버 단면 열어 보기",
        "Reveal the chamber cutaway",
        "チャンバーの断面を見る"
      ],
      [
        "가스·RF 역할 살펴보기",
        "Explore the gas and RF roles",
        "ガスとRFの役割を見る"
      ]
    ],
    "parameterLabel": [
      "단면 관찰 위치",
      "Cross-section viewing position",
      "断面の観察位置"
    ],
    "parameterHint": [
      "관찰선을 움직여 마스크 아래 구조를 살펴보세요. RF 전력·가스 유량·식각 속도를 조절하지 않아요.",
      "Move the viewing line across the masked structure. This does not adjust RF power, gas flow, or etch rate.",
      "観察線を動かし、マスク下の構造を見ます。RF電力・ガス流量・エッチング速度を調整する操作ではありません。"
    ],
    "reaction": [
      "누르고 선택적 제거 관찰",
      "Hold to observe selective removal",
      "押し続けて選択的な除去を見る"
    ],
    "observe": [
      "압력·유량·RF·온도를 같은 단계의 참고와 비교해요. 정상적인 단계 전환과, 한 단계 안에서 이어지는 차이를 구분해보세요.",
      "Compare pressure, flow, RF, and temperature against same-stage references. Distinguish a normal transition from a difference that persists within one stage.",
      "圧力・流量・RF・温度を同じ段階の参照と比べます。正常な段階切替と、一つの段階内で続く差を区別してください。"
    ],
    "lesson": [
      "플라즈마 식각은 반응종과 이온의 작용으로 재료를 선택적으로 제거하는 방식 중 하나예요. 마스크가 보호하는 부분과 열린 부분의 차이를 보세요.",
      "Plasma etching uses reactive species and ions to remove material selectively. Compare the areas protected by the mask with the openings.",
      "プラズマエッチングは、反応種やイオンの働きで材料を選択的に除去する方式の一つです。マスクが守る部分と開口部を比べましょう。"
    ],
    "review": [
      "단계 전환에서는 정상 참고도 바뀌어요. 이 기록의 압력 추세는 같은 단계 안에서 참고와 달라지지만, 이것만으로 특정 부품 고장이나 원인을 확정할 수는 없어요.",
      "Normal references change at a stage transition. Here, the pressure trend later differs from its same-stage reference, but that alone does not identify a faulty part or establish a cause.",
      "段階の切替では正常参照も変わります。この記録では、その後同じ段階内で圧力の傾向が参照と異なりますが、それだけで故障部品や原因は確定できません。"
    ],
    "parts": [
      {
        "id": "load",
        "name": [
          "마스크가 있는 웨이퍼",
          "Masked wafer",
          "マスクのあるウェーハ"
        ],
        "description": [
          "이송 포크가 웨이퍼를 넣으면 리프트 핀이 넘겨받아 척에 내려놓아요. 포토에서 남긴 감광막이 마스크 역할을 해요.",
          "The transfer fork brings in the wafer. Lift pins take it from the fork and lower it onto the chuck. The photoresist left after lithography acts as a mask.",
          "搬送フォークがウェーハを運び入れます。リフトピンが受け取ってチャックに載せます。フォト工程で残ったレジストがマスクの役割を果たします。"
        ]
      },
      {
        "id": "process",
        "name": [
          "가스와 RF·플라즈마",
          "Gas, RF, and plasma",
          "ガス・RF・プラズマ"
        ],
        "description": [
          "RF 에너지가 공급된 가스의 일부를 이온화해 플라즈마를 만들어요. 이온은 마스크 위에도 닿아요. 마스크가 덮은 막은 보호되고, 열린 곳의 막은 이온과 반응종의 작용으로 줄어요.",
          "RF energy ionizes some of the supplied gas to form a plasma. Ions also reach the top of the mask. The mask protects the film beneath it, while ions and reactive species remove exposed film in the openings.",
          "RFエネルギーで供給したガスの一部を電離させ、プラズマを作ります。イオンはマスクの上にも到達します。マスクの下の膜は保護され、開口部の膜はイオンと反応種の働きで除去されます。"
        ]
      },
      {
        "id": "inspect",
        "name": [
          "식각 단면과 센서 기록",
          "Etched cross-section and sensor records",
          "エッチング断面とセンサー記録"
        ],
        "description": [
          "결과 형상과 챔버의 기록은 다른 근거예요. 여러 신호를 대조한 뒤 확인한 사실과 추정을 나눠요.",
          "The resulting structure and chamber records provide different types of evidence. Compare multiple signals, then separate observations from inferences.",
          "加工後の形状とチャンバーの記録は異なる根拠です。複数の信号を比べ、観察事実と推測を分けます。"
        ]
      }
    ],
    "equipment": [
      {
        "name": "Lam Research Kiyo",
        "role": [
          "도체 식각과 관련된 반응성 이온 식각 장비 사례예요. 모형은 일반 원리를 설명하며 실제 Kiyo의 운전 조건을 재현하지 않아요.",
          "An example of a reactive ion etching system used for conductor etching. The model illustrates general principles, not Kiyo's operating conditions.",
          "導体エッチングに用いる反応性イオンエッチング装置の例です。模型は一般原理を説明し、Kiyoの運転条件は再現しません。"
        ],
        "question": [
          "기록이 어느 단계의 것인지 확인하고 같은 단계의 정상 참고와 비교해보세요.",
          "Identify the stage before comparing the record with a same-stage reference.",
          "どの段階の記録かを確認し、同じ段階の正常参照と比べましょう。"
        ],
        "sourceTitle": "Lam Research · Kiyo",
        "url": "https://www.lamresearch.com/product/kiyo-product-family/"
      },
      {
        "name": "KLA 392x / eDR7380",
        "role": [
          "패턴의 결함을 광학 검사하고 전자빔으로 검토하는 장비 사례예요. 식각 장비의 센서 기록과는 다른 증거를 제공해요.",
          "Examples of optical defect inspection and electron-beam review. They provide evidence distinct from etch-tool sensor records.",
          "パターン欠陥の光学検査と電子ビームレビューの装置例です。エッチング装置のセンサー記録とは異なる根拠を提供します。"
        ],
        "question": [
          "센서에서 관찰한 변화와 실제 가공 형상에 대한 확인을 구분했나요?",
          "Have you distinguished a sensor change from evidence about the resulting structure?",
          "センサーで見た変化と、加工後の構造を確認する根拠を区別できていますか？"
        ],
        "sourceTitle": "KLA · Inspection and review",
        "url": "https://ir.kla.com/news-events/press-releases/detail/43/kla-announces-new-defect-inspection-and-review-portfolio"
      }
    ]
  },
  "deposition": {
    "id": "deposition",
    "name": [
      "증착·이온 주입",
      "Deposition and ion implantation",
      "成膜・イオン注入"
    ],
    "headline": [
      "식각 단차에 막을 더하고, 별도 시료에 이온을 넣어요.",
      "Coat etched steps and see ions enter a separate sample.",
      "エッチング後の段差に膜を作り、別の試料にイオンを注入します。"
    ],
    "question": [
      "막이 만들어졌다는 것과 전기적 특성은 같은 정보일까요?",
      "Do film formation and electrical properties tell you the same thing?",
      "膜ができたことと電気的特性は、同じ情報でしょうか？"
    ],
    "objective": [
      "식각 뒤 감광막을 제거한 단차와, 주입할 곳만 열어 둔 별도 실리콘 시료를 비교해요.",
      "Compare an etched profile after resist removal with a separate silicon sample patterned for implantation.",
      "エッチング後にレジストを除去した段差と、注入する場所だけを開口した別のシリコン試料を比べます。"
    ],
    "steps": [
      [
        "웨이퍼 놓기",
        "Place the wafer",
        "ウェーハを置く"
      ],
      [
        "공급 경로 확인",
        "Explore the supply path",
        "供給経路を確認する"
      ],
      [
        "반응 표면 열어 보기",
        "Reveal the reacting surface",
        "反応する表面を見る"
      ]
    ],
    "parameterLabel": [
      "단면 관찰 위치",
      "Cross-section viewing position",
      "断面の観察位置"
    ],
    "parameterHint": [
      "관찰 표시를 움직여 막이 붙은 자리와 이온이 들어간 자리를 살펴보세요.",
      "Move the viewing marker to inspect where the film forms and where ions enter the sample.",
      "観察マーカーを動かし、膜ができる場所とイオンが入る場所を確かめます。"
    ],
    "reaction": [
      "누르고 증착과 이온 주입 비교",
      "Hold to compare deposition and implantation",
      "押し続けて成膜とイオン注入を比較"
    ],
    "observe": [
      "막 관련 기록과 전기적 기록을 각각의 참고와 비교해요. 한 항목의 차이가 다른 특성까지 설명하는지 신중히 살펴보세요.",
      "Compare film and electrical records with their own references. Consider carefully whether a difference in one explains the other.",
      "膜に関する記録と電気的記録を、それぞれの参照と比べます。一方の差で別の特性まで説明できるか、慎重に考えましょう。"
    ],
    "lesson": [
      "증착에서는 식각으로 드러난 윗면·옆면·홈 바닥에 새 막을 입혀요. 별도 이온 주입 예시에서는 마스크가 열린 곳 아래에 도펀트가 자리 잡아요. 실제 공정 순서는 만드는 소자에 따라 달라져요.",
      "In this deposition example, a new film coats the tops, sidewalls, and trench floors left by etching. In the separate implantation example, dopants enter the silicon beneath the mask opening. Fabrication sequences vary by device.",
      "この成膜例では、エッチング後の上面・側面・溝の底に新しい膜が付きます。別のイオン注入例では、マスクの開口部の下にドーパントが入ります。実際の工程順序は作るデバイスによって異なります。"
    ],
    "review": [
      "이 기록에서는 막 관련 항목에 차이가 나타나는 동안 별도의 전기적 항목은 참고 띠 안에 있어요. 두 기록을 한 측정값처럼 합치거나, 모두 같은 장비가 측정했다고 해석하지 않아요.",
      "Here, the film-related record differs from its reference while the separate electrical record remains within its reference band. Do not combine them into a single measurement or assume that one instrument measured both.",
      "この記録では膜に関する項目に差が出る一方、別の電気的項目は基準帯内にあります。二つを一つの測定値にまとめたり、同じ装置が両方を測ったと解釈したりしません。"
    ],
    "parts": [
      {
        "id": "load",
        "name": [
          "웨이퍼와 단차 구조",
          "Wafer and stepped surface",
          "ウェーハと段差構造"
        ],
        "description": [
          "회색 웨이퍼 위에 남은 줄과 열린 홈이 식각 후의 단차예요. 확대 단면에서 그 위에 추가되는 막을 구분해 봐요.",
          "The remaining stripes and open trenches on the gray wafer show the etched profile. Use the enlarged section to distinguish the film added on top.",
          "灰色のウェーハに残った帯と開いた溝が、エッチング後の段差です。拡大断面で、その表面に加わる膜を見分けましょう。"
        ]
      },
      {
        "id": "process",
        "name": [
          "공급부와 반응 표면",
          "Supply head and reacting surface",
          "供給部と反応表面"
        ],
        "description": [
          "샤워헤드의 구멍으로 기체 전구체를 공급해요. 이 예시는 표면에서 반응해 단차를 따라 형성되는 막을 보여줘요.",
          "The showerhead distributes gaseous precursors. In this example, surface reactions form a film that follows the stepped profile.",
          "シャワーヘッドの穴から気体の前駆体を供給します。この例では、表面での反応によって段差に沿う膜ができます。"
        ]
      },
      {
        "id": "inspect",
        "name": [
          "식각 단차와 새 막",
          "Etched steps and new film",
          "エッチング段差と新しい膜"
        ],
        "description": [
          "기존 층 위에 더해진 민트색 막을 윗면에서 홈 바닥까지 따라가 보세요. 앞쪽 절단면으로 층의 경계를 볼 수 있어요.",
          "Follow the mint-colored film from the tops down the sidewalls to the trench floors. The front cutaway exposes the boundaries between layers.",
          "淡い緑色の新しい膜を、上面から側面を通って溝の底までたどります。手前の断面で層の境界が見えます。"
        ]
      },
      {
        "id": "implant-source",
        "name": ["이온 선별과 빔 출구", "Ion selection and beam outlet", "イオンの選別とビーム出口"],
        "description": [
          "빔 경로에서 주입할 이온을 자기장으로 선별해요. 좁은 빔 아래에서 웨이퍼를 움직여 주입 위치를 바꿔요.",
          "A magnet selects the ions in the beamline. The wafer moves across the narrow beam to expose different positions.",
          "ビームラインで磁場を使って注入するイオンを選別します。ウェーハを細いビームに対して動かし、照射位置を変えます。"
        ]
      },
      {
        "id": "implant-section",
        "name": ["이온 주입 단면", "Implantation cross-section", "イオン注入の断面"],
        "description": [
          "마스크가 덮은 곳에서는 이온의 입사가 막혀요. 앞쪽 실리콘 단면의 보라색 점으로 열린 곳 아래에 들어간 도펀트의 깊이 분포를 살펴봐요.",
          "The mask blocks incoming ions in covered areas. The purple dots on the front cut face show how dopants are distributed by depth beneath the opening.",
          "マスクで覆われた場所では入射イオンが遮られます。手前のシリコン断面にある紫の点で、開口部の下のドーパントの深さ分布を確認します。"
        ]
      }
    ],
    "equipment": [
      {
        "name": "Applied Materials Producer CVD",
        "role": [
          "다양한 구조 위에 CVD로 막을 형성하는 장비 사례예요. 이 모형은 원리를 한 개 반응 챔버로 단순화해 보여줘요.",
          "An example of a CVD platform for forming films on different structural geometries. The teaching scene simplifies the principle to one reaction chamber.",
          "さまざまな構造の上にCVDで膜を形成する装置の例です。この模型では、原理を一つの反応チャンバーに簡略化して示しています。"
        ],
        "question": [
          "막 형성 방식과 측정하려는 특성이 무엇인지 나누어 확인해보세요.",
          "Identify the film-formation method separately from the property being measured.",
          "膜を作る方式と、測定する特性を分けて確認しましょう。"
        ],
        "sourceTitle": "Applied Materials · Producer CVD",
        "url": "https://www.appliedmaterials.com/il/en/product-library/producer-cvd.html"
      },
      {
        "name": "Axcelis Purion H6",
        "role": [
          "집속된 이온 빔을 주사해 웨이퍼에 도펀트를 주입하는 장비 사례예요. 모형에서는 열린 영역과 가려진 영역의 차이를 보여줘요.",
          "An example of an implanter that scans a focused ion beam across the wafer. The teaching model highlights exposed and masked areas.",
          "集束したイオンビームを走査してウェーハにドーパントを注入する装置の例です。模型では開口部とマスクで覆った部分の違いを示します。"
        ],
        "question": [
          "마스크의 열린 곳 아래에만 보라색 도펀트가 보이나요?",
          "Where are the purple dopant markers relative to the mask opening?",
          "紫のドーパントは、マスクの開口部に対してどこに見えますか？"
        ],
        "sourceTitle": "Axcelis · Purion H6",
        "url": "https://www.axcelis.com/products/purion-h-high-current-ion-implantation/"
      },
      {
        "name": "HORIBA",
        "role": [
          "박막의 두께·계면·균일도 등을 평가하는 측정 사례예요. 이 측정이 모든 전기적 특성을 직접 알려주는 것은 아니에요.",
          "A metrology example for film thickness, interfaces, and uniformity. It does not directly establish every electrical property.",
          "膜厚・界面・均一性などを評価する計測の例です。全ての電気的特性が直接分かるわけではありません。"
        ],
        "question": [
          "막 측정과 전기적 측정의 자료·단위·참고 기준을 구분했나요?",
          "Have you kept film and electrical measurements, units, and references distinct?",
          "膜の測定と電気的測定について、資料・単位・参照基準を区別していますか？"
        ],
        "sourceTitle": "HORIBA · Thin-film measurement",
        "url": "https://www.horiba.com/sgp/materials/material-types/raw-materials-for-semiconductors/film-thickness-measurement-for-semiconductor-raw-materials/"
      }
    ]
  },
  "metal": {
    "id": "metal",
    "name": [
      "금속 배선",
      "Metal interconnects",
      "金属配線"
    ],
    "headline": [
      "보이는 금속을 넘어, 연결 경로를 따라가요.",
      "Look beyond the metal. Follow the connection.",
      "金属の見た目だけでなく、接続経路をたどりましょう。"
    ],
    "question": [
      "겉모양이 같아도 전기적으로 다를 수 있을까요?",
      "Can two similar-looking structures behave differently electrically?",
      "見た目が同じでも、電気的には異なることがあるでしょうか？"
    ],
    "objective": [
      "텅스텐으로 접점을 만든 뒤, 위층의 구리선으로 앞쪽 두 접점을 잇는 과정을 봐요. 연결 검사와 외관 검사를 따로 비교해요.",
      "Follow the tungsten contacts and the copper line that joins the two front contacts in the layer above. Compare connection and appearance records separately.",
      "コンタクトをタングステンで作り、上の層の銅配線で手前の二つをつなぐ過程を見ます。接続と外観の検査記録は分けて比較します。"
    ],
    "steps": [
      [
        "웨이퍼 놓기",
        "Place the wafer",
        "ウェーハを置く"
      ],
      [
        "타깃과 이동 경로 확인",
        "Explore the target and material path",
        "ターゲットと材料の経路を確認する"
      ],
      [
        "텅스텐 라이너 단면 보기",
        "View the tungsten liner cross-section",
        "タングステンライナーの断面を見る"
      ]
    ],
    "parameterLabel": [
      "배선 단면 관찰 위치",
      "Interconnect cross-section position",
      "配線断面の観察位置"
    ],
    "parameterHint": [
      "앞쪽 절개 단면을 따라 관찰 위치를 옮겨 보세요. 완성 장면에서 아래 도전 패드부터 텅스텐 접점을 거쳐 위의 구리선으로 이어지는 길을 볼 수 있어요.",
      "Move the viewing position across the front cutaway. In the finished stack, trace the path from a lower conductive pad through the tungsten contact to the copper line above.",
      "手前の断面に沿って観察位置を動かしてみましょう。完成した断面では、下の導電パッドからタングステンコンタクトを通って上の銅配線へ続く経路を確認できます。"
    ],
    "reaction": [
      "누르고 접점에서 배선까지 보기",
      "Hold to build contacts and wiring",
      "押し続けて接点と配線を見る"
    ],
    "observe": [
      "같은 경로의 연결 기록과 외관 기록을 각각 비교해요. 반복해서 나타나는 차이와, 계속 유지되는 항목을 함께 확인해보세요.",
      "Compare connection and appearance records for the same path. Look for recurring differences and for records that stay consistent.",
      "同じ経路の接続記録と外観記録を、それぞれ比較します。繰り返し現れる差と、変わらず維持される項目を確認してください。"
    ],
    "lesson": [
      "PVD로 얇은 텅스텐(W) 막을 입히고 CVD로 접점 구멍을 채워요. CMP로 표면의 남는 W를 제거하면 구멍 속 접점이 남아요. 위에 새 절연층을 만들고 홈을 판 다음, 밑막을 입혀 구리를 전해도금해요. 다시 CMP로 표면을 고르면 앞쪽 두 접점을 잇는 구리(Cu)선이 남아요.",
      "PVD deposits a thin tungsten (W) liner and CVD fills the contact holes. CMP removes excess W from the surface, leaving the contacts in the holes. In a new dielectric layer above them, etching defines a trench. Barrier and seed layers prepare it for copper electroplating, and CMP leaves a copper (Cu) line that joins the two front contacts.",
      "PVDで薄いタングステン（W）ライナーを形成し、CVDでコンタクト穴を埋めます。CMPで表面の余分なWを除くと、穴の中にコンタクトが残ります。次の絶縁層に配線溝を掘り、バリア膜とシード膜を形成してから銅をめっきします。CMPで平坦にすると、手前の二つのコンタクトを結ぶ銅（Cu）配線が残ります。"
    ],
    "review": [
      "이 기록에서는 연결 항목에 반복적인 차이가 나타나지만 외관 항목은 참고 띠 안에 있어요. 겉모양이 비슷하다는 이유로 연결도 같다고 결론 내리지는 않아요.",
      "Here, connection records show recurring differences while the appearance record stays within its reference band. Similar appearance does not establish equivalent electrical connections.",
      "この記録では接続項目に繰り返す差がある一方、外観は基準帯内にあります。見た目が似ているだけで、電気的接続も同じとは結論しません。"
    ],
    "parts": [
      {
        "id": "load",
        "name": [
          "층 구조와 웨이퍼",
          "Layer stack and wafer",
          "積層構造とウェーハ"
        ],
        "description": [
          "절연층은 경로를 나누고 필요한 곳에서만 금속으로 연결해요. 단면에서 층과 접점의 차이를 보세요.",
          "Insulation separates paths, while metal connects selected locations. Compare layers and contacts in the cross-section.",
          "絶縁層で電気的な経路を分け、必要な箇所を金属のコンタクトで接続します。断面で、絶縁層と接続部の違いを見てください。"
        ]
      },
      {
        "id": "process",
        "name": [
          "타깃과 금속막 형성",
          "Target and metal-film formation",
          "ターゲットと金属膜形成"
        ],
        "description": [
          "푸른 입자는 타깃으로 향하는 이온, 회색 입자는 웨이퍼로 이동하는 텅스텐 원자를 나타내요. 웨이퍼에 도달한 텅스텐이 얇은 라이너를 형성해요.",
          "Blue particles represent ions moving toward the target. Gray particles represent tungsten atoms traveling to the wafer, where they form a thin liner.",
          "青い粒はターゲットに向かうイオン、灰色の粒はウェーハに向かうタングステン原子を表します。ウェーハに付着したタングステンが薄いライナーを形成します。"
        ]
      },
      {
        "id": "inspect",
        "name": [
          "접점 단면과 구리 배선",
          "Contact section and copper line",
          "コンタクト断面と銅配線"
        ],
        "description": [
          "앞쪽 도전 패드 두 개는 각각 회색 텅스텐 접점을 거쳐 같은 구리선에 닿아요. 뒤쪽 접점은 별도 패드 위에 남아요. 전기적 연결은 검사 기록에서 따로 확인해요.",
          "Trace each front pad through its gray tungsten contact to the shared copper line above. The rear contact stays on a separate pad. Check electrical connections separately in the inspection records.",
          "手前の二つの導電パッドから、それぞれ灰色のタングステンコンタクトを通り、共通の銅配線へ続く経路をたどります。奥のコンタクトは別のパッド上に残ります。電気的な接続は検査記録で別に確認します。"
        ]
      }
    ],
    "equipment": [
      {
        "name": "Applied Materials Endura Ioniq W PVD",
        "role": [
          "Endura Ioniq의 PVD 챔버에서 순수 텅스텐 라이너를 형성하고, 같은 플랫폼의 후속 CVD 챔버에서 접점 구멍을 텅스텐으로 채워요.",
          "The Endura Ioniq PVD chamber deposits a pure tungsten liner. A subsequent CVD chamber on the same platform fills the contact with tungsten.",
          "Endura IoniqのPVDチャンバーで純タングステンのライナーを形成し、同じプラットフォームの後段のCVDチャンバーでコンタクトにタングステンを充填します。"
        ],
        "question": [
          "어느 층·어느 접점의 형성 결과인지 먼저 확인해보세요.",
          "Which layer and which contact does the result describe?",
          "どの層・どのコンタクトの形成結果なのか、まず確認しましょう。"
        ],
        "sourceTitle": "Applied Materials · Endura Ioniq W PVD",
        "url": "https://www.appliedmaterials.com/eu/en/product-library/endura-ioniq-w-pvd.html"
      },
      {
        "name": "Keysight B1500A",
        "role": [
          "반도체 소자의 전기적 특성을 확인하는 파라미터 분석기 사례예요. 전기적 측정과 외관 자료는 서로 다른 질문에 답해요.",
          "An example of a parameter analyzer for characterizing the electrical properties of semiconductor devices. Electrical measurements and appearance evidence answer different questions.",
          "半導体素子の電気的特性を調べるパラメーターアナライザーの例です。電気的測定と外観の資料は異なる問いに答えます。"
        ],
        "question": [
          "연결 경로·측정 조건·참고값이 같은 자료를 비교했나요?",
          "Have you matched the connection path, measurement conditions, and reference?",
          "接続経路・測定条件・参照値が対応する資料を比べていますか？"
        ],
        "sourceTitle": "Keysight · B1500A",
        "url": "https://www.keysight.com/gb/en/product/B1500A/semiconductor-device-parameter-analyzer-system-mainframe.html"
      }
    ]
  },
  "eds": {
    "id": "eds",
    "name": [
      "EDS · 웨이퍼 테스트",
      "Wafer testing · EDS",
      "ウェーハテスト（EDS）"
    ],
    "headline": [
      "칩 하나씩 접촉하고, 구역별 근거를 모아요.",
      "Contact each die. Build evidence across regions.",
      "チップに接触し、領域ごとの根拠を集めます。"
    ],
    "question": [
      "검사한 칩의 결과와 검사 장비 상태는 같은 정보일까요?",
      "Do die test results and test-equipment status provide the same information?",
      "チップの検査結果と検査装置の状態は、同じ情報でしょうか？"
    ],
    "objective": [
      "프로버의 위치 맞추기와 테스터의 전기 검사 역할을 구분하고, 구역별 기록을 비교해요.",
      "Distinguish the prober's positioning role from the tester's electrical measurements, then compare inspection regions.",
      "プローバーの位置合わせとテスターの電気検査の役割を区別し、領域ごとの記録を比較します。"
    ],
    "steps": [
      [
        "웨이퍼 놓기",
        "Place the wafer",
        "ウェーハを置く"
      ],
      [
        "프로브 카드 위치 확인",
        "Find the probe-card position",
        "プローブカードの位置を確認する"
      ],
      [
        "테스터 연결 확인",
        "Explore the tester connection",
        "テスターへの接続を確認する"
      ]
    ],
    "parameterLabel": [
      "접촉부 관찰 위치",
      "Contact viewing position",
      "接触部の観察位置"
    ],
    "parameterHint": [
      "준비 단계에서는 살펴볼 칩의 위치가 바뀌어요. 검사 동작 중에는 확대 화면의 관찰 표시를 옮겨요.",
      "Choose a die position during preparation. During the test demonstration, move the marker in the enlarged view.",
      "準備では観察するチップの位置を選びます。検査の実演中は、拡大表示の観察マーカーを動かします。"
    ],
    "reaction": [
      "누르고 접촉·구역 검사 관찰",
      "Hold to explore contact and region inspection",
      "押し続けてプローブ接触を観察"
    ],
    "observe": [
      "재생은 검사 구역을 차례로 펼치는 순서예요. 실제 제조 시간이 아니며, 각 구역의 칩 기록과 비교 기록을 해당 참고와 대조해야 해요.",
      "Playback reveals inspection regions one by one; it does not represent manufacturing time. Compare each region's die records and separate comparison records with their corresponding references.",
      "再生は検査領域を順に表示するもので、実際の製造時間ではありません。各領域のチップ記録と比較記録を、対応する参照と照合してください。"
    ],
    "lesson": [
      "프로버는 웨이퍼와 프로브의 위치·접촉을 맞추고, 테스터는 전기적 신호를 주고받아 특성을 검사해요. 웨이퍼 맵은 칩 결과를 위치와 함께 정리한 자료예요.",
      "The prober positions the wafer for probe contact; the tester applies and measures electrical signals. A wafer map organizes die results by location.",
      "プローバーはウェーハとプローブの位置・接触を合わせ、テスターは電気信号を与えて、その応答を測定し特性を調べます。ウェーハマップはチップの検査結果を位置とともに整理した資料です。"
    ],
    "review": [
      "구역이 바뀐 뒤 칩 검사 기록에 차이가 나타났어요. 다른 비교 기록도 함께 살펴봐야 하며, 특정 구역의 칩 결과만으로 제조 장비의 고장 원인을 입증할 수는 없어요.",
      "In a later region, the die inspection records differ from their corresponding reference. Check the separate comparison record as well; one region's results alone cannot establish a fault in the manufacturing equipment or its cause.",
      "後の領域でチップ検査記録に差が現れました。別の比較記録も確認する必要があり、一つの領域の結果だけで製造装置の故障原因を証明することはできません。"
    ],
    "parts": [
      {
        "id": "load",
        "name": [
          "웨이퍼와 칩 위치",
          "Wafer and die locations",
          "ウェーハとチップの位置"
        ],
        "description": [
          "작은 사각형은 웨이퍼 위 칩의 위치를 표현해요. 모형의 색을 실제 칩 수율이나 장비 건강도로 읽지 않아요.",
          "The small rectangles represent die locations. Model colors are not real yield measurements or equipment-health ratings.",
          "小さな四角はウェーハ上のチップ位置を表します。模型の色は、実際の歩留まりや装置の健全性評価ではありません。"
        ]
      },
      {
        "id": "process",
        "name": [
          "프로브 카드",
          "Probe card",
          "プローブカード"
        ],
        "description": [
          "프로브 카드의 탐침이 칩 패드에 닿으면 테스터와 칩 사이로 전기 신호가 오갈 수 있어요.",
          "When the probe card's tips touch the die pads, electrical signals can travel between the tester and the die.",
          "プローブカードの針先がチップのパッドに触れると、テスターとチップの間で電気信号をやり取りできます。"
        ]
      },
      {
        "id": "inspect",
        "name": [
          "확대 접촉부",
          "Enlarged contact area",
          "接触部の拡大"
        ],
        "description": [
          "확대 모형에서 칩이 올라가 탐침 끝과 패드가 맞닿는 순간을 찾아보세요. 구역별 검사 위치는 웨이퍼 맵에서 살펴봐요.",
          "Watch the die rise until its pads touch the probe tips in this close-up. The wafer map shows the test locations by region.",
          "拡大模型で、チップが上がってパッドが針先に触れる瞬間を見ましょう。領域ごとの検査位置はウェーハマップで確認できます。"
        ]
      },
      {
        "id": "tester",
        "name": [
          "테스터",
          "Tester",
          "テスター"
        ],
        "description": [
          "프로브 카드를 통해 전기 신호를 인가하고 응답을 측정해요. 웨이퍼 위치를 맞추는 프로버와 역할이 달라요.",
          "The tester applies electrical signals and measures their responses through the probe card. Its role differs from the prober, which positions the wafer.",
          "テスターはプローブカードを通して電気信号を与え、その応答を測定します。ウェーハの位置を合わせるプローバーとは役割が異なります。"
        ]
      }
    ],
    "equipment": [
      {
        "name": "Tokyo Electron Precio",
        "role": [
          "웨이퍼와 프로브 카드의 위치·접촉을 맞추는 자동 프로버 사례예요. 테스터와 역할이 달라요.",
          "An example of an automatic wafer prober used for positioning and probe contact. Its role differs from the tester's.",
          "ウェーハとプローブカードの位置・接触を合わせる自動プローバーの例です。テスターとは役割が異なります。"
        ],
        "question": [
          "검사 위치와 접촉 조건이 같은 구역의 참고를 비교했나요?",
          "Are the inspection location and contact conditions matched to the reference?",
          "検査位置と接触条件が参照に対応しているか確認しましょう。"
        ],
        "sourceTitle": "Tokyo Electron · Precio",
        "url": "https://www.tel.com/product/precio.html"
      },
      {
        "name": "Advantest V93000",
        "role": [
          "웨이퍼 단계와 최종 검사에 연결되는 전기 검사 시스템 사례예요. 칩 결과와 제조 장비 상태를 같은 자료로 보지 않아요.",
          "An example of an electrical test system used for wafer-level and final testing. Die test results and manufacturing-equipment status are different kinds of evidence.",
          "ウェーハ段階や最終検査に対応する電気検査システムの例です。チップ結果と製造装置の状態は同じ資料ではありません。"
        ],
        "question": [
          "칩 결과, 검사 비교 기록, 검사 조건을 구분해 설명할 수 있나요?",
          "Can you distinguish die results, comparison records, and test conditions?",
          "チップ結果、検査の比較記録、検査条件を分けて説明できますか？"
        ],
        "sourceTitle": "Advantest · V93000",
        "url": "https://www.advantest.com/en/products/semiconductor-test-system/soc/v93000/"
      }
    ]
  },
  "packaging": {
    "id": "packaging",
    "name": [
      "패키징",
      "Packaging",
      "パッケージング"
    ],
    "headline": [
      "칩을 보호하고, 바깥 회로와 이어줘요.",
      "Protect the die and connect it to external circuits.",
      "チップを守り、外部の回路へつなぎます。"
    ],
    "question": [
      "연결이 보인다는 것과 연결이 확인됐다는 것은 같을까요?",
      "Is a visible connection the same as a verified connection?",
      "接続が見えることと、接続を確認できたことは同じでしょうか？"
    ],
    "objective": [
      "칩·패드·본딩 와이어의 관계를 보고, 연결과 외관 기록을 따로 비교해요. 와이어 본딩은 패키징에 쓰이는 연결 방식 중 하나예요.",
      "Explore the die, pads, and bond wires, then compare connection and appearance evidence separately. Wire bonding is one way to make electrical connections in a package.",
      "チップ・パッド・ボンディングワイヤーの関係を見て、接続と外観の記録を分けて比べます。ワイヤーボンディングは、パッケージングで使う接続方法の一つです。"
    ],
    "steps": [
      [
        "칩 놓기",
        "Place the die",
        "チップを置く"
      ],
      [
        "연결 패드 살펴보기",
        "Explore the connection pads",
        "接続パッドを見る"
      ],
      [
        "본딩 헤드 위치 확인",
        "Find the bonding-head position",
        "ボンディングヘッドの位置を確認する"
      ]
    ],
    "parameterLabel": [
      "본딩 연결부 관찰 위치",
      "Bond-connection viewing position",
      "ボンディング接続部の観察位置"
    ],
    "parameterHint": [
      "관찰 표시를 옮겨 칩 쪽과 바깥 패드 쪽 연결을 살펴봐요. 실제 본딩 힘·온도·와이어 조건을 조절하지 않아요.",
      "Move the marker between die-side and outer-pad connections. This does not adjust bond force, temperature, or wire settings.",
      "観察マーカーを動かし、チップ側と外部パッド側の接続を見ます。実際の接合荷重・温度・ワイヤー条件を調整する操作ではありません。"
    ],
    "reaction": [
      "누르고 와이어 연결·보호 구조 관찰",
      "Hold to explore wire connections and protection",
      "押し続けてワイヤー接続と保護構造を見る"
    ],
    "observe": [
      "연결과 외관 기록을 각각의 참고와 비교해요. 앞뒤 구간을 함께 보며, 달라졌다가 돌아오는 기록도 놓치지 않아요.",
      "Compare connection and appearance records with their corresponding references. Check earlier and later intervals, including values that move away from a reference and then return toward it.",
      "接続と外観の記録を、それぞれの参照と比べます。前後の区間を見て、変化した後に戻る記録も確認しましょう。"
    ],
    "lesson": [
      "칩을 지지부에 접착한 뒤 와이어 본딩으로 칩 패드와 리드를 이어요. 이후 별도 몰딩 단계에서 칩과 와이어를 수지로 감싸고 바깥 단자는 노출된 채 남겨요.",
      "After die attach, wire bonding joins the die pad to the lead. A later molding step encapsulates the die and wires in resin and leaves the external terminals exposed.",
      "チップを支持部に固定した後、ワイヤーボンディングでチップパッドとリードをつなぎます。後工程のモールドでチップとワイヤーを樹脂で封止し、外部端子は露出させます。"
    ],
    "review": [
      "이 기록의 연결 항목은 참고에서 멀어졌다가 다시 가까워져요. 복귀만으로 실제 접속 문제가 해결됐다고 말하지 않으며, 외관 자료도 별도로 살펴봐요.",
      "The connection record moves away from its reference, then returns toward it. That return does not prove a real connection problem was resolved; inspect appearance evidence separately.",
      "接続記録は参照から離れた後、再び近づきます。この復帰だけで実際の接続問題が解消したとは言わず、外観の資料も別に確認します。"
    ],
    "parts": [
      {
        "id": "load",
        "name": [
          "칩과 지지 기판",
          "Die and supporting substrate",
          "チップと支持基板"
        ],
        "description": [
          "칩을 지지하는 부분과 전기적으로 연결할 패드의 위치를 먼저 살펴보세요.",
          "First identify the die support and the pads that need electrical connections.",
          "まずチップを支える部分と、電気的に接続するパッドの位置を確認してください。"
        ]
      },
      {
        "id": "process",
        "name": [
          "본딩 헤드와 와이어",
          "Bonding head and wire",
          "ボンディングヘッドとワイヤー"
        ],
        "description": [
          "세라믹 캐필러리가 칩 패드에 첫 접합을 만들고, 와이어를 당겨 루프를 만든 뒤 리드에 두 번째 접합을 만들어요.",
          "The ceramic capillary makes the first bond on the die pad, draws out a wire loop, and makes the second bond on the lead.",
          "セラミックキャピラリーでチップパッドに第1接合を行い、ワイヤーを引き出してループを作り、リードに第2接合を行います。"
        ]
      },
      {
        "id": "inspect",
        "name": [
          "연결·외관 확인",
          "Connection and appearance checks",
          "接続・外観の確認"
        ],
        "description": [
          "모양이 보이는 것, 전기적으로 연결된 것, 기계적으로 견디는 것은 서로 다른 확인 항목이에요.",
          "Appearance, electrical connection, and mechanical strength require different checks.",
          "見た目、電気的な接続、機械的な強さは、それぞれ異なる検査項目です。"
        ]
      },
      {
        "id": "spool",
        "name": [
          "본딩 와이어",
          "Bonding wire",
          "ボンディングワイヤー"
        ],
        "description": [
          "스풀에 감긴 와이어가 본딩 헤드로 공급돼 패드 사이의 연결을 만들어요. 원리를 단순화한 모형이에요.",
          "Wire is supplied from the spool to the bonding head to make connections between pads. The model simplifies the principle.",
          "スプールからボンディングヘッドへワイヤーが供給され、パッド間の接続を作ります。この模型は原理を簡略化した表現です。"
        ]
      }
    ],
    "equipment": [
      {
        "name": "ASMPT Eagle AERO",
        "role": [
          "칩과 외부 연결부를 와이어로 잇는 본딩 장비 사례예요. 모든 패키징 방식이 와이어 본딩을 사용하는 것은 아니에요.",
          "An example of a wire-bonding system that connects die pads to external terminals. Not every package uses wire bonding.",
          "チップと外部端子をワイヤーでつなぐボンディング装置の例です。全てのパッケージがワイヤーボンディングを使うわけではありません。"
        ],
        "question": [
          "어느 칩 패드와 어느 외부 연결부를 잇는지 확인해보세요.",
          "Which die pad connects to which external terminal?",
          "どのチップパッドが、どの外部端子につながるか確認しましょう。"
        ],
        "sourceTitle": "ASMPT · Eagle AERO",
        "url": "https://semi.asmpt.com/en/news-center/press-releases/2024-08-21/"
      },
      {
        "name": "Nordson DAGE 4600",
        "role": [
          "와이어 당김·볼 전단 등 접합부의 기계적 시험을 수행하는 장비 사례예요. 이 시험은 외관 확인이나 전기 검사와 다른 근거예요.",
          "An example of a bond tester used for mechanical tests such as wire pull and ball shear. These tests provide different evidence from visual inspection or electrical testing.",
          "ワイヤープル（引張）試験やボールシェア（せん断）試験など、接合部の機械的試験を行う装置の例です。外観検査や電気検査とは異なる根拠です。"
        ],
        "question": [
          "지금 설명하는 결과가 외관·전기·기계적 시험 중 무엇인지 구분했나요?",
          "Is the result about appearance, electrical behavior, or mechanical strength?",
          "説明している結果が、外観・電気・機械的試験のどれかを区別できていますか？"
        ],
        "sourceTitle": "Nordson DAGE · 4600",
        "url": "https://www.nordson.com/products/test-and-inspection-products/dage-4600-automated-bondtester"
      }
    ]
  }
};
