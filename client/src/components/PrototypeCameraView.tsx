import { useId } from "react";
import {
  Camera,
  ExternalLink,
  RefreshCw,
  Square,
  Video,
  X,
} from "lucide-react";
import {
  usePrototypeCamera,
  type PrototypeCameraError,
  type PrototypeCameraStatus,
} from "../hooks/usePrototypeCamera";
import { tr, type ProductLanguage } from "../lib/productLanguage";
import "./prototype-camera.css";

export default function PrototypeCameraView({
  language,
  onClose,
}: {
  language: ProductLanguage;
  onClose?: () => void;
}) {
  const camera = usePrototypeCamera();
  const selectId = useId();
  const headingId = useId();
  const l = (ko: string, en: string, ja: string) => tr(language, ko, en, ja);
  const labels: Record<PrototypeCameraStatus, string> = {
    idle: l("카메라 꺼짐", "Camera is off", "カメラ停止中"),
    requesting: l(
      "카메라 허용·연결 대기",
      "Waiting for camera permission or connection",
      "カメラ許可・接続待ち"
    ),
    connected: l(
      "장치 연결됨 · 영상 수신 대기",
      "Device connected · waiting for video",
      "機器接続済み・映像待ち"
    ),
    ready: l(
      "영상 정보 확인 · 재생 대기",
      "Video information received · waiting for playback",
      "映像情報受信済み・再生待ち"
    ),
    playing: l(
      "카메라 영상 재생 중",
      "Camera video is playing",
      "カメラ映像再生中"
    ),
    stopped: l("카메라 정지됨", "Camera stopped", "カメラ停止済み"),
    error: l(
      "카메라 연결 확인 필요",
      "Check the camera connection",
      "カメラ接続を確認してください"
    ),
  };
  const errors: Record<PrototypeCameraError, string> = {
    unsupported: l(
      "이 브라우저는 카메라 연결을 지원하지 않습니다. 컴퓨터의 Chrome 또는 Edge에서 열어주세요.",
      "This browser cannot access a camera. Open this page in desktop Chrome or Edge.",
      "このブラウザーではカメラに接続できません。PCのChromeまたはEdgeで開いてください。"
    ),
    "insecure-context": l(
      "카메라 연결에는 HTTPS 페이지가 필요합니다. 보안 연결 주소에서 다시 열어주세요.",
      "Camera access requires HTTPS. Reopen the page using its secure address.",
      "カメラ接続にはHTTPSが必要です。安全な接続のURLで開き直してください。"
    ),
    "iframe-blocked": l(
      "현재 창의 권한 정책이 카메라 사용을 차단했습니다. 내장 창이라면 새 창에서 열고 카메라 권한을 확인해주세요.",
      "This page's permission policy blocks the camera. If embedded, open a new window and check camera permission.",
      "この画面の権限ポリシーがカメラをブロックしています。埋め込み画面の場合は新しいウィンドウで開き、カメラ許可を確認してください。"
    ),
    "permission-denied": l(
      "카메라 권한이 허용되지 않았습니다. 주소창의 사이트 설정에서 카메라를 허용한 뒤 다시 시도해주세요.",
      "Camera permission was not granted. Allow the camera in the address bar's site settings, then retry.",
      "カメラが許可されていません。アドレスバーのサイト設定で許可し、再試行してください。"
    ),
    "no-device": l(
      "사용 가능한 카메라를 찾지 못했습니다. 웹캠의 USB 연결을 확인하고 장치 목록을 새로고침해주세요.",
      "No camera was found. Check the webcam's USB cable and refresh the device list.",
      "カメラが見つかりません。WebカメラのUSB接続を確認し、機器一覧を更新してください。"
    ),
    "device-busy": l(
      "카메라를 시작하지 못했습니다. 화상회의·카메라 앱을 닫고 USB 연결을 확인한 뒤 다시 시도해주세요.",
      "The camera could not start. Close meeting or camera apps, check USB, and retry.",
      "カメラを開始できません。会議・カメラアプリを閉じ、USBを確認して再試行してください。"
    ),
    constraints: l(
      "선택한 카메라를 연결하지 못했습니다. 장치 목록을 새로고침하고 사용할 카메라를 다시 선택해주세요.",
      "The selected camera is unavailable. Refresh the list and choose a camera again.",
      "選択したカメラを使用できません。機器一覧を更新し、カメラを選び直してください。"
    ),
    "device-ended": l(
      "카메라 영상이 종료되었습니다. 케이블과 카메라 권한을 확인하고 다시 연결해주세요.",
      "The camera stream ended. Check the cable and camera permission, then reconnect.",
      "カメラ映像が終了しました。ケーブルとカメラ許可を確認し、再接続してください。"
    ),
    "device-lost": l(
      "연결된 카메라가 장치 목록에서 사라졌습니다. USB를 다시 연결하고 사용할 카메라를 선택해주세요.",
      "The connected camera disappeared from the device list. Reconnect USB and select a camera.",
      "接続中のカメラが機器一覧から消えました。USBを接続し直し、カメラを選んでください。"
    ),
    "playback-blocked": l(
      "브라우저가 영상 재생을 막았습니다. 카메라 권한을 확인하고 다시 시도 버튼을 눌러주세요.",
      "The browser blocked video playback. Check camera permission and click Retry.",
      "ブラウザーが映像再生をブロックしました。カメラ許可を確認し、再試行を押してください。"
    ),
    "stream-unavailable": l(
      "카메라는 연결되었지만 영상을 재생하지 못했습니다. 다른 카메라를 선택하거나 다시 연결해주세요.",
      "The camera connected but video could not play. Select another camera or reconnect.",
      "カメラは接続されましたが映像を再生できません。別のカメラを選ぶか再接続してください。"
    ),
    unknown: l(
      "카메라를 연결하지 못했습니다. USB 연결과 브라우저의 카메라 설정을 확인해주세요.",
      "The camera could not connect. Check USB and your browser's camera settings.",
      "カメラに接続できません。USB接続とブラウザーのカメラ設定を確認してください。"
    ),
  };
  const availabilityError = !camera.secureContext
    ? "insecure-context"
    : !camera.supported
      ? "unsupported"
      : camera.cameraPolicyAllowed === false
        ? "iframe-blocked"
        : null;
  const error = camera.error ?? availabilityError;
  const active =
    camera.status === "requesting" ||
    camera.status === "connected" ||
    camera.status === "ready" ||
    camera.status === "playing";
  const playing = camera.status === "playing";
  const newWindowUrl =
    typeof window === "undefined" ? null : window.location.href;

  return (
    <section
      className="pc-camera"
      aria-labelledby={headingId}
      data-camera-status={camera.status}
    >
      <div className="pc-camera-heading">
        <div>
          <span className="pc-camera-eyebrow">LOCAL CAMERA / VIDEO ONLY</span>
          <h3 id={headingId}>
            {l("실물 모형 카메라", "Physical model camera", "実物模型カメラ")}
          </h3>
        </div>
        {onClose ? (
          <button
            type="button"
            className="pc-camera-close"
            aria-label={l(
              "카메라 보기 닫기",
              "Close camera view",
              "カメラ表示を閉じる"
            )}
            onClick={() => {
              camera.stop();
              onClose();
            }}
          >
            <X size={17} aria-hidden="true" />
          </button>
        ) : null}
      </div>
      <p className="pc-camera-source">
        {l(
          "제어보드 USB와 웹캠 USB는 별도 연결입니다. 카메라 영상은 공정 계측값을 검증하지 않습니다.",
          "The control board and webcam use separate USB connections. Camera video does not verify process measurements.",
          "制御ボードとWebカメラは別々のUSB接続です。映像は工程計測値を検証するものではありません。"
        )}
      </p>
      <div className="pc-camera-controls">
        <label htmlFor={selectId}>
          {l("카메라 선택", "Choose camera", "カメラを選択")}
        </label>
        <div className="pc-camera-device-row">
          <select
            id={selectId}
            aria-label={l("카메라 선택", "Choose camera", "カメラを選択")}
            value={camera.selectedDeviceId}
            onChange={event => camera.selectDevice(event.target.value)}
          >
            <option value="">
              {l(
                "브라우저 기본 카메라",
                "Browser default camera",
                "ブラウザー既定のカメラ"
              )}
            </option>
            {camera.devices.map((device, index) => (
              <option key={device.deviceId || index} value={device.deviceId}>
                {device.label ||
                  l(
                    `카메라 ${index + 1} · 허용 후 이름 표시`,
                    `Camera ${index + 1} · name available after permission`,
                    `カメラ${index + 1}・許可後に名前を表示`
                  )}
                {device.deviceId === camera.recommendedDeviceId
                  ? l(
                      " · ABKO/APC850 후보",
                      " · ABKO/APC850 candidate",
                      "・ABKO/APC850候補"
                    )
                  : ""}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="pc-camera-button pc-camera-secondary"
            data-camera-action="refresh"
            onClick={() => {
              void camera.refreshDevices();
            }}
            disabled={!camera.secureContext || !camera.supported}
          >
            <RefreshCw size={15} aria-hidden="true" />
            {l("장치 새로고침", "Refresh devices", "機器を更新")}
          </button>
        </div>
        {camera.recommendedDeviceId &&
        camera.selectedDeviceId !== camera.recommendedDeviceId ? (
          <button
            type="button"
            className="pc-camera-candidate"
            onClick={() => camera.selectDevice(camera.recommendedDeviceId!)}
          >
            {l(
              "ABKO/APC850 후보 선택",
              "Select ABKO/APC850 candidate",
              "ABKO/APC850候補を選択"
            )}
          </button>
        ) : null}
        <p className="pc-camera-selection-note">
          {l(
            "장치를 선택한 뒤 연결 버튼으로 확정해주세요. 이름은 카메라 허용 후 표시될 수 있습니다.",
            "Confirm your selection with the connect button. Device names may appear after permission.",
            "機器を選び、接続ボタンで確定してください。機器名はカメラ許可後に表示される場合があります。"
          )}
        </p>
        <div className="pc-camera-actions">
          <button
            type="button"
            className="pc-camera-button pc-camera-primary"
            data-camera-action={camera.status === "error" ? "retry" : "start"}
            onClick={() => {
              void camera.start();
            }}
            disabled={
              Boolean(availabilityError) || camera.status === "requesting"
            }
            aria-busy={camera.status === "requesting" || undefined}
          >
            <Video size={16} aria-hidden="true" />
            {camera.status === "error"
              ? l("다시 시도", "Retry", "再試行")
              : active
                ? l(
                    "선택한 카메라로 연결",
                    "Connect selected camera",
                    "選択したカメラに接続"
                  )
                : l("카메라 켜기", "Turn on camera", "カメラを開始")}
          </button>
          <button
            type="button"
            className="pc-camera-button pc-camera-secondary"
            data-camera-action="stop"
            onClick={() => camera.stop()}
            disabled={!active}
          >
            <Square size={14} aria-hidden="true" />
            {l("카메라 정지", "Stop camera", "カメラを停止")}
          </button>
        </div>
      </div>
      <div className="pc-camera-status" role="status" aria-live="polite">
        <span
          className={`pc-camera-status-dot ${playing ? "is-playing" : ""}`}
          aria-hidden="true"
        />
        <strong>{labels[camera.status]}</strong>
        {camera.width > 0 && camera.height > 0 ? (
          <span className="pc-camera-metadata">
            {camera.width} × {camera.height}
          </span>
        ) : null}
      </div>
      {error ? (
        <p className="pc-camera-error" role="alert">
          {errors[error]}
        </p>
      ) : null}
      <div className="pc-camera-screen">
        <video
          ref={camera.videoRef}
          className={`pc-camera-video ${playing ? "is-playing" : ""}`}
          autoPlay
          muted
          playsInline
          aria-label={l(
            "프로토타입 실시간 카메라 영상",
            "Live prototype camera video",
            "実物模型のライブカメラ映像"
          )}
          data-camera-video
        />
        {!playing ? (
          <div className="pc-camera-placeholder">
            <Camera size={30} aria-hidden="true" />
            <strong>{labels[camera.status]}</strong>
            <p>
              {camera.status === "requesting"
                ? l(
                    "브라우저의 카메라 허용 창을 확인해주세요. 정지 버튼으로 대기를 취소할 수 있습니다.",
                    "Check the browser's permission prompt. Stop cancels this page's pending request.",
                    "ブラウザーのカメラ許可を確認してください。停止ボタンで待機を取り消せます。"
                  )
                : camera.status === "connected" || camera.status === "ready"
                  ? l(
                      "영상이 실제로 재생되면 여기에 표시됩니다.",
                      "The image appears here when video is actually playing.",
                      "映像が実際に再生されると、ここに表示されます。"
                    )
                  : l(
                      "카메라 켜기를 눌러 사용할 장치의 접근을 허용해주세요.",
                      "Click Turn on camera to allow access to your selected device.",
                      "カメラを開始を押し、選択した機器へのアクセスを許可してください。"
                    )}
            </p>
          </div>
        ) : null}
      </div>
      {camera.activeDeviceLabel ? (
        <p className="pc-camera-device-label">
          {l("연결된 장치", "Connected device", "接続機器")} ·{" "}
          {camera.activeDeviceLabel}
        </p>
      ) : null}
      {camera.stoppedForBackground ? (
        <p className="pc-camera-hint">
          {l(
            "화면을 떠나 카메라를 정지했습니다. 다시 보려면 카메라 켜기를 눌러주세요.",
            "The camera stopped when this page became hidden. Click Turn on camera to resume.",
            "画面を離れたためカメラを停止しました。再開するにはカメラを開始を押してください。"
          )}
        </p>
      ) : null}
      {camera.inIframe ? (
        <p className="pc-camera-hint">
          {l(
            "내장 창에서는 카메라 권한이 차단될 수 있습니다.",
            "Embedded windows may block camera permission.",
            "埋め込み画面ではカメラ許可がブロックされる場合があります。"
          )}{" "}
          {newWindowUrl ? (
            <a href={newWindowUrl} target="_blank" rel="noopener noreferrer">
              {l(
                "새 창에서 열기",
                "Open in new window",
                "新しいウィンドウで開く"
              )}
              <ExternalLink size={12} aria-hidden="true" />
            </a>
          ) : null}
        </p>
      ) : null}
      <p className="pc-camera-privacy">
        {l(
          "영상은 이 브라우저에서만 표시합니다. 녹화·마이크·서버 전송은 사용하지 않습니다.",
          "Video stays in this browser. No recording, microphone or server upload is used.",
          "映像はこのブラウザー内だけに表示します。録画・マイク・サーバー送信は使用しません。"
        )}
      </p>
    </section>
  );
}
