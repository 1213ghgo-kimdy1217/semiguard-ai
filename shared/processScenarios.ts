import { ETCH_DURATION } from "./etchScenario";
import { processLessons } from "./learningHub";

export type LocalizedText = readonly [string, string, string];
export type ProcessId = "wafer" | "oxidation" | "photo" | "etch" | "deposition" | "metal" | "eds" | "packaging";
export type ProcessSignal = { id: string; name: LocalizedText; location: LocalizedText };
export type ProcessScenario = {
  id: string;
  processId: ProcessId;
  order: number;
  title: LocalizedText;
  equipment: LocalizedText;
  briefing: LocalizedText;
  objective: LocalizedText;
  referenceRule: LocalizedText;
  duration: number;
  signals: readonly ProcessSignal[];
  expectedSignal: string;
  changeTime: number | null;
  referenceUrl: string;
  referenceTitle: LocalizedText;
  events: readonly { time: number; label: LocalizedText }[];
};

const source = (id: ProcessId) => processLessons.find(lesson => lesson.id === id)!.source;
const sourceTitle: LocalizedText = ["삼성반도체 공정 개념 자료 · 가상 기록의 출처 아님", "Samsung Semiconductor process concepts · not the source of synthetic records", "Samsung Semiconductorの工程解説・仮想記録の出典ではありません"];
const sameCondition: LocalizedText = ["같은 검사 조건·같은 관측 위치의 가상 참고 기록과 비교하세요. 상대지수와 기준 띠는 이 연습에만 쓰입니다.", "Compare virtual reference records with the same inspection conditions and observation location. The index and reference band are specific to this exercise.", "同じ検査条件・同じ観測位置の仮想参考記録と比較してください。相対指数と基準帯はこの練習専用です。"];

