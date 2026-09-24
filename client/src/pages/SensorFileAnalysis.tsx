import { useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { parseSensorCsv, SENSOR_CSV_MAX_BYTES, type SensorRecord } from "../../../shared/sensorCsv";

type FileNote = { id: string; sensor: string; timestamp: string; value: number; fact: string; possibility: string; nextCheck: string; recordedAt: string };
const displayTime = (time: number) => new Date(time).toLocaleString("ko-KR", { hour12: false });

export default function SensorFileAnalysis() {
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
    if (file.size > SENSOR_CSV_MAX_BYTES) { setError("이 브라우저 분석기는 2MB 이하의 CSV 파일을 지원합니다."); return; }
    try {
      const parsed = parseSensorCsv(await file.text());
      const first = parsed[0].sensor;
      setRecords(parsed);
      setSelected(first);
      setInspection(parsed.filter(row => row.sensor === first).length - 1);
      setFileName(file.name);
      setNotes([]);
      setFact(""); setPossibility(""); setNextCheck("");
      setNotice(`${parsed.length}개 기록을 브라우저에서 읽었습니다. 출처와 측정 품질은 검증되지 않았습니다.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "CSV 파일을 읽지 못했습니다.");
    }
  }

  function exportNotes() {
    const payload = { kind: "semiguard-sensor-file-analysis", version: 1, source: "user-supplied-csv-unverified", fileName, recordCount: records.length, notes };
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }));
    const link = document.createElement("a"); link.href = url; link.download = "semiguard-file-observations.json"; link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice("원본 센서값 없이 관찰 메모와 파일 정보만 내려받았습니다.");
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

  return <section className="et-panel sensor-file" aria-label="센서 기록 파일 분석">
    <p className="et-eyebrow">RECORDED DATA / READ ONLY</p>
    <h2>센서 기록 파일 살펴보기</h2>
    <p>CSV에 담긴 과거 기록을 브라우저 안에서 비교합니다. 파일 내용을 서버로 올리지 않으며, 실제 장비에 연결하거나 명령을 보내지 않습니다. 파일의 출처·측정 품질은 검증되지 않았습니다.</p>
    <p className="et-caption">회사 비공개 자료나 개인정보가 포함된 파일은 선택하지 마세요. 시간대가 들어간 ISO 시각과 센서 단위를 그대로 표시하며, 제공되지 않은 정상 범위는 만들어내지 않습니다.</p>
    <label htmlFor="sensor-csv">CSV 파일 선택 (최대 2MB · 20,000행)<input id="sensor-csv" type="file" accept=".csv,text/csv" onChange={event => { void importFile(event.target.files?.[0]); event.target.value = ""; }} /></label>
    <Button variant="outline" type="button" onClick={downloadExample}>가상 예시 CSV 내려받기</Button>
    <p className="et-caption">필수 열: <code>timestamp,sensor,value,unit</code> · 선택 열: <code>normal_low,normal_high,location</code>. 예: <code>2026-09-24T00:00:00Z,pressure,100,Pa,95,105,chamber</code></p>
    {error ? <p role="alert" className="et-alert">{error}</p> : null}
    {notice ? <p role="status" className="et-notice">{notice}</p> : null}
    {records.length ? <>
      <div className="et-meta"><span>사용자 제공 파일 · 출처 미검증</span><span>{fileName} · {records.length}개 기록 · 센서 {sensors.length}개</span></div>
      <p className="et-caption">기록 범위: {displayTime(records[0].epochMs)} — {displayTime(records.at(-1)!.epochMs)}. 이 화면은 정적 파일 분석이며 실시간 설비 모니터링이 아닙니다.</p>
      <label htmlFor="csv-sensor">센서 선택<select id="csv-sensor" value={selected} onChange={event => { const sensor = event.target.value; setSelected(sensor); setInspection(records.filter(row => row.sensor === sensor).length - 1); }}>{sensors.map(sensor => <option key={sensor} value={sensor}>{sensor}</option>)}</select></label>
      {viewed ? <>
        <div className="et-sensors"><div className="et-sensor"><span>{viewed.sensor} · {viewed.location || "위치 미제공"}</span><strong>{viewed.value} <small>{viewed.unit}</small></strong><span>{viewed.low === null ? "정상 범위 미제공" : `제공된 범위 ${viewed.low}–${viewed.high} ${viewed.unit}`}</span></div></div>
        <div className="et-chart" role="img" aria-label={`${selected}의 파일 기록 추세. 정상 범위는 파일에 제공된 경우에만 표시됩니다.`}>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={plot} margin={{ top: 12, right: 12, bottom: 12, left: 0 }}>
              <CartesianGrid stroke="#31465b" strokeDasharray="3 3" />
              <XAxis dataKey="epochMs" type="number" domain={[selectedRecords[0].epochMs, Math.max(selectedRecords.at(-1)!.epochMs, selectedRecords[0].epochMs + 1)]} tickFormatter={value => new Date(value).toLocaleTimeString("ko-KR", { hour12: false })} stroke="#b5c7d8" fontSize={12} />
              <YAxis domain={["auto", "auto"]} stroke="#b5c7d8" fontSize={12} width={52} />
              <Tooltip labelFormatter={value => displayTime(Number(value))} contentStyle={{ background: "#112438", border: "1px solid #657a8c", color: "#fff" }} formatter={(value: number) => `${value} ${viewed.unit}`} />
              <Line name="제공된 상한" dataKey="high" stroke="#668878" dot={false} isAnimationActive={false} strokeDasharray="2 4" />
              <Line name="제공된 하한" dataKey="low" stroke="#668878" dot={false} isAnimationActive={false} strokeDasharray="2 4" />
              <Line name="기록값" dataKey="value" stroke="#8ed0c3" strokeWidth={2.5} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="et-marker-picker"><label htmlFor="csv-inspection">살펴볼 기록 {inspection + 1}/{selectedRecords.length} · {displayTime(viewed.epochMs)}</label><input id="csv-inspection" type="range" min={0} max={Math.max(0, selectedRecords.length - 1)} value={inspection} disabled={selectedRecords.length < 2} onChange={event => setInspection(Number(event.target.value))} /></div>
        <div className="et-table" role="region" aria-label="선택 시각까지의 센서 기록" tabIndex={0}><table><caption>선택 시각 이전의 각 센서 최신 기록 · 동시 측정이라는 뜻은 아닙니다</caption><thead><tr><th scope="col">센서</th><th scope="col">측정 시각</th><th scope="col">기록값</th><th scope="col">제공된 정상 범위</th></tr></thead><tbody>{comparison.map(row => <tr key={row.sensor}><th scope="row">{row.sensor}</th><td>{displayTime(row.epochMs)}</td><td>{row.value} {row.unit}</td><td>{row.low === null ? "없음" : `${row.low}–${row.high} ${row.unit}`}</td></tr>)}</tbody></table></div>
        <form className="et-form" onSubmit={event => { event.preventDefault(); setNotes(current => [...current, { id: crypto.randomUUID(), sensor: viewed.sensor, timestamp: viewed.timestamp, value: viewed.value, fact: fact.trim(), possibility: possibility.trim(), nextCheck: nextCheck.trim(), recordedAt: new Date().toISOString() }]); setFact(""); setPossibility(""); setNextCheck(""); setNotice("선택한 기록의 관찰 근거를 남겼습니다."); }}>
          <h3>관찰 근거 남기기</h3><p className="et-caption">관찰한 사실과 가능한 원인 후보를 구분하세요. 특정 고장을 확정하거나 설비 조작을 지시하지 않습니다.</p>
          <label htmlFor="csv-fact">관찰한 사실<textarea id="csv-fact" required minLength={10} maxLength={600} rows={3} value={fact} onChange={event => setFact(event.target.value)} /></label>
          <label htmlFor="csv-possibility">가능한 설명 후보 · 미확정<textarea id="csv-possibility" maxLength={600} rows={2} value={possibility} onChange={event => setPossibility(event.target.value)} /></label>
          <label htmlFor="csv-next">다음에 확인할 정보<textarea id="csv-next" maxLength={600} rows={2} value={nextCheck} onChange={event => setNextCheck(event.target.value)} /></label>
          <Button className="et-primary" type="submit">이 기록에 근거 남기기</Button>
        </form>
        <h3>이번 파일의 관찰 메모 ({notes.length}개)</h3>
        {notes.length ? <ol className="sensor-file-notes">{notes.map(note => <li key={note.id}><h4>{note.sensor} · {note.timestamp} · {note.value}</h4><p><b>사실</b> {note.fact}</p><p><b>가능한 설명</b> {note.possibility || "미기재"}</p><p><b>다음 확인</b> {note.nextCheck || "미기재"}</p><Button variant="ghost" aria-label={`${note.timestamp} 메모 취소`} onClick={() => setNotes(current => current.filter(item => item.id !== note.id))}>기록 취소</Button></li>)}</ol> : <p>아직 메모가 없습니다.</p>}
        <Button variant="outline" disabled={!notes.length} onClick={exportNotes}>메모 파일 내려받기</Button>
        <p className="et-caption">이 파일과 메모는 현재 화면의 메모리에만 있습니다. 새로고침하거나 이동하면 사라지므로 필요한 메모는 내려받으세요.</p>
      </> : null}
    </> : null}
  </section>;
}
