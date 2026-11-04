import { useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from "react";
import { usePrototypeCamera, type PrototypeCameraError } from "../hooks/usePrototypeCamera";
import {
  BOOTH_CAMERA_SIGNALS, boothOverlayBox, cameraLayoutStorageKey,
  defaultBoothCameraLayout, fitBoothOverlayPoint, readBoothCameraLayout,
  type BoothCameraLayout, type BoothCameraSignal, type OverlayPart, type OverlayPoint,
} from "../../../shared/boothCameraLayout";
import { BOOTH_SIGNALS, BOOTH_RECOVERY_RANGES, BOOTH_ALARM_CLEAR_MS } from "../../../shared/boothExperience";
import "./booth-camera-overlay.css";

export type BoothSignal = BoothCameraSignal;
export type BoothCameraOverlayProps = {
  values: Record<BoothSignal, number>;
  alarms: Record<BoothSignal, boolean>;
  onClose?: () => void;
  compact?: boolean;
  valuesFrozen?: boolean;
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
export default function BoothCameraOverlay({ values, alarms, onClose, compact = false, valuesFrozen = false }: BoothCameraOverlayProps) {
  const camera = usePrototypeCamera({ moduleOnly: true });
  const heading = useId(), select = useId(), settingsId = useId();
  const frameRef = useRef<HTMLDivElement>(null);
  const deviceSelectRef = useRef<HTMLSelectElement>(null);
  const connectButtonRef = useRef<HTMLButtonElement>(null);
  const restoreConnectFocus = useRef(false);
  const drag = useRef<Drag | null>(null);
  const [size, setSize] = useState({ width: 640, height: 360 });
  const [layout, setLayout] = useState<BoothCameraLayout>(defaultBoothCameraLayout);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [adjusting, setAdjusting] = useState(false);
  const [selected, setSelected] = useState<Target>({ signal: "pressure", part: "marker" });
  const [moduleConfirmed, setModuleConfirmed] = useState(false);
  const [registrationNotice, setRegistrationNotice] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const playing = camera.status === "playing";
  const active = ["requesting", "connected", "ready", "playing"].includes(camera.status);
  const ratio = camera.width > 0 && camera.height > 0 ? camera.width / camera.height : 16 / 9;
  const selectedModule = camera.eligibleModuleDevices.find(device => device.deviceId === camera.selectedDeviceId);
  const registeredSelected = camera.selectedDeviceId === camera.registeredDeviceId;
  const blockedContext = !camera.supported || !camera.secureContext || camera.cameraPolicyAllowed === false;
  const canConnect = camera.canStart && registeredSelected && camera.status !== "requesting" && !blockedContext;
  const activeIdentity = camera.activeDeviceId || camera.registeredDeviceId || camera.selectedDeviceId;
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
  useEffect(() => {
    setModuleConfirmed(false);
    setRegistrationNotice("");
  }, [camera.selectedDeviceId]);
  useEffect(() => {
    if (compact && settingsOpen) deviceSelectRef.current?.focus();
  }, [compact, settingsOpen]);
  useEffect(() => {
    if (!compact || settingsOpen || !canConnect || !restoreConnectFocus.current) return;
    const frame = window.requestAnimationFrame(() => {
      restoreConnectFocus.current = false;
      connectButtonRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [compact, settingsOpen, canConnect]);

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
  function registerSelected() {
    if (!selectedModule || !moduleConfirmed) return;
    const registered = camera.registerModuleCamera(selectedModule.deviceId);
    setRegistrationNotice(registered ? `${selectedModule.label}을 모듈 카메라로 등록했어요. 아래 연결 버튼을 눌러주세요.` : "장치가 변경됐어요. USB 연결을 확인하고 목록을 새로고침해주세요.");
    if (registered) {
      restoreConnectFocus.current = compact;
      setModuleConfirmed(false);
      setSettingsOpen(false);
    }
  }
  function forgetModule() {
    camera.forgetModuleCamera();
    setModuleConfirmed(false);
    setSettingsOpen(true);
    setRegistrationNotice("모듈 카메라 등록을 해제했어요. 사용할 외부 웹캠을 다시 확인해주세요.");
  }
  function toggleSettings() {
    restoreConnectFocus.current = compact && settingsOpen && canConnect;
    setSettingsOpen(value => !value);
  }

  return <section className={`bc-camera${compact ? " bc-camera-compact" : ""}`} aria-labelledby={heading} data-camera-status={camera.status}>
    <header className="bc-heading">
      <div>{!compact && <p className="bc-eyebrow">MODEL CAMERA</p>}<h2 id={heading}>{compact ? "모듈 카메라" : "모형 내부 보기"}</h2></div>
      <span className={`bc-status ${playing ? "is-live" : ""}`}>{playing ? "모듈 카메라 실시간" : active ? "모듈 카메라 연결 중" : "모듈 카메라 미연결"}</span>
      {compact && <div className="bc-compact-actions">
        {active ? <button type="button" ref={connectButtonRef} className="bc-button" onClick={() => camera.stop()}>영상 중지</button> : <button type="button" ref={connectButtonRef} className="bc-button bc-primary" disabled={!canConnect} onClick={() => { void camera.start(); }}>모듈 카메라 연결</button>}
        <button type="button" className="bc-button" aria-expanded={settingsOpen} aria-controls={settingsId} onClick={toggleSettings}>{settingsOpen ? "설정 접기" : "카메라 설정"}</button>
      </div>}
      {onClose && <button type="button" className="bc-button bc-close" onClick={close} aria-label="카메라 화면 닫기">닫기 ×</button>}
    </header>
    {!compact && <p className="bc-source">등록한 모듈 웹캠만 연결해요. 화면 위 수치는 이 체험의 교육용 모의 값입니다.</p>}
    {(!compact || settingsOpen) && <div id={settingsId} className="bc-module-registration" data-registration-state={camera.moduleRegistrationState}>
      <div className="bc-registration-heading"><strong>{camera.moduleRegistrationState === "ready" ? "등록된 모듈 카메라" : "모듈 카메라 등록"}</strong>{!compact && <span>내장 카메라 자동 연결 차단</span>}</div>
      <div className="bc-controls">
        <label className="bc-device" htmlFor={select}><span>모듈에 장착한 외부 웹캠</span><select id={select} ref={deviceSelectRef} value={selectedModule ? camera.selectedDeviceId : ""} onChange={event => camera.selectDevice(event.target.value)} disabled={camera.status === "requesting"}>
          <option value="" disabled>모듈 웹캠을 선택하세요</option>
          {camera.eligibleModuleDevices.map(device => <option key={device.deviceId} value={device.deviceId}>{device.label}{device.deviceId === camera.recommendedDeviceId ? " · APC850 후보" : ""}</option>)}
        </select></label>
        <button type="button" className="bc-button" onClick={() => { void camera.refreshDevices(); }}>목록 새로고침</button>
      </div>
      {camera.moduleRegistrationState === "labels-hidden" ? <div className="bc-registration-help" role="status"><strong>브라우저가 카메라 이름을 숨기고 있어요.</strong><p>{compact ? "이 사이트의 카메라 권한을 허용한 뒤 목록을 새로고침해주세요. 장치를 확인하기 전에는 연결하지 않아요." : "브라우저의 이 사이트 카메라 권한을 허용하고, 모듈 웹캠을 선택한 뒤 목록을 새로고침해주세요. 이름과 장치를 확인할 수 있기 전에는 영상을 시작하지 않아요."}</p>{!compact && <p>이름 확인을 위해 노트북 카메라를 잠깐 켜는 동작도 하지 않습니다.</p>}</div>
        : !camera.eligibleModuleDevices.length ? <div className="bc-registration-help" role="status"><strong>등록할 수 있는 모듈 웹캠이 없어요.</strong><p>모듈 웹캠의 USB를 PC에 연결하고 목록을 새로고침해주세요. 내장·IR·가상 카메라는 연결 목록에서 제외됩니다.</p></div> : null}
      {camera.moduleRegistrationState === "missing" && camera.registeredDeviceLabel ? <p className="bc-error" role="status">등록한 {camera.registeredDeviceLabel}을 찾지 못했어요. 해당 웹캠을 다시 연결해주세요. 다른 카메라로 전환하지 않습니다.</p> : null}
      {selectedModule && (!registeredSelected || camera.moduleRegistrationState !== "ready") ? <div className="bc-register-confirm">
        <label><input type="checkbox" checked={moduleConfirmed} onChange={event => setModuleConfirmed(event.target.checked)} disabled={camera.status === "requesting"} /><span>이 장치는 모듈에 장착한 웹캠입니다.</span></label>
        <button type="button" className="bc-button" disabled={!moduleConfirmed || camera.status === "requesting" || blockedContext} onClick={registerSelected}>선택한 웹캠을 모듈 카메라로 등록</button>
      </div> : null}
      {camera.registeredDeviceLabel && <div className="bc-registered-device"><span><b>등록 장치</b> {camera.registeredDeviceLabel}</span><button type="button" className="bc-text-button" onClick={forgetModule}>등록 해제</button></div>}
      <p className="bc-registration-note">{compact ? "모듈에 장착한 웹캠을 직접 확인해 등록해주세요." : "처음 한 번 모듈에 장착한 웹캠을 직접 확인해 등록해주세요. 브라우저는 카메라의 설치 위치를 자동으로 판별할 수 없어요."}</p>
      {registrationNotice && <p className="bc-registration-notice" role="status">{registrationNotice}</p>}
    </div>}
    {!compact && <div className="bc-controls bc-stream-actions">
      <button type="button" className="bc-button bc-primary" disabled={!canConnect} onClick={() => { void camera.start(); }}>{active ? "등록한 모듈 카메라 다시 연결" : "모듈 카메라 연결"}</button>
      {active && <button type="button" className="bc-button" onClick={() => camera.stop()}>영상 중지</button>}
      {playing && <span className="bc-active-device">현재 영상 · {camera.activeDeviceLabel || camera.registeredDeviceLabel}</span>}
    </div>}
    {error && <p className="bc-error" role="alert">{errors[error]}{camera.inIframe && typeof window !== "undefined" && <a href={window.location.href} target="_blank" rel="noreferrer">별도 창으로 열기 ↗</a>}</p>}
    <div ref={frameRef} className={`bc-video-frame ${adjusting ? "is-adjusting" : ""}`} style={{ aspectRatio: String(ratio), "--bc-aspect": ratio } as CSSProperties}>
      <video ref={camera.videoRef} autoPlay muted playsInline aria-label="실물 교육용 챔버 카메라" className={playing ? "is-playing" : ""} />
      {!playing && <div className="bc-placeholder"><span aria-hidden="true">◉</span><strong>{active ? "등록한 모듈 카메라의 영상을 기다려요" : "모듈 카메라가 연결되지 않았어요"}</strong><p>{compact ? camera.stoppedForBackground ? "영상이 중지됐어요. 다시 연결해주세요." : camera.moduleRegistrationState === "ready" ? "위의 연결 버튼을 눌러주세요." : camera.moduleRegistrationState === "missing" ? "등록한 모듈 웹캠을 다시 연결해주세요." : "모듈 웹캠을 PC에 USB로 연결한 뒤 등록하세요." : camera.stoppedForBackground ? "다른 창으로 이동해 영상이 중지됐어요. 등록한 모듈 카메라에 다시 연결해주세요." : camera.moduleRegistrationState === "ready" ? "위의 모듈 카메라 연결 버튼을 눌러주세요." : "모듈 웹캠을 PC에 USB로 연결한 뒤 등록하세요. 노트북 내장 카메라는 사용하지 않습니다."}</p>{compact && !active && camera.moduleRegistrationState !== "ready" && <button type="button" className="bc-button" onClick={() => setSettingsOpen(true)}>모듈 카메라 등록</button>}</div>}
      {playing && <>
        <span className="bc-video-badge"><i />{valuesFrozen ? "카메라 실시간 · 수치는 종료 시점 기록" : "카메라 실시간 · 수치는 교육용 모의"}</span>
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
    {(!compact || playing) && <div className="bc-calibration">
      <button type="button" className={`bc-button ${adjusting ? "is-selected" : ""}`} aria-pressed={adjusting} disabled={!playing} onClick={() => setAdjusting(value => !value)}>{adjusting ? "위치 맞춤 완료" : "번호·수치 위치 맞추기"}</button>
      {adjusting && <><p>번호와 숫자 표시를 각각 끌어 빈 공간에 놓으세요. 방향키로도 움직일 수 있어요.</p><div className="bc-nudge"><span>{metadata[selected.signal].number} · {selected.part === "marker" ? "번호" : "수치"}</span>{[["←", -.01, 0], ["↑", 0, -.01], ["↓", 0, .01], ["→", .01, 0]].map(([label, dx, dy]) => <button type="button" className="bc-button" key={String(label)} aria-label={`선택 위치 ${label} 이동`} onClick={() => move(Number(dx), Number(dy))}>{label}</button>)}<button type="button" className="bc-button" onClick={() => setLayout(defaultBoothCameraLayout())}>기본 위치</button></div></>}
    </div>}
    {!compact && <section className="bc-normal-guide" aria-label="카메라 수치의 모의 정상 기준">
      <h3>목표값과 정상 범위</h3><p>모의값을 목표 부근으로 맞추세요. 같은 기준으로 카메라 표시와 복구 미션을 판정해요.</p>
      <div className="bc-normal-grid">{BOOTH_SIGNALS.map(signal => <div key={signal.key} data-alarm={String(alarms[signal.key])}><strong>{signal.number} · {signal.label}</strong><span>목표 {signal.target} {signal.unit}</span><small>정상 {signal.normal[0]}–{signal.normal[1]} {signal.unit}</small><b>{alarms[signal.key] ? "복구 필요" : "정상"}</b></div>)}</div>
      <details><summary>빨간 표시가 바로 흰색으로 바뀌지 않을 때</summary><p>경계에서 색이 계속 바뀌지 않도록, 경보가 발생한 항목은 아래 복구 범위에서 {(BOOTH_ALARM_CLEAR_MS / 1000).toFixed(1)}초 유지하면 흰색으로 돌아와요.</p><ul>{BOOTH_SIGNALS.map(signal => <li key={signal.key}>{signal.number} · {signal.label}: {BOOTH_RECOVERY_RANGES[signal.key][0]}–{BOOTH_RECOVERY_RANGES[signal.key][1]} {signal.unit}</li>)}</ul></details>
    </section>}
    {!compact && <p className="bc-footnote"><span className="bc-normal-sample">흰색</span> 정상 · <span className="bc-alarm-sample">빨간색</span> 복구 필요 · 표시 범위와 목표는 이번 교육용 체험의 기준이에요.</p>}
    <dl className="bc-sr-only">{BOOTH_CAMERA_SIGNALS.map(signal => <div key={signal}><dt>{metadata[signal].label}</dt><dd>{formatValue(signal, values[signal])} {metadata[signal].unit}, {alarms[signal] ? "이상" : "정상"}</dd></div>)}</dl>
  </section>;
}