// Public references support process concepts only. All signals, bands and times below
// are authored teaching examples, not recipes, physical limits or equipment instructions.
export const processScenarios: readonly ProcessScenario[] = [
  {
    id: "wafer-surface-a-01", processId: "wafer", order: 1,
    title: ["웨이퍼 제조 · 같은 위치의 검사 기록 비교","Wafer preparation · comparing same-location inspection records","ウェーハ製造・同じ位置の検査記録を比較"],
    equipment: ["가상 웨이퍼 표면·두께 검사", "Virtual wafer surface and thickness inspection", "仮想ウェーハ表面・厚さ検査"],
    briefing: ["같은 조건의 표면·두께 검사 기록을 90초로 압축해 살펴봅니다. 제품 검사 결과에서 관찰한 변화와 장비 원인 추정을 구분하세요.", "Review surface and thickness inspection records in a 90-second compressed replay. Separate changes in product inspection from assumptions about equipment causes.", "同じ条件の表面・厚さ検査記録を90秒に圧縮して確認します。製品検査での変化と装置原因の推測を区別してください。"],
    objective: ["표면과 두께 기록을 각각의 정상 참고와 비교하고, 검사 결과와 원인 추정을 구분합니다.","Compare surface and thickness records against their own normal references; distinguish inspection results from cause inference.","表面と厚さ記録をそれぞれの正常参照と比較し、検査結果と原因の推測を区別します。"],
    referenceRule: sameCondition, duration: 90,
    signals: [
      { id: "surface", name: ["표면 편차 지수", "Surface deviation index", "表面偏差指数"], location: ["동일 위치의 가상 표면 검사", "Virtual surface inspection at the same location", "同じ位置の仮想表面検査"] },
      { id: "thickness", name: ["두께 검사 지수", "Thickness inspection index", "厚さ検査指数"], location: ["동일 조건의 가상 두께 기록", "Virtual thickness records under the same conditions", "同じ条件の仮想厚さ記録"] },
    ],
    expectedSignal: "surface", changeTime: 25, referenceUrl: source("wafer"), referenceTitle: sourceTitle,
    events: [
      { time: 25, label: ["표면 기록의 추세 변화 시작", "Surface-record trend begins changing", "表面記録の傾向変化が開始"] },
      { time: 90, label: ["두께 기록은 참고 띠 안에서 유지", "Thickness records remain within the reference band", "厚さ記録は基準帯内で維持"] },
    ],
  },
  {
    id: "oxidation-reference-a-01", processId: "oxidation", order: 2,
    title: ["산화 · 검사 묶음의 기준 비교","Oxidation · comparing inspection-group references","酸化・検査グループの基準を比較"],
    equipment: ["가상 산화막 검사 기록", "Virtual oxide-film inspection records", "仮想酸化膜検査記録"],
    briefing: ["검사 묶음 A와 B의 막 검사 기록을 살펴봅니다. 각 묶음의 관측값과 해당 정상 참고를 비교하세요.","Review film inspection records for groups A and B. Compare each group's readings against its corresponding reference.","グループAとBの膜検査記録を確認します。それぞれの観測値を対応する正常参照と比較してください。"],
    objective: ["단계·조건에 맞는 참고 기준을 선택하고, 값의 변화와 참고 기준 대비 편차를 구분합니다.","Select condition-matched references and distinguish value changes from deviations against those references.","段階・条件に合う参考基準を選び、値の変化と参考基準に対する偏差を区別します。"],
    referenceRule: ["A 기록은 A 참고값, B 기록은 B 참고값과 비교합니다. 서로 다른 검사 묶음의 기준을 섞지 마세요.", "Compare A records with the A reference and B records with the B reference. Keep inspection-group references distinct.", "A記録はA参考値、B記録はB参考値と比較します。異なる検査グループの基準を混ぜないでください。"], duration: 90,
    signals: [
      { id: "film", name: ["막 검사 지수", "Film inspection index", "膜検査指数"], location: ["검사 묶음별 가상 막 기록", "Virtual film records by inspection group", "検査グループ別の仮想膜記録"] },
      { id: "uniformity", name: ["균일도 검사 지수", "Uniformity inspection index", "均一性検査指数"], location: ["같은 묶음의 가상 비교 기록", "Virtual comparison records from the same group", "同じグループの仮想比較記録"] },
    ],
    expectedSignal: "none", changeTime: null, referenceUrl: source("oxidation"), referenceTitle: sourceTitle,
    events: [
      { time: 30, label: ["검사 묶음 B로 정상 전환 · 참고값도 함께 변경", "Normal switch to group B · reference changes with it", "検査グループBへ正常に切替・参考値も変化"] },
      { time: 90, label: ["모든 기록이 해당 조건의 참고 띠 안에 있음", "All records remain within their corresponding reference bands", "すべての記録が対応する条件の基準帯内"] },
    ],
  },
  {
    id: "photo-pattern-a-01", processId: "photo", order: 3,
    title: ["포토 · 위치와 형상 기록 비교","Photolithography · comparing position and shape records","フォト・位置と形状の記録を比較"],
    equipment: ["가상 감광막 패턴 검사", "Virtual photoresist pattern inspection", "仮想感光膜パターン検査"],
    briefing: ["패턴 위치와 형상의 가상 검사 기록을 각각의 참고 기준과 비교합니다. 서로 다른 구간에서 관찰한 사실을 정리하세요.", "Compare virtual pattern-position and shape records against their own references. Describe the observations in different intervals.", "パターン位置と形状の仮想検査記録をそれぞれの参考基準と比較し、異なる区間の観察事実を整理してください。"],
    objective: ["일시적 편차와 지속 편차를 구분하고, 복귀한 기록을 고장 해결의 증거로 해석하지 않습니다.", "Distinguish a brief deviation from a persistent one. A return to the reference does not establish that a fault was fixed.", "一時的な偏差と継続的な偏差を区別し、基準への復帰を故障解決の証拠とみなしません。"],
    referenceRule: sameCondition, duration: 90,
    signals: [
      { id: "position", name: ["패턴 위치 지수", "Pattern-position index", "パターン位置指数"], location: ["같은 검사 위치의 가상 패턴 기록", "Virtual pattern records at the same inspection location", "同じ検査位置の仮想パターン記録"] },
      { id: "shape", name: ["패턴 형상 지수", "Pattern-shape index", "パターン形状指数"], location: ["가상 형상 비교 기록", "Virtual pattern-shape comparison records", "仮想形状比較記録"] },
    ],
    expectedSignal: "position", changeTime: 32, referenceUrl: source("photo"), referenceTitle: sourceTitle,
    events: [
      { time: 32, label: ["위치 기록에 짧은 편차 시작", "Brief position-record deviation begins", "位置記録の短い偏差が開始"] },
      { time: 45, label: ["위치 기록이 참고 띠로 복귀", "Position records return to the reference band", "位置記録が基準帯へ復帰"] },
    ],
  },
  {
    id: "etch-chamber-a-01", processId: "etch", order: 4,
    title: ["식각 · 단계별 센서 기록 비교", "Etch · comparing sensor records by stage", "エッチング・段階別のセンサー記録を比較"],
    equipment: ["가상 식각 챔버", "Virtual etch chamber", "仮想エッチングチャンバー"],
    briefing: ["기존 3분 식각 훈련에서 압력·유량·RF·온도 기록을 관찰합니다. 단계 전환과 같은 단계의 지속 편차를 구분하세요.", "Observe pressure, flow, RF and temperature records in the existing three-minute etch exercise. Separate a stage transition from persistent deviation within a stage.", "既存の3分間エッチング練習で圧力・流量・RF・温度の記録を観察します。段階切替と同じ段階内の継続的な偏差を区別してください。"],
    objective: ["같은 단계의 관측 기록을 비교하고 관찰 사실과 원인 추정을 구분합니다.", "Compare same-stage observations and separate recorded facts from cause inference.", "同じ段階の観測記録を比較し、観察事実と原因の推測を区別します。"],
    referenceRule: ["같은 공정 단계·같은 진행 위치의 가상 정상 기록과 비교합니다.", "Compare virtual reference records at the same stage and progress position.", "同じ工程段階・同じ進行位置の仮想正常記録と比較します。"], duration: ETCH_DURATION,
    signals: [
      { id: "pressure", name: ["챔버 압력", "Chamber pressure", "チャンバー圧力"], location: ["교육용 챔버 기록", "Teaching-only chamber records", "教育用チャンバー記録"] },
      { id: "flow", name: ["가스 유량", "Gas flow", "ガス流量"], location: ["교육용 공급 계통 기록", "Teaching-only supply records", "教育用供給系統記録"] },
      { id: "rf", name: ["RF 전력", "RF power", "RF電力"], location: ["교육용 전력 계통 기록", "Teaching-only power-system records", "教育用電力系統記録"] },
      { id: "temperature", name: ["온도", "Temperature", "温度"], location: ["교육용 챔버 주변 기록", "Teaching-only chamber-surroundings records", "教育用チャンバー周辺記録"] },
    ],
    expectedSignal: "pressure", changeTime: 70, referenceUrl: source("etch"), referenceTitle: sourceTitle,
    events: [
      { time: 40, label: ["단계 B로 정상 전환", "Normal transition to stage B", "段階Bへ正常に切替"] },
      { time: 70, label: ["압력 추세 변화 시작", "Pressure trend begins changing", "圧力傾向の変化が開始"] },
    ],
  },
  {
    id: "deposition-film-a-01", processId: "deposition", order: 5,
    title: ["증착·이온 주입 · 서로 다른 검사 근거", "Deposition / implantation · different inspection evidence", "成膜・イオン注入・異なる検査根拠"],
    equipment: ["가상 막 검사·전기적 검사 기록", "Virtual film and electrical inspection records", "仮想膜検査・電気的検査記録"],
    briefing: ["증착의 막 검사와 이온 주입의 전기적 검사는 별개의 목적을 가진 자료입니다. 나란히 놓인 두 가상 기록을 각자의 참고값과 비교하세요.", "Film inspection for deposition and electrical inspection for implantation serve different purposes. Compare the two virtual records with their respective references.", "成膜の膜検査とイオン注入の電気的検査は異なる目的の資料です。並んだ二つの仮想記録をそれぞれの参考値と比較してください。"],
    objective: ["각 검사 기록을 해당 참고 기준과 비교하고, 서로 다른 목적의 검사 결과가 어떤 근거를 제공하는지 구분합니다.", "Compare each inspection with its matching reference and distinguish the evidence supplied by inspections with different purposes.", "各検査を対応する参考基準と比較し、異なる目的の検査結果が示す根拠を区別します。"],
    referenceRule: ["막 검사는 같은 막 검사 조건, 전기적 검사는 같은 전기적 검사 조건의 참고값과 각각 비교합니다.", "Compare film inspection with the matching film reference and electrical inspection with the matching electrical reference.", "膜検査は同じ膜検査条件、電気的検査は同じ電気的検査条件の参考値と個別に比較します。"], duration: 90,
    signals: [
      { id: "film", name: ["막 검사 지수", "Film inspection index", "膜検査指数"], location: ["가상 증착 결과 검사", "Virtual deposition-result inspection", "仮想成膜結果検査"] },
      { id: "electrical", name: ["전기적 검사 지수", "Electrical inspection index", "電気的検査指数"], location: ["별도 이온 주입 결과의 가상 검사", "Separate virtual implantation-result inspection", "別のイオン注入結果の仮想検査"] },
    ],
    expectedSignal: "film", changeTime: 48, referenceUrl: source("deposition"), referenceTitle: sourceTitle,
    events: [
      { time: 48, label: ["막 검사 기록이 아래쪽으로 달라짐", "Film inspection records shift downward", "膜検査記録が下側へ変化"] },
      { time: 90, label: ["별도 전기적 기록은 참고 띠 안에서 유지", "Separate electrical records remain within their reference band", "別の電気的記録は基準帯内で維持"] },
    ],
  },
  {
    id: "metal-connection-a-01", processId: "metal", order: 6,
    title: ["금속 배선 · 연결·외관 기록 비교","Interconnect · comparing connection and appearance records","金属配線・接続と外観記録を比較"],
    equipment: ["가상 배선 연결·외관 검사", "Virtual interconnect connection and appearance inspection", "仮想配線接続・外観検査"],
    briefing: ["연결 검사와 외관 기록을 각각의 정상 참고와 비교합니다. 두 자료가 어떤 관측을 뒷받침하는지 살펴보세요.","Compare connection and appearance records with their own references. Consider which observations each record supports.","接続検査と外観記録をそれぞれの正常参照と比較します。各資料がどの観察を裏付けるか確認してください。"],
    objective: ["두 검사 기록의 시점별 차이를 살펴보고, 외관과 전기적 연결 결과를 같은 근거로 취급하지 않습니다.","Compare both inspection records across time without treating appearance and electrical connection results as equivalent evidence.","二つの検査記録を時点別に比較し、外観と電気的接続結果を同じ根拠として扱いません。"],
    referenceRule: sameCondition, duration: 90,
    signals: [
      { id: "connection", name: ["연결 검사 지수", "Connection inspection index", "接続検査指数"], location: ["같은 경로의 가상 전기적 비교 기록", "Virtual electrical comparison records for the same path", "同じ経路の仮想電気的比較記録"] },
      { id: "appearance", name: ["외관 검사 지수", "Appearance inspection index", "外観検査指数"], location: ["가상 배선 외관 기록", "Virtual interconnect appearance records", "仮想配線外観記録"] },
    ],
    expectedSignal: "connection", changeTime: 42, referenceUrl: source("metal"), referenceTitle: sourceTitle,
    events: [
      { time: 42, label: ["연결 기록의 반복 편차 시작", "Recurring connection-record deviations begin", "接続記録の繰り返す偏差が開始"] },
      { time: 90, label: ["외관 기록은 참고 띠 안에서 유지", "Appearance records remain within the reference band", "外観記録は基準帯内で維持"] },
    ],
  },
  {
    id: "eds-regions-a-01", processId: "eds", order: 7,
    title: ["EDS · 검사 구역별 결과 비교", "EDS · comparing inspection-region results", "EDS・検査領域別の結果比較"],
    equipment: ["가상 칩별 전기 검사·구역 요약 기록", "Virtual die electrical inspection and region-summary records", "仮想チップ電気検査・領域要約記録"],
    briefing: ["웨이퍼의 검사 구역을 차례로 펼친 가상 요약 기록입니다. 재생 위치는 실제 제조 시간이 아니며, 칩 결과와 검사 장비 상태의 근거를 구분해야 합니다.", "This replay unfolds synthetic inspection-region summaries. Replay position is not actual manufacturing time. Separate die results from evidence about inspection equipment.", "ウェーハの検査領域を順に表示する仮想要約記録です。再生位置は実際の製造時間ではありません。チップ結果と検査装置状態の根拠を区別してください。"],
    objective: ["구역별 칩 검사와 비교 기록을 함께 살펴보고, 검사 결과와 제조 장비 원인 추정을 구분합니다.", "Compare die inspection and comparison records across regions; distinguish results from manufacturing-equipment cause assumptions.", "領域別のチップ検査と比較記録を確認し、検査結果と製造装置の原因の推測を区別します。"],
    referenceRule: ["각 검사 구역은 같은 검사 조건의 해당 구역 참고 기록과 비교합니다. 칩 결과와 검사 비교 기록은 다른 근거입니다.", "Compare each region with its corresponding same-condition reference. Die results and inspection comparison records are different evidence.", "各検査領域を同じ検査条件の対応する参考記録と比較します。チップ結果と検査比較記録は異なる根拠です。"], duration: 90,
    signals: [
      { id: "die", name: ["칩 검사 편차 지수", "Die inspection deviation index", "チップ検査偏差指数"], location: ["구역별 가상 칩 결과 요약", "Synthetic die-result summaries by region", "領域別の仮想チップ結果要約"] },
      { id: "comparison", name: ["검사 비교 지수", "Inspection comparison index", "検査比較指数"], location: ["별도 가상 검사 비교 기록", "Separate virtual inspection comparison records", "別の仮想検査比較記録"] },
    ],
    expectedSignal: "die", changeTime: 60, referenceUrl: source("eds"), referenceTitle: sourceTitle,
    events: [
      { time: 30, label: ["두 번째 검사 구역의 기록으로 이동", "Move to the second inspection-region records", "第2検査領域の記録へ移動"] },
      { time: 60, label: ["다음 구역의 칩 검사 기록에 편차", "Die inspection records differ in the next region", "次の領域のチップ検査記録に偏差"] },
    ],
  },
  {
    id: "packaging-connection-a-01", processId: "packaging", order: 8,
    title: ["패키징 · 연결·외관 기록 관찰","Packaging · observing connection and appearance records","パッケージング・接続と外観記録を観察"],
    equipment: ["가상 패키지 연결·외관 검사", "Virtual package connection and appearance inspection", "仮想パッケージ接続・外観検査"],
    briefing: ["완성 패키지의 연결·외관 기록을 각자의 정상 참고와 비교합니다. 시간에 따라 나타나는 기록의 차이를 각각 정리하세요.","Compare finished-package connection and appearance records with their own references. Describe any differences across time separately.","完成パッケージの接続・外観記録を各々の正常参照と比較します。時間による記録の差を個別に整理してください。"],
    objective: ["관측 구간의 앞뒤와 두 기록을 함께 비교하고, 기록상의 변화와 실제 원인 추정을 구분합니다.","Compare earlier/later intervals and both records, separating recorded changes from real-cause assumptions.","観測区間の前後と二つの記録を比較し、記録の変化と実際の原因の推測を区別します。"],
    referenceRule: sameCondition, duration: 90,
    signals: [
      { id: "connection", name: ["연결 검사 지수", "Connection inspection index", "接続検査指数"], location: ["같은 조건의 가상 패키지 연결 검사", "Virtual package connection inspection under the same conditions", "同じ条件の仮想パッケージ接続検査"] },
      { id: "appearance", name: ["외관 검사 지수", "Appearance inspection index", "外観検査指数"], location: ["같은 패키지의 가상 외관 기록", "Virtual appearance records for the same package", "同じパッケージの仮想外観記録"] },
    ],
    expectedSignal: "connection", changeTime: 50, referenceUrl: source("packaging"), referenceTitle: sourceTitle,
    events: [
      { time: 50, label: ["연결 기록의 추세 변화 시작", "Connection-record trend begins changing", "接続記録の傾向変化が開始"] },
      { time: 70, label: ["연결 기록이 참고값 쪽으로 복귀하기 시작", "Connection records begin returning toward the reference", "接続記録が参考値へ戻り始める"] },
    ],
  },
];

