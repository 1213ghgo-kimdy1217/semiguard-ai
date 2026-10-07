import { NORMAL_BASELINE } from "../shared/semiguard";

export const DASHBOARD_HISTORY_SECONDS = 300;
export const DASHBOARD_HISTORY_LIMIT = 60;
type Sensor = keyof typeof NORMAL_BASELINE;
const sensors = Object.keys(NORMAL_BASELINE) as Sensor[];
const units = { current: "A", temperature: "°C", vibration: "mm/s", noise: "dB" };
const round = (value: number) => Number(value.toFixed(3));

export type DashboardSnapshot = Record<Sensor, number> & { anomalyScore: number; riskLevel: string; logId?: number };
export type DashboardHistoryRow = Record<Sensor, number> & { id: number; timestamp: Date };

export function matchesDashboardSnapshot(snapshot: DashboardSnapshot, saved: DashboardSnapshot) {
  return sensors.every(sensor => Number.isFinite(saved[sensor]) && Number.isFinite(snapshot[sensor])
    && Math.abs(saved[sensor] - snapshot[sensor]) < 0.0001)
    && saved.anomalyScore === snapshot.anomalyScore && saved.riskLevel === snapshot.riskLevel;
}

export function buildDashboardHistoryEvidence(anchor: DashboardHistoryRow, rows: DashboardHistoryRow[]) {
  const end = anchor.timestamp.getTime();
  const start = end - DASHBOARD_HISTORY_SECONDS * 1000;
  const ids = new Set<number>();
  const valid = rows.filter(row => {
    const time = row.timestamp.getTime();
    if (!Number.isFinite(time) || time < start || time > end || row.id > anchor.id
      || ids.has(row.id) || !sensors.every(sensor => Number.isFinite(row[sensor]))) return false;
    ids.add(row.id);
    return true;
  }).sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime() || a.id - b.id);
  const selected = valid.slice(-DASHBOARD_HISTORY_LIMIT);
  const last = selected.at(-1);
  if (selected.length < 2 || last?.id !== anchor.id
    || !sensors.every(sensor => round(last[sensor]) === round(anchor[sensor]))) {
    return { status: "insufficient-records" as const };
  }
  const first = selected[0];
  const maxGap = Math.max(...selected.slice(1).map((row, index) => (row.timestamp.getTime() - selected[index].timestamp.getTime()) / 1000));
  const coverageSeconds = (last.timestamp.getTime() - first.timestamp.getTime()) / 1000;
  return {
    status: "available" as const,
    source: "account-synthetic-records" as const,
    window: {
      startAt: first.timestamp.toISOString(), endAt: last.timestamp.toISOString(), timeZone: "UTC",
      requestedSeconds: DASHBOARD_HISTORY_SECONDS, sampleCount: selected.length,
      coverageSeconds,
      coverageLabel: { ko: `${coverageSeconds}초`, en: `${coverageSeconds} seconds`, ja: `${coverageSeconds}秒` },
      maxGapSeconds: maxGap, limitedByRowCount: valid.length >= DASHBOARD_HISTORY_LIMIT,
    },
    sensors: sensors.map(sensor => {
      const { mean, std } = NORMAL_BASELINE[sensor];
      const lower = round(mean - std), upper = round(mean + std);
      const values = selected.map(row => round(row[sensor]));
      const outsideIndex = values.findIndex(value => value < lower || value > upper);
      return {
        sensor, unit: units[sensor], lower, upper,
        outsideCondition: {
          ko: `${lower} ${units[sensor]} 미만 또는 ${upper} ${units[sensor]} 초과`,
          en: `less than ${lower} ${units[sensor]} or greater than ${upper} ${units[sensor]}`,
          ja: `${lower} ${units[sensor]}未満または${upper} ${units[sensor]}を超過`,
        },
        firstValue: values[0], lastValue: values.at(-1)!, delta: round(values.at(-1)! - values[0]),
        minimum: Math.min(...values), maximum: Math.max(...values),
        firstRecordedOutsideAt: outsideIndex < 0 ? null : selected[outsideIndex].timestamp.toISOString(),
        firstRecordedOutsideValue: outsideIndex < 0 ? null : values[outsideIndex],
        precedingRecordedInsideAt: outsideIndex > 0 ? selected[outsideIndex - 1].timestamp.toISOString() : null,
        outsideAtWindowStart: outsideIndex === 0,
      };
    }),
  };
}

export type DashboardHistoryEvidence = ReturnType<typeof buildDashboardHistoryEvidence>
  | { status: "no-linked-observation" | "snapshot-mismatch" | "unavailable" };
