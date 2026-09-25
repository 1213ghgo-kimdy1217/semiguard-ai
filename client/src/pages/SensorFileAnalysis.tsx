import { useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { parseSensorCsv, SENSOR_CSV_MAX_BYTES, type SensorRecord } from "../../../shared/sensorCsv";
import { tr, type ProductLanguage } from "../lib/productLanguage";

type FileNote = { id: string; sensor: string; timestamp: string; value: number; fact: string; possibility: string; nextCheck: string; recordedAt: string };
const displayTime = (time: number, language: ProductLanguage) => new Date(time).toLocaleString(language === "ko" ? "ko-KR" : language === "ja" ? "ja-JP" : "en-US", { hour12: false });

export default function SensorFileAnalysis({ language = "ko" }: { language?: ProductLanguage }) {
  const l = (ko: string, en: string, ja: string) => tr(language, ko, en, ja);
  const [records, setRecords] = useState<SensorRecord[]>([]);
  const [fileName, setFileName] = useState("");
  const [selected, setSelected] = useState("");
  const [inspection, setInspection] = useState(0);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [fact, setFact] = useState("");
  const [possibility, setPossibility] = useState("");
  const [nextCheck, setNextCheck] = useState("");
  const [notes, setNotes] = useState<FileNote[]>([]);
  const sensors = useMemo(() => Array.from(new Set(records.map(record => record.sensor))), [records]);
  const selectedRecords = useMemo(() => records.filter(record => record.sensor === selected), [records, selected]);
  const viewed = selectedRecords[inspection];
  const plot = useMemo(() => {
    const step = Math.max(1, Math.ceil(selectedRecords.length / 300));
    const sampled = selectedRecords.filter((_, index) => index % step === 0);
    const last = selectedRecords.at(-1);
    if (last && sampled.at(-1) !== last) sampled.push(last);
    return sampled;
  }, [selectedRecords]);
  const comparison = useMemo(() => {
    if (!viewed) return [];
    const latest = new Map<string, SensorRecord>();
    for (const row of records) {
      if (row.epochMs > viewed.epochMs) break;
      latest.set(row.sensor, row);
    }
    return sensors.map(sensor => latest.get(sensor)).filter((row): row is SensorRecord => Boolean(row));
  }, [records, sensors, viewed]);

  async function importFile(file: File | undefined) {
    if (!file) return;
    setError("");
    setNotice("");
    if (file.size > SENSOR_CSV_MAX_BYTES) { setError(l("이 브라우저 분석기는 2MB 이하의 CSV 파일을 지원합니다.", "This browser analyzer supports CSV files up to 2 MB.", "このブラウザー分析機能は2 MB以下のCSVファイルに対応します。")); return; }
    try {
      const parsed = parseSensorCsv(await file.text());
      const first = parsed[0].sensor;
      setRecords(parsed);
      setSelected(first);
      setInspection(parsed.filter(row => row.sensor === first).length - 1);
      setFileName(file.name);
      setNotes([]);
      setFact(""); setPossibility(""); setNextCheck("");
      setNotice(`${parsed.length} ${l("개 기록을 브라우저에서 읽었습니다. 출처와 측정 품질은 검증되지 않았습니다.", "records loaded in this browser. Source and measurement quality are unverified.", "件の記録をブラウザーで読み込みました。出典と測定品質は未検証です。")}`);
    } catch (cause) {
      setError(language === "ko" && cause instanceof Error ? cause.message : l("CSV 파일을 읽지 못했습니다.", "Could not read this CSV. Check its headers, timestamps, and numeric values.", "CSVを読み込めませんでした。列名、時刻、数値を確認してください。"));
    }
  }

  function exportNotes() {
    const payload = { kind: "semiguard-sensor-file-analysis", version: 1, source: "user-supplied-csv-unverified", fileName, recordCount: records.length, notes };
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }));
    const link = document.createElement("a"); link.href = url; link.download = "semiguard-file-observations.json"; link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice(l("원본 센서값 없이 관찰 메모와 파일 정보만 내려받았습니다.", "Downloaded notes and file metadata without raw sensor values.", "元のセンサー値を含めず、観察メモとファイル情報をダウンロードしました。"));
  }

  function downloadExample() {
    const example = [
      "timestamp,sensor,value,unit,normal_low,normal_high,location",
      "2026-01-01T00:00:00Z,sensor_a,100,index,95,105,example chamber",
      "2026-01-01T00:00:00Z,sensor_b,42,index,,,example supply",
      "2026-01-01T00:00:03Z,sensor_a,107,index,95,105,example chamber",
      "2026-01-01T00:00:03Z,sensor_b,43,index,,,example supply",
    ].join("\n");
    const url = URL.createObjectURL(new Blob([example], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = "semiguard-sensor-example.csv"; link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return <section className="et-panel sensor-file" aria-label={l("센서 기록 파일 분석", "Sensor-record file analysis", "センサー記録ファイルの分析")}>
    <p className="et-eyebrow">RECORDED DATA / READ ONLY</p>
    <h2>{l("센서 기록 파일 살펴보기", "Explore a sensor-record file", "センサー記録ファイルを見る")}</h2>
    <p>{l("CSV에 담긴 과거 기록을 브라우저 안에서 비교합니다. 파일 내용을 서버로 올리지 않으며, 실제 장비에 연결하거나 명령을 보내지 않습니다. 파일의 출처·측정 품질은 검증되지 않았습니다.", "Compare historical CSV records locally in your browser. File contents are not uploaded to the server, and no commands are sent to real equipment. The source and measurement quality are unverified.", "CSVに含まれる過去の記録をブラウザー内で比較します。ファイルの内容はサーバーに送信せず、実際の装置に接続したり命令を送ったりしません。出典と測定品質は未検証です。")}</p>
    <p className="et-caption">{l("회사 비공개 자료나 개인정보가 포함된 파일은 선택하지 마세요. 시간대가 들어간 ISO 시각과 센서 단위를 그대로 표시하며, 제공되지 않은 정상 범위는 만들어내지 않습니다.", "Do not select files containing confidential company or personal data. ISO timestamps with offsets and sensor units are shown as supplied; missing normal ranges are not invented.", "会社の非公開資料や個人情報を含むファイルは選ばないでください。タイムゾーン付きISO時刻とセンサー単位は提供されたまま表示し、未提供の正常範囲は作りません。")}</p>
    <label htmlFor="sensor-csv">{l("CSV 파일 선택 (최대 2MB · 20,000행)", "Choose CSV (up to 2 MB · 20,000 rows)", "CSVを選択（最大2 MB・20,000行）")}<input id="sensor-csv" type="file" accept=".csv,text/csv" onChange={event => { void importFile(event.target.files?.[0]); event.target.value = ""; }} /></label>
    <Button variant="outline" type="button" onClick={downloadExample}>{l("가상 예시 CSV 내려받기", "Download synthetic example CSV", "仮想サンプルCSVをダウンロード")}</Button>
    <p className="et-caption">{l("필수 열:", "Required columns:", "必須列：")} <code>timestamp,sensor,value,unit</code> · {l("선택 열:", "Optional columns:", "任意列：")} <code>normal_low,normal_high,location</code>. {l("예:", "Example:", "例：")} <code>2026-09-24T00:00:00Z,pressure,100,Pa,95,105,chamber</code></p>
    {error ? <p role="alert" className="et-alert">{error}</p> : null}
    {notice ? <p role="status" className="et-notice">{notice}</p> : null}
    {records.length ? <>
      <div className="et-meta"><span>{l("사용자 제공 파일 · 출처 미검증", "User-supplied file · unverified source", "ユーザー提供ファイル・出典未検証")}</span><span>{fileName} · {l(`${records.length}개 기록 · 센서 ${sensors.length}개`, `${records.length} records · ${sensors.length} sensors`, `${records.length}件の記録・センサー${sensors.length}件`)}</span></div>
      <p className="et-caption">{l("기록 범위:", "Record range:", "記録範囲：")} {displayTime(records[0].epochMs, language)} — {displayTime(records.at(-1)!.epochMs, language)}. {l("이 화면은 정적 파일 분석이며 실시간 설비 모니터링이 아닙니다.", "This is static file analysis, not live equipment monitoring.", "これは静的ファイル分析であり、リアルタイムの装置監視ではありません。")}</p>
      <label htmlFor="csv-sensor">{l("센서 선택", "Choose sensor", "センサーを選択")}<select id="csv-sensor" value={selected} onChange={event => { const sensor = event.target.value; setSelected(sensor); setInspection(records.filter(row => row.sensor === sensor).length - 1); }}>{sensors.map(sensor => <option key={sensor} value={sensor}>{sensor}</option>)}</select></label>
      {viewed ? <>
        <div className="et-sensors"><div className="et-sensor"><span>{viewed.sensor} · {viewed.location || l("위치 미제공", "Location not supplied", "位置未提供")}</span><strong>{viewed.value} <small>{viewed.unit}</small></strong><span>{viewed.low === null ? l("정상 범위 미제공", "Normal range not supplied", "正常範囲未提供") : `${l("제공된 범위", "Supplied range", "提供された範囲")} ${viewed.low}–${viewed.high} ${viewed.unit}`}</span></div></div>
        <div className="et-chart" role="img" aria-label={`${selected} ${l("의 파일 기록 추세. 정상 범위는 파일에 제공된 경우에만 표시됩니다.", "file trend. Normal range is shown only when provided in the file.", "のファイル記録の傾向。正常範囲はファイルで提供された場合のみ表示します。")}`}>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={plot} margin={{ top: 12, right: 12, bottom: 12, left: 0 }}>
              <CartesianGrid stroke="#31465b" strokeDasharray="3 3" />
              <XAxis dataKey="epochMs" type="number" domain={[selectedRecords[0].epochMs, Math.max(selectedRecords.at(-1)!.epochMs, selectedRecords[0].epochMs + 1)]} tickFormatter={value => new Date(value).toLocaleTimeString(language === "ko" ? "ko-KR" : language === "ja" ? "ja-JP" : "en-US", { hour12: false })} stroke="#b5c7d8" fontSize={12} />
              <YAxis domain={["auto", "auto"]} stroke="#b5c7d8" fontSize={12} width={52} />
              <Tooltip labelFormatter={value => displayTime(Number(value), language)} contentStyle={{ background: "#112438", border: "1px solid #657a8c", color: "#fff" }} formatter={(value: number) => `${value} ${viewed.unit}`} />
              <Line name={l("제공된 상한", "Supplied upper limit", "提供された上限")} dataKey="high" stroke="#668878" dot={false} isAnimationActive={false} strokeDasharray="2 4" />
              <Line name={l("제공된 하한", "Supplied lower limit", "提供された下限")} dataKey="low" stroke="#668878" dot={false} isAnimationActive={false} strokeDasharray="2 4" />
              <Line name={l("기록값", "Recorded value", "記録値")} dataKey="value" stroke="#8ed0c3" strokeWidth={2.5} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="et-marker-picker"><label htmlFor="csv-inspection">{l("살펴볼 기록", "Record to inspect", "確認する記録")} {inspection + 1}/{selectedRecords.length} · {displayTime(viewed.epochMs, language)}</label><input id="csv-inspection" type="range" min={0} max={Math.max(0, selectedRecords.length - 1)} value={inspection} disabled={selectedRecords.length < 2} onChange={event => setInspection(Number(event.target.value))} /></div>
        <div className="et-table" role="region" aria-label={l("선택 시각까지의 센서 기록", "Sensor records through selected time", "選択時刻までのセンサー記録")} tabIndex={0}><table><caption>{l("선택 시각 이전의 각 센서 최신 기록 · 동시 측정이라는 뜻은 아닙니다", "Latest record for each sensor at or before the selected time · not necessarily measured simultaneously", "選択時刻以前の各センサーの最新記録・同時測定とは限りません")}</caption><thead><tr><th scope="col">{l("센서", "Sensor", "センサー")}</th><th scope="col">{l("측정 시각", "Measured at", "測定時刻")}</th><th scope="col">{l("기록값", "Recorded value", "記録値")}</th><th scope="col">{l("제공된 정상 범위", "Supplied normal range", "提供された正常範囲")}</th></tr></thead><tbody>{comparison.map(row => <tr key={row.sensor}><th scope="row">{row.sensor}</th><td>{displayTime(row.epochMs, language)}</td><td>{row.value} {row.unit}</td><td>{row.low === null ? l("없음", "None", "なし") : `${row.low}–${row.high} ${row.unit}`}</td></tr>)}</tbody></table></div>
        <form className="et-form" onSubmit={event => { event.preventDefault(); setNotes(current => [...current, { id: crypto.randomUUID(), sensor: viewed.sensor, timestamp: viewed.timestamp, value: viewed.value, fact: fact.trim(), possibility: possibility.trim(), nextCheck: nextCheck.trim(), recordedAt: new Date().toISOString() }]); setFact(""); setPossibility(""); setNextCheck(""); setNotice(l("선택한 기록의 관찰 근거를 남겼습니다.", "Evidence recorded for the selected row.", "選択した記録の観察根拠を残しました。")); }}>
          <h3>{l("관찰 근거 남기기", "Record observation evidence", "観察の根拠を記録")}</h3><p className="et-caption">{l("관찰한 사실과 가능한 원인 후보를 구분하세요. 특정 고장을 확정하거나 설비 조작을 지시하지 않습니다.", "Separate observed facts from possible causes. Do not claim a specific failure or instruct equipment operation.", "観察した事実と考えられる原因候補を分けてください。特定の故障を断定したり装置操作を指示したりしません。")}</p>
          <label htmlFor="csv-fact">{l("관찰한 사실", "Observed facts", "観察した事実")}<textarea id="csv-fact" required minLength={10} maxLength={600} rows={3} value={fact} onChange={event => setFact(event.target.value)} /></label>
          <label htmlFor="csv-possibility">{l("가능한 설명 후보 · 미확정", "Possible explanation · unconfirmed", "考えられる説明候補・未確定")}<textarea id="csv-possibility" maxLength={600} rows={2} value={possibility} onChange={event => setPossibility(event.target.value)} /></label>
          <label htmlFor="csv-next">{l("다음에 확인할 정보", "Information for the next check", "次に確認する情報")}<textarea id="csv-next" maxLength={600} rows={2} value={nextCheck} onChange={event => setNextCheck(event.target.value)} /></label>
          <Button className="et-primary" type="submit">{l("이 기록에 근거 남기기", "Record evidence for this row", "この記録に根拠を残す")}</Button>
        </form>
        <h3>{l("이번 파일의 관찰 메모", "Observation notes for this file", "このファイルの観察メモ")} ({notes.length})</h3>
        {notes.length ? <ol className="sensor-file-notes">{notes.map(note => <li key={note.id}><h4>{note.sensor} · {note.timestamp} · {note.value}</h4><p><b>{l("사실", "Fact", "事実")}</b> {note.fact}</p><p><b>{l("가능한 설명", "Possible explanation", "考えられる説明")}</b> {note.possibility || l("미기재", "Not provided", "未記入")}</p><p><b>{l("다음 확인", "Next check", "次の確認")}</b> {note.nextCheck || l("미기재", "Not provided", "未記入")}</p><Button variant="ghost" aria-label={`${note.timestamp} ${l("메모 취소", "remove note", "メモを取り消す")}`} onClick={() => setNotes(current => current.filter(item => item.id !== note.id))}>{l("기록 취소", "Remove note", "記録を取り消す")}</Button></li>)}</ol> : <p>{l("아직 메모가 없습니다.", "No notes yet.", "まだメモはありません。")}</p>}
        <Button variant="outline" disabled={!notes.length} onClick={exportNotes}>{l("메모 파일 내려받기", "Download note file", "メモファイルをダウンロード")}</Button>
        <p className="et-caption">{l("이 파일과 메모는 현재 화면의 메모리에만 있습니다. 새로고침하거나 이동하면 사라지므로 필요한 메모는 내려받으세요.", "This file and its notes exist only in this screen's memory. They disappear on refresh or navigation, so download important notes.", "このファイルとメモは現在の画面のメモリーにのみあります。更新や移動で消えるため、必要なメモはダウンロードしてください。")}</p>
      </> : null}
    </> : null}
  </section>;
}