export function getProcessScenario(processIdOrScenarioId: string): ProcessScenario | undefined {
  return processScenarios.find(scenario => scenario.id === processIdOrScenarioId || scenario.processId === processIdOrScenarioId);
}

export function scenarioHref(scenario: ProcessScenario): string {
  return scenario.processId === "etch" ? "/training" : `/training/process/${scenario.processId}`;
}

function boundedTime(scenario: ProcessScenario, time: number) {
  return Math.max(0, Math.min(scenario.duration, Math.floor(Number.isFinite(time) ? time : 0)));
}

function scenarioOffset(processId: ProcessId, time: number): number {
  switch (processId) {
    case "wafer": return time >= 25 ? Math.min(18, (time - 25) * .35) : 0;
    case "photo": return time >= 32 && time < 45 ? 12 : 0;
    case "deposition": return time >= 48 ? -13 : 0;
    case "metal": return time >= 42 && Math.floor((time - 42) / 6) % 2 === 0 ? 11 : 0;
    case "eds": return time >= 60 ? 16 : 0;
    case "packaging": return time < 50 ? 0 : time < 70 ? -Math.min(14, (time - 50) * .8) : -Math.max(0, 14 - (time - 70) * .9);
    default: return 0;
  }
}

export function processSample(scenario: ProcessScenario, signalId: string, time: number) {
  if (scenario.processId === "etch") throw new Error("Use the existing etch scenario engine.");
  const index = scenario.signals.findIndex(signal => signal.id === signalId);
  if (index === -1) throw new Error("Unknown process signal.");
  const t = boundedTime(scenario, time);
  const baseline = scenario.processId === "oxidation" && t < 30 ? 82 : 100;
  const reference = baseline + Math.sin(t * .19 + index) * .4;
  const offset = signalId === scenario.expectedSignal ? scenarioOffset(scenario.processId, t) : 0;
  return { time: t, value: baseline + Math.sin(t * .23 + index) * .6 + offset, reference, low: baseline - 4, high: baseline + 4 };
}

