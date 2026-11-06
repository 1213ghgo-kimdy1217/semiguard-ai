import { useEffect, useRef, type MouseEvent } from "react";
import { Link, useLocation } from "wouter";
import { Activity, BookOpen, Cpu, Home, UserRound } from "lucide-react";
import ProductLanguageSelect from "./ProductLanguageSelect";
import { AccountLogoutView, useAccountSession } from "./AccountSession";
import { tr, useProductLanguage, type ProductLanguage } from "../lib/productLanguage";
import { activeNavigation, navigationLabel, PRIMARY_NAVIGATION, useSiteNavigation } from "../lib/siteNavigation";
import "./site-header.css";

const icons = { home: Home, learn: BookOpen, practice: Activity, model: Cpu };
type HeaderProps = {
  path: string; language: ProductLanguage; signedIn: boolean; pending: boolean; failed: boolean;
  onLanguageChange: (language: ProductLanguage) => void; onLogout: () => void;
  onLinkClick?: (event: MouseEvent<HTMLElement>) => void;
  fullNavigation?: boolean;
};

/** Page-independent destinations and ordering; only the selected location changes. */
export function SiteHeaderView({ path, language, signedIn, pending, failed, onLanguageChange, onLogout, onLinkClick, fullNavigation = false }: HeaderProps) {
  const l = (ko: string, en: string, ja: string) => tr(language, ko, en, ja);
  const active = activeNavigation(path);
  const NavigationLink = fullNavigation ? "a" : Link;
  return <header id="site-header" className="sg-site-header" onClickCapture={onLinkClick}>
    <a className="sg-site-skip" href="#site-content">{l("본문으로 건너뛰기", "Skip to content", "本文へ移動")}</a>
    <div className="sg-site-header-inner">
      <NavigationLink href="/welcome" className="sg-site-logo" aria-label={l("SemiGuard AI 홈", "SemiGuard AI home", "SemiGuard AI ホーム")}>
        <span className="sg-site-symbol" aria-hidden="true">SG</span><span>SemiGuard <span className="sg-site-ai">AI</span></span>
      </NavigationLink>
      <nav className="sg-site-primary" aria-label={l("주 메뉴", "Main navigation", "メインメニュー")}>
        {PRIMARY_NAVIGATION.map(item => { const Icon = icons[item.id]; return <NavigationLink key={item.id} href={item.href} aria-current={active === item.id ? "page" : undefined}>
          <Icon size={17} aria-hidden="true" /><span>{navigationLabel(item.label, language)}</span>
        </NavigationLink>; })}
      </nav>
      <div className="sg-site-actions">
        <ProductLanguageSelect language={language} onChange={onLanguageChange} />
        {signedIn ? <details className="sg-site-account">
          <summary><UserRound size={17} aria-hidden="true" /><span>{l("내 계정", "Account", "アカウント")}</span></summary>
          <div className="sg-site-account-panel"><AccountLogoutView language={language} signedIn pending={pending} failed={failed} onLogout={onLogout} /></div>
        </details> : <NavigationLink className="sg-site-signin" href="/login">{l("로그인", "Sign in", "ログイン")}</NavigationLink>}
      </div>
    </div>
  </header>;
}

export default function SiteHeader({ fullNavigation = false }: { fullNavigation?: boolean }) {
  const [path, setLocation] = useLocation();
  const [language, setLanguage] = useProductLanguage();
  const session = useAccountSession();
  const navigation = useSiteNavigation();
  const previousPath = useRef(path);
  useEffect(() => {
    const header = document.getElementById("site-header");
    if (!header) return;
    const measure = () => document.documentElement.style.setProperty("--sg-site-header-height", `${Math.ceil(header.getBoundingClientRect().height)}px`);
    measure();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    observer?.observe(header);
    window.addEventListener("resize", measure);
    return () => { observer?.disconnect(); window.removeEventListener("resize", measure); };
  }, []);
  useEffect(() => {
    if (previousPath.current !== path) {
      document.querySelector<HTMLDetailsElement>("#site-header .sg-site-account")?.removeAttribute("open");
      previousPath.current = path;
    }
  }, [path]);
  const onLinkClick = (event: MouseEvent<HTMLElement>) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || !(event.target instanceof Element)) return;
    const anchor = event.target.closest<HTMLAnchorElement>("a[href]");
    if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
    const destination = new URL(anchor.href, window.location.href);
    if (destination.origin !== window.location.origin || destination.hash) return;
    if (session?.pending || navigation?.canLeave() === false) { event.preventDefault(); event.stopPropagation(); return; }
    if (destination.pathname === window.location.pathname && navigation?.runCurrentPageAction(destination.pathname)) { event.preventDefault(); event.stopPropagation(); return; }
    // The existing account control is a native anchor. Use the app router here
    // so a page's confirmed leave guard is not followed by a second unload prompt.
    if (!fullNavigation && destination.pathname === "/account") { event.preventDefault(); event.stopPropagation(); setLocation("/account"); }
  };
  return <SiteHeaderView path={path} language={language} signedIn={session?.signedIn ?? false} pending={session?.pending ?? false} failed={session?.failed ?? false}
    fullNavigation={fullNavigation} onLanguageChange={setLanguage} onLinkClick={onLinkClick} onLogout={() => { if (navigation?.canLeave() !== false) void session?.logout(); }} />;
}
