import { useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from "react";
import { usePrototypeCamera, type PrototypeCameraError } from "../hooks/usePrototypeCamera";
import {
  BOOTH_CAMERA_SIGNALS, boothOverlayBox, cameraLayoutStorageKey,
  defaultBoothCameraLayout, fitBoothOverlayPoint, readBoothCameraLayout,
  type BoothCameraLayout, type BoothCameraSignal, type OverlayPart, type OverlayPoint,
} from "../../../shared/boothCameraLayout";
import "./booth-camera-overlay.css";

export type BoothSignal = BoothCameraSignal;
export type BoothCameraOverlayProps = {
  values: Record<BoothSignal, number>;
  alarms: Record<BoothSignal, boolean>;
  onClose?: () => void;
};

const metadata: Record<BoothSignal, { number: number; label: string; unit: string; decimals: number }> = {
  pressure: { number: 1, label: "챔버 압력", unit: "mTorr", decimals: 1 },
  gasFlow: { number: 2, label: "가스 유량", unit: "sccm", decimals: 1 },
  rfPower: { number: 3, label: "RF 전력", unit: "W", decimals: 0 },
  chamberAmbientTemp: { number: 4, label: "챔버 주변 온도", unit: "°C", decimals: 1 },
};
const errors: Record<PrototypeCameraError, string> = {
  unsupported: "이 브라우저는 카메라 연결을 지원하지 않아요. 데스크톱 Chrome 또는 Edge에서 열어주세요.",
  "insecure-context": "카메라는 HTTPS 또는 localhost에서 연결할 수 있어요.",
  "iframe-blocked": "현재 창의 권한 정책이 카메라를 막고 있어요. 별도 창에서 카메라 권한을 확인해주세요.",
  "permission-denied": "카메라 권한이 허용되지 않았어요. 사이트의 카메라 권한을 확인한 뒤 다시 연결해주세요.",
  "no-device": "카메라를 찾지 못했어요. 웹캠 USB를 연결하고 장치 목록을 새로고침해주세요.",
  "device-busy": "카메라를 시작하지 못했어요. 다른 카메라·화상회의 앱을 닫고 다시 연결해주세요.",
  constraints: "선택한 카메라를 사용할 수 없어요. 장치 목록에서 다시 선택해주세요.",
  "device-ended": "카메라 영상이 종료됐어요. USB와 권한을 확인한 뒤 다시 연결해주세요.",
  "device-lost": "연결한 카메라가 분리됐어요. USB를 다시 연결해주세요.",
  "playback-blocked": "브라우저가 영상 재생을 막았어요. 다시 연결 버튼을 눌러주세요.",
  "stream-unavailable": "카메라 영상이 재생되지 않아요. 다른 카메라를 선택하거나 다시 연결해주세요.",
  unknown: "카메라를 연결하지 못했어요. USB와 카메라 권한을 확인해주세요.",
};
type Target = { signal: BoothSignal; part: OverlayPart };
type Drag = Target & { pointerId: number; x: number; y: number; point: OverlayPoint };

function formatValue(signal: BoothSignal, value: number) {
  return Number.isFinite(value) ? value.toFixed(metadata[signal].decimals) : "—";
}

/** Values and alarm flags are props from the same scenario clock as the lamp. */
export default function BoothCameraOverlay({ values, alarms, onClose }: BoothCameraOverlayProps) {
  const camera = usePrototypeCamera();
  const heading = useId(), select = useId();
  const frameRef = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const [size, setSize] = useState({ width: 640, height: 360 });
  const [layout, setLayout] = useState<BoothCameraLayout>(defaultBoothCameraLayout);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [adjusting, setAdjusting] = useState(false);
  const [selected, setSelected] = useState<Target>({ signal: "pressure", part: "marker" });
  const playing = camera.status === "playing";
  const active = ["requesting", "connected", "ready", "playing"].includes(camera.status);
  const ratio = camera.width > 0 && camera.height > 0 ? camera.width / camera.height : 16 / 9;
  // Choosing the next device must not move labels on the stream still playing.
  const activeIdentity = camera.activeDeviceLabel
    ? camera.devices.find(device => device.label === camera.activeDeviceLabel)?.deviceId || camera.activeDeviceLabel
    : camera.selectedDeviceId;
  const storageKey = cameraLayoutStorageKey(activeIdentity || "default", camera.width, camera.height);
  const error = camera.error ?? (!camera.secureContext ? "insecure-context" : !camera.supported ? "unsupported" : camera.cameraPolicyAllowed === false ? "iframe-blocked" : null);

  useEffect(() => {
    const element = frameRef.current;
    if (!element) return;
    const read = () => {
      const rect = element.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) setSize({ width: rect.width, height: rect.height });
    };
    read();
    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(read); observer.observe(element);
      return () => observer.disconnect();
    }
    window.addEventListener("resize", read);
    return () => window.removeEventListener("resize", read);
  }, [ratio]);

  useEffect(() => {
    let raw: string | null = null;
    try { raw = localStorage.getItem(storageKey); } catch { /* Private browsing. */ }
    setLayout(readBoothCameraLayout(raw));
    setLoadedKey(storageKey);
  }, [storageKey]);
  useEffect(() => {
    if (loadedKey !== storageKey) return;
    try { localStorage.setItem(storageKey, JSON.stringify(layout)); } catch { /* The overlay still works without storage. */ }
  }, [layout, loadedKey, storageKey]);
  useEffect(() => {
    if (!playing) { drag.current = null; setAdjusting(false); }
  }, [playing]);

  function position(signal: BoothSignal, part: OverlayPart) {
    return fitBoothOverlayPoint(layout[signal][part], part, size.width, size.height);
  }
  function change(target: Target, point: OverlayPoint) {
    const fitted = fitBoothOverlayPoint(point, target.part, size.width, size.height);
    setLayout(previous => ({ ...previous, [target.signal]: { ...previous[target.signal], [target.part]: fitted } }));
  }
  function move(dx: number, dy: number, target = selected) {
    const point = position(target.signal, target.part);
    change(target, { x: point.x + dx, y: point.y + dy });
  }
  function begin(event: PointerEvent<HTMLButtonElement>, target: Target) {
    if (!adjusting || !playing) return;
    event.preventDefault(); setSelected(target);
    drag.current = { ...target, pointerId: event.pointerId, x: event.clientX, y: event.clientY, point: position(target.signal, target.part) };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.currentTarget.focus();
  }
  function during(event: PointerEvent<HTMLButtonElement>) {
    const current = drag.current;
    if (!current || current.pointerId !== event.pointerId || !adjusting) return;
    event.preventDefault();
    change(current, { x: current.point.x + (event.clientX - current.x) / size.width, y: current.point.y + (event.clientY - current.y) / size.height });
  }
  function end(event: PointerEvent<HTMLButtonElement>) {
    if (drag.current?.pointerId !== event.pointerId) return;
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }
  function keyboard(event: KeyboardEvent<HTMLButtonElement>, target: Target) {
    if (!adjusting) return;
    const step = event.shiftKey ? .03 : .01;
    const directions: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (directions[event.key]) { event.preventDefault(); setSelected(target); move(...directions[event.key], target); }
    if (event.key === "Escape") { setAdjusting(false); drag.current = null; }
  }
  function close() { camera.stop(); onClose?.(); }

  return <section className="bc-camera" aria-labelledby={heading} data-camera-status={camera.status}>
    <header className="bc-heading">
      <div><p className="bc-eyebrow">MODEL CAMERA</p><h2 id={heading}>모형 내부 보기</h2></div>
      <span className={`bc-status ${playing ? "is-live" : ""}`}>{playing ? "카메라 실시간" : active ? "영상 연결 중" : "카메라 미연결"}</span>
      {onClose && <button type="button" className="bc-button bc-close" onClick={close} aria-label="카메라 화면 닫기">닫기 ×</button>}
    </header>
    <p className="bc-source">화면 위 수치는 교육용 모의 값이에요. 카메라는 실제 모형의 모습을 보여줍니다.</p>
    <div className="bc-controls">
      <label className="bc-device" htmlFor={select}><span>카메라</span><select id={select} value={camera.selectedDeviceId} onChange={event => camera.selectDevice(event.target.value)} disabled={camera.status === "requesting"}>
        <option value="">기본 카메라</option>
        {camera.devices.map((device, index) => <option key={device.deviceId || index} value={device.deviceId}>{device.label || `카메라 ${index + 1}`}{device.deviceId === camera.recommendedDeviceId ? " · 모형용 권장" : ""}</option>)}
      </select></label>
      <button type="button" className="bc-button" onClick={() => { void camera.refreshDevices(); }}>목록 새로고침</button>
      <button type="button" className="bc-button bc-primary" disabled={camera.status === "requesting" || Boolean(error && ["unsupported", "insecure-context", "iframe-blocked"].includes(error))} onClick={() => { void camera.start(); }}>{active ? "선택한 카메라 다시 연결" : "카메라 연결"}</button>
      {active && <button type="button" className="bc-button" onClick={() => camera.stop()}>영상 중지</button>}
    </div>
    {camera.recommendedDeviceId && camera.selectedDeviceId !== camera.recommendedDeviceId && <p className="bc-hint"><button className="bc-text-button" type="button" onClick={() => camera.selectDevice(camera.recommendedDeviceId!)}>APC850 권장 카메라 선택</button><span>선택 후 연결 버튼을 눌러주세요.</span></p>}
    {error && <p className="bc-error" role="alert">{errors[error]}{camera.inIframe && typeof window !== "undefined" && <a href={window.location.href} target="_blank" rel="noreferrer">별도 창으로 열기 ↗</a>}</p>}
    <div ref={frameRef} className={`bc-video-frame ${adjusting ? "is-adjusting" : ""}`} style={{ aspectRatio: String(ratio) }}>
      <video ref={camera.videoRef} autoPlay muted playsInline aria-label="실물 교육용 챔버 카메라" className={playing ? "is-playing" : ""} />
      {!playing && <div className="bc-placeholder"><span aria-hidden="true">◉</span><strong>{active ? "카메라 영상이 들어오면 표시됩니다" : "실물 카메라를 연결해주세요"}</strong><p>{camera.stoppedForBackground ? "다른 창으로 이동해 영상이 중지됐어요. 다시 연결할 수 있어요." : "웹캠 USB를 PC에 연결하고 위의 카메라 연결 버튼을 누르세요."}</p></div>}
      {playing && <>
        <span className="bc-video-badge"><i />카메라 실시간 · 수치는 교육용 모의</span>
        <svg className="bc-lines" viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true">
          {BOOTH_CAMERA_SIGNALS.map(signal => { const a = position(signal, "marker"), c = position(signal, "card"); return <line key={signal} x1={a.x * 1000} y1={a.y * 1000} x2={c.x * 1000} y2={c.y * 1000} className={alarms[signal] ? "is-alarm" : ""} />; })}
        </svg>
        {BOOTH_CAMERA_SIGNALS.flatMap(signal => (["marker", "card"] as const).map(part => {
          const point = position(signal, part), info = metadata[signal], box = boothOverlayBox(part, size.width, size.height);
          const selectedTarget = adjusting && selected.signal === signal && selected.part === part;
          return <button type="button" key={`${signal}-${part}`} className={`bc-overlay bc-${part} ${alarms[signal] ? "is-alarm" : ""} ${selectedTarget ? "is-selected" : ""}`} disabled={!adjusting}
            style={{ left: `${point.x * 100}%`, top: `${point.y * 100}%`, width: box.width, height: box.height } as CSSProperties}
            aria-label={`${info.number} ${info.label} ${part === "marker" ? "번호" : "수치 표시"} 위치 조절`}
            onFocus={() => setSelected({ signal, part })}
            onPointerDown={event => begin(event, { signal, part })} onPointerMove={during} onPointerUp={end} onPointerCancel={end}
            onKeyDown={event => keyboard(event, { signal, part })}>
            {part === "marker" ? <span className="bc-outline">{info.number}</span> : <><span className="bc-card-title">{info.number} · {info.label}</span><strong className="bc-value bc-outline">{formatValue(signal, values[signal])}<small>{info.unit}</small></strong></>}
          </button>;
        }))}
      </>}
    </div>
    <div className="bc-calibration">
      <button type="button" className={`bc-button ${adjusting ? "is-selected" : ""}`} aria-pressed={adjusting} disabled={!playing} onClick={() => setAdjusting(value => !value)}>{adjusting ? "위치 맞춤 완료" : "번호·수치 위치 맞추기"}</button>
      {adjusting && <><p>번호와 숫자 표시를 각각 끌어 빈 공간에 놓으세요. 방향키로도 움직일 수 있어요.</p><div className="bc-nudge"><span>{metadata[selected.signal].number} · {selected.part === "marker" ? "번호" : "수치"}</span>{[["←", -.01, 0], ["↑", 0, -.01], ["↓", 0, .01], ["→", .01, 0]].map(([label, dx, dy]) => <button type="button" className="bc-button" key={String(label)} aria-label={`선택 위치 ${label} 이동`} onClick={() => move(Number(dx), Number(dy))}>{label}</button>)}<button type="button" className="bc-button" onClick={() => setLayout(defaultBoothCameraLayout())}>기본 위치</button></div></>}
    </div>
    <p className="bc-footnote"><span className="bc-normal-sample">흰색</span> 정상 · <span className="bc-alarm-sample">빨간색</span> 이상 · 정상 범위로 돌아오면 흰색으로 바뀝니다.</p>
    <dl className="bc-sr-only">{BOOTH_CAMERA_SIGNALS.map(signal => <div key={signal}><dt>{metadata[signal].label}</dt><dd>{formatValue(signal, values[signal])} {metadata[signal].unit}, {alarms[signal] ? "이상" : "정상"}</dd></div>)}</dl>
  </section>;
}
