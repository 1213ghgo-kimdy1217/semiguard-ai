export const trainingSensors = [
  { id: "current", name: "전류", unit: "A", range: [4.5, 5.5], domain: [4, 6], values: [5, 5.1, 5, 4.9, 5, 5.1, 5, 5.1, 5.1, 5.2, 5.1, 5.2, 5.2] },
  { id: "temperature", name: "온도", unit: "°C", range: [42, 48], domain: [40, 50], values: [45, 45.1, 44.9, 45, 45.2, 45, 45.1, 45.2, 45.1, 45.3, 45.2, 45.1, 45.2] },
  { id: "vibration", name: "진동", unit: "mm/s", range: [1.7, 2.3], domain: [1, 4], values: [2, 2.1, 2, 1.9, 2, 2.1, 2.4, 2.6, 2.8, 3, 3.2, 3.4, 3.6] },
  { id: "noise", name: "소음", unit: "dB", range: [51, 59], domain: [48, 62], values: [55, 55.4, 54.8, 55, 55.2, 55.1, 55.5, 55.2, 55.4, 55.6, 55.3, 55.7, 55.5] },
] as const;
export const evidenceChoices = ["정상 범위와 현재값 비교", "같은 시점의 다른 센서 비교", "위험 점수만 확인"];
export const checkChoices = ["센서 기록·측정 조건 확인", "운전 조건·과거 정상 이력 비교", "매뉴얼·점검 이력 대조 및 담당자와 검토"];
export type TrainingAnswer = { sensor: string; onset: string; certainty: string; evidence: string[]; order: string[]; explanation: string };
export const emptyAnswer = (): TrainingAnswer => ({ sensor: "", onset: "", certainty: "", evidence: [], order: [], explanation: "" });
export function isComplete(a: TrainingAnswer) {
  return trainingSensors.some(s => s.id === a.sensor) && /^([0-9]|1[0-2])$/.test(a.onset) && ["uncertain", "certain"].includes(a.certainty) && a.evidence.length > 0 && a.evidence.every(e => evidenceChoices.includes(e)) && a.order.length === 3 && new Set(a.order).size === 3 && a.order.every(e => checkChoices.includes(e)) && a.explanation.trim().length >= 20 && a.explanation.length <= 1200;
}
export function evaluateAnswer(a: TrainingAnswer) {
  if (!isComplete(a)) throw new Error("모든 판단 항목을 작성해 주세요.");
  return [
    { label: "주요 변화 발견", selected: trainingSensors.find(s => s.id === a.sensor)?.name ?? a.sensor, ok: a.sensor === "vibration", detail: "진동은 2.0에서 3.6 mm/s로 지속 상승합니다. 나머지 센서는 가상 정상 범위 안에 있습니다." },
    { label: "정상 상태와 비교", selected: a.evidence.join(" · "), ok: a.evidence.includes(evidenceChoices[0]), detail: "진동의 교육용 기준은 1.7–2.3 mm/s입니다. 마지막 값은 상한보다 1.3 mm/s 높습니다." },
    { label: "변화 시점 확인", selected: `${Number(a.onset) * 2}분`, ok: Number(a.onset) >= 5 && Number(a.onset) <= 6, detail: "10–12분 구간에서 지속 상승이 시작됩니다. 12분에 처음 상한을 넘습니다. 추세 시작과 범위 이탈 시점은 구분합니다." },
    { label: "센서 간 교차 확인", selected: a.evidence.join(" · "), ok: a.evidence.includes(evidenceChoices[1]) && !a.evidence.includes(evidenceChoices[2]), detail: "같은 시점의 전류·온도·소음과 비교해야 합니다. 하나의 합산 점수만으로 원인을 알 수 없습니다." },
    { label: "현상과 원인 구분", selected: a.certainty === "uncertain" ? "추가 확인이 필요합니다" : "확정할 수 있습니다", ok: a.certainty === "uncertain", detail: "관찰된 사실은 진동 상승입니다. 측정 조건이나 운전 조건 등은 확인할 후보이며 특정 부품 고장으로 확정할 수 없습니다." },
    { label: "다음 확인 순서", selected: a.order.map((v, i) => `${i + 1}. ${v}`).join(" → "), ok: true, detail: "권장 예시: 기록·측정 조건 → 운전 조건·정상 이력 → 매뉴얼·점검 이력과 담당자 검토. 먼저 데이터의 신뢰성을 살피고 맥락을 비교하는 구성입니다. 다른 순서도 상황과 근거에 따라 가능하므로 순서만으로 정오를 판정하지 않습니다. 교사·전문가 검토 전의 교육용 예시이며 실제 장비 조작 지침이 아닙니다." },
  ];
}
export function restoreAttempt(raw: string | null): { answer: TrainingAnswer; submitted: boolean } | null {
  try {
    const v = JSON.parse(raw || "null");
    const a = v?.answer;
    if (v?.version !== 1 || !a || ![a.sensor, a.onset, a.certainty, a.explanation].every(x => typeof x === "string") || a.explanation.length > 1200 || !Array.isArray(a.evidence) || !Array.isArray(a.order) || !a.evidence.every((x: unknown) => typeof x === "string" && evidenceChoices.includes(x)) || !a.order.every((x: unknown) => typeof x === "string" && checkChoices.includes(x))) return null;
    return { answer: a, submitted: v.submitted === true && isComplete(a) };
  } catch { return null; }
}