export function processSamples(scenario: ProcessScenario, signalId: string, until: number) {
  return Array.from({ length: boundedTime(scenario, until) + 1 }, (_, time) => processSample(scenario, signalId, time));
}

export type ProcessAnswer = { signal: string; onset: string; comparison: string; certainty: string; facts: string; checks: string };
export type ProcessAttempt = { version: 1; scenarioId: string; elapsed: number; marker: number | null; answer: ProcessAnswer; submitted: boolean; saveKey?: string };

export function emptyProcessAttempt(scenario: ProcessScenario): ProcessAttempt {
  return { version: 1, scenarioId: scenario.id, elapsed: 0, marker: null, submitted: false, answer: { signal: "", onset: "", comparison: "", certainty: "", facts: "", checks: "" } };
}

const answerKeys = ["signal", "onset", "comparison", "certainty", "facts", "checks"] as const;
const integerTime = (value: string, limit: number) => /^(0|[1-9]\d{0,2})$/.test(value) && Number(value) <= limit;
const signalExists = (scenario: ProcessScenario, signal: string) => signal === "none" || scenario.signals.some(item => item.id === signal);

type ProcessChoices = Pick<ProcessAnswer, "signal" | "onset" | "comparison" | "certainty">;

function validProcessChoices(scenario: ProcessScenario, answer: ProcessChoices): boolean {
  return scenario.processId !== "etch" && !!answer && [answer.signal, answer.onset, answer.comparison, answer.certainty].every(value => typeof value === "string") &&
    signalExists(scenario, answer.signal) &&
    (answer.signal === "none" ? answer.onset === "none" : integerTime(answer.onset, scenario.duration)) &&
    ["same-condition", "whole-run"].includes(answer.comparison) && ["uncertain", "certain"].includes(answer.certainty);
}

