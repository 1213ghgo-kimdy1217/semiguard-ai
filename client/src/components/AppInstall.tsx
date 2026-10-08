import { useEffect, useRef, useState } from "react";
import type { ProductLanguage } from "../lib/productLanguage";
import { tr } from "../lib/productLanguage";
import "./app-install.css";

type InstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export default function AppInstall({ language }: { language: ProductLanguage }) {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [installed, setInstalled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const inFlight = useRef(false);
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    const standalone = window.matchMedia("(display-mode: standalone)");
    const sync = () => setInstalled(standalone.matches || (navigator as Navigator & { standalone?: boolean }).standalone === true);
    const ready = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallPrompt);
      setFailed(false);
    };
    const complete = () => { setInstalled(true); setPrompt(null); };
    sync();
    standalone.addEventListener("change", sync);
    window.addEventListener("beforeinstallprompt", ready);
    window.addEventListener("appinstalled", complete);
    return () => {
      mounted.current = false;
      standalone.removeEventListener("change", sync);
      window.removeEventListener("beforeinstallprompt", ready);
      window.removeEventListener("appinstalled", complete);
    };
  }, []);

  async function install() {
    if (!prompt || inFlight.current) return;
    const request = prompt;
    inFlight.current = true;
    setBusy(true);
    setFailed(false);
    try {
      await request.prompt();
      await request.userChoice;
      // Acceptance of the prompt is not proof of installation; appinstalled is.
    } catch {
      if (mounted.current) setFailed(true);
    } finally {
      inFlight.current = false;
      if (mounted.current) { setPrompt(null); setBusy(false); }
    }
  }

  if (installed) return null;
  return <section className="sg-app-install" aria-labelledby="sg-app-title">
    <div className="sg-app-heading">
      <div><p className="sg-app-kicker">SEMIGUARD / ON YOUR DEVICE</p>
        <h2 id="sg-app-title">{tr(language, "휴대폰·태블릿에서도, 홈 화면에서 시작하세요.", "Start from your phone or tablet's home screen.", "スマートフォン・タブレットのホーム画面から。")}</h2>
      </div>
      {prompt && <button type="button" onClick={install} disabled={busy} className="sg-app-button">
        {busy ? tr(language, "설치 창 확인 중…", "Waiting for the install dialog…", "インストール画面を確認中…") : tr(language, "앱 설치", "Install app", "アプリをインストール")}
      </button>}
    </div>
    <p>{tr(language, "별도 앱스토어 다운로드 없이 사용하는 설치형 웹앱입니다. 로그인·훈련·기록 저장·AI 코칭에는 인터넷 연결이 필요합니다.", "An installable web app, without an app-store download. Sign-in, practice, saved records, and AI coaching require an internet connection.", "ストアからのダウンロードなしで使えるインストール型Webアプリです。ログイン・訓練・記録保存・AIコーチングにはインターネット接続が必要です。")}</p>
    {failed && <p role="status">{tr(language, "설치 창을 열지 못했습니다. 아래 브라우저별 안내를 이용하세요.", "The install dialog could not open. Use the browser instructions below.", "インストール画面を開けませんでした。以下のブラウザ別案内をご利用ください。")}</p>}
    <details>
      <summary>{tr(language, "내 기기에 설치하는 방법", "How to install on your device", "端末への追加方法")}</summary>
      <ul>
        <li><strong>Android · Chrome</strong><span>{tr(language, "브라우저 메뉴(⋮) → ‘홈 화면에 추가’ 또는 ‘앱 설치’. 설치 버튼이 아직 보이지 않아도 메뉴에서 확인할 수 있어요.", "Browser menu (⋮) → Add to Home screen or Install app. Check the menu even if the install button is not shown yet.", "ブラウザのメニュー(⋮) →「ホーム画面に追加」または「アプリをインストール」。ボタンが表示されない場合もメニューをご確認ください。")}</span></li>
        <li><strong>iPhone · iPad · Safari</strong><span>{tr(language, "Safari에서 열기 → 공유 → ‘홈 화면에 추가’ → 추가. ‘웹 앱으로 열기’ 옵션이 보이면 켜주세요.", "Open in Safari → Share → Add to Home Screen → Add. Turn on Open as Web App if that option appears.", "Safariで開く → 共有 →「ホーム画面に追加」→ 追加。「Webアプリとして開く」が表示されたら有効にしてください。")}</span></li>
        <li><strong>PC · Edge / Chrome</strong><span>{tr(language, "주소창의 설치 아이콘 또는 브라우저 메뉴의 앱 설치 항목을 사용하세요. 기기·브라우저에 따라 메뉴 이름이 다를 수 있습니다.", "Use the address bar's install icon or the browser's app-install menu. Labels may differ by device and browser.", "アドレスバーのインストールアイコンまたはブラウザのアプリ追加メニューを利用します。端末・ブラウザにより名称が異なる場合があります。")}</span></li>
      </ul>
    </details>
  </section>;
}
