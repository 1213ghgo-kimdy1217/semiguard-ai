export const SENSOR_CSV_MAX_BYTES = 2_000_000;
export const SENSOR_CSV_MAX_ROWS = 20_000;

export type SensorRecord = {
  timestamp: string;
  epochMs: number;
  sensor: string;
  value: number;
  unit: string;
  low: number | null;
  high: number | null;
  location: string;
};

function csvRows(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') { field += '"'; index++; }
      else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') {
      if (field) throw new Error("CSV 따옴표 형식이 올바르지 않습니다.");
      quoted = true;
    } else if (char === ",") {
      row.push(field); field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[index + 1] === "\n") index++;
      row.push(field); field = "";
      if (row.some(value => value.trim())) rows.push(row);
      row = [];
      if (rows.length > SENSOR_CSV_MAX_ROWS + 1) throw new Error("한 파일에서 최대 20,000개 기록을 읽을 수 있습니다.");
    } else field += char;
  }
  if (quoted) throw new Error("CSV 따옴표가 닫히지 않았습니다.");
  row.push(field);
  if (row.some(value => value.trim())) rows.push(row);
  return rows;
}

const TIMESTAMP_WITH_ZONE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/;

export function parseSensorCsv(text: string): SensorRecord[] {
  if (!text || text.length > SENSOR_CSV_MAX_BYTES) throw new Error("2MB 이하의 CSV 파일을 선택하세요.");
  const rows = csvRows(text.replace(/^\uFEFF/, ""));
  if (rows.length < 2 || rows.length - 1 > SENSOR_CSV_MAX_ROWS) throw new Error("헤더와 1–20,000개의 센서 기록이 필요합니다.");
  const headers = rows[0].map(value => value.trim().toLowerCase());
  if (new Set(headers).size !== headers.length) throw new Error("CSV 헤더가 중복되었습니다.");
  for (const required of ["timestamp", "sensor", "value", "unit"]) {
    if (!headers.includes(required)) throw new Error(`필수 열 ${required}이(가) 없습니다.`);
  }
  if (headers.includes("normal_low") !== headers.includes("normal_high")) {
    throw new Error("정상 범위는 normal_low와 normal_high를 함께 제공하세요.");
  }
  const column = (row: string[], name: string) => {
    const position = headers.indexOf(name);
    return position < 0 ? "" : row[position].trim();
  };
  const sensors = new Map<string, { unit: string; location: string }>();
  const seen = new Set<string>();
  const records = rows.slice(1).map((row, index) => {
    if (row.length !== headers.length) throw new Error(`${index + 2}행의 열 수가 헤더와 다릅니다.`);
    const timestamp = column(row, "timestamp");
    const epochMs = Date.parse(timestamp);
    if (!TIMESTAMP_WITH_ZONE.test(timestamp) || !Number.isFinite(epochMs)) {
      throw new Error(`${index + 2}행의 시각은 시간대가 포함된 ISO 형식이어야 합니다.`);
    }
    const sensor = column(row, "sensor");
    const unit = column(row, "unit");
    const location = column(row, "location");
    if (!sensor || sensor.length > 80 || !unit || unit.length > 24 || location.length > 100 || /[\r\n\u0000-\u001f]/.test(`${sensor}${unit}${location}`)) {
      throw new Error(`${index + 2}행의 센서 이름·단위·위치가 올바르지 않습니다.`);
    }
    const valueText = column(row, "value");
    const value = Number(valueText);
    if (!valueText || !Number.isFinite(value)) throw new Error(`${index + 2}행의 값이 숫자가 아닙니다.`);
    const lowText = column(row, "normal_low");
    const highText = column(row, "normal_high");
    if (Boolean(lowText) !== Boolean(highText)) throw new Error(`${index + 2}행의 정상 범위가 불완전합니다.`);
    const low = lowText ? Number(lowText) : null;
    const high = highText ? Number(highText) : null;
    if (low !== null && (high === null || !Number.isFinite(low) || !Number.isFinite(high) || low > high)) {
      throw new Error(`${index + 2}행의 정상 범위가 올바르지 않습니다.`);
    }
    const known = sensors.get(sensor);
    if (known && (known.unit !== unit || known.location !== location)) throw new Error(`${sensor}의 단위나 위치가 행마다 다릅니다.`);
    sensors.set(sensor, { unit, location });
    const key = `${epochMs}\u0000${sensor}`;
    if (seen.has(key)) throw new Error(`${sensor}의 같은 시각 기록이 중복되었습니다.`);
    seen.add(key);
    return { timestamp, epochMs, sensor, value, unit, low, high, location };
  });
  return records.sort((left, right) => left.epochMs - right.epochMs || left.sensor.localeCompare(right.sensor));
}