export function validProcessAnswer(scenario: ProcessScenario, answer: ProcessAnswer): boolean {
  if (!answer || !answerKeys.every(key => typeof answer[key] === "string")) return false;
  return validProcessChoices(scenario, answer) &&
    [answer.facts, answer.checks].every(value => value.trim().length >= 10 && value.length <= 1200);
}

export function restoreProcessAttempt(scenario: ProcessScenario, raw: string | null): ProcessAttempt | null {
  try {
    const value = JSON.parse(raw ?? "null");
    const answer = value?.answer;
    if (scenario.processId === "etch" || value?.version !== 1 || value.scenarioId !== scenario.id ||
      !Number.isInteger(value.elapsed) || value.elapsed < 0 || value.elapsed > scenario.duration ||
      !(value.marker === null || (Number.isInteger(value.marker) && value.marker >= 0 && value.marker <= value.elapsed)) ||
      !answer || !answerKeys.every(key => typeof answer[key] === "string" && answer[key].length <= 1200)) return null;
    if (answer.signal && !signalExists(scenario, answer.signal)) return null;
    if (answer.onset && answer.onset !== "none" && !integerTime(answer.onset, value.elapsed)) return null;
    if (answer.onset === "none" && answer.signal !== "none") return null;
    if (answer.signal === "none" && answer.onset && answer.onset !== "none") return null;
    if (answer.comparison && !["same-condition", "whole-run"].includes(answer.comparison)) return null;
    if (answer.certainty && !["uncertain", "certain"].includes(answer.certainty)) return null;
    return {
      version: 1, scenarioId: scenario.id, elapsed: value.elapsed, marker: value.marker, answer,
      submitted: value.submitted === true && value.elapsed === scenario.duration && validProcessAnswer(scenario, answer),
      saveKey: typeof value.saveKey === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.saveKey) ? value.saveKey : undefined,
    };
  } catch { return null; }
}

// Criteria compare structured choices only; prose meaning and workplace proficiency
// are not scored. A changed inspection result alone never proves a fault cause.
export function processCriteria(scenario: ProcessScenario, answer: ProcessAnswer) {
  if (!validProcessAnswer(scenario, answer)) throw new Error("Complete the process judgment fields.");
  return processChoiceCriteria(scenario, answer);
}

export function processChoiceCriteria(scenario: ProcessScenario, answer: ProcessChoices) {
  if (!validProcessChoices(scenario, answer)) throw new Error("Complete the process judgment choices.");
  return {
    signalMatched: Number(answer.signal === scenario.expectedSignal),
    onsetMatched: Number(scenario.changeTime === null ? answer.onset === "none" : answer.onset !== "none" && Math.abs(Number(answer.onset) - scenario.changeTime) <= 5),
    comparisonMatched: Number(answer.comparison === "same-condition"),
    certaintyMatched: Number(answer.certainty === "uncertain"),
  };
}
