import { createContext, useContext, useEffect, useMemo, useRef, type ReactNode } from "react";
import type { ProductLanguage } from "./productLanguage";

export const PRIMARY_NAVIGATION = [
  { id: "home", href: "/welcome", label: ["홈", "Home", "ホーム"] },
  { id: "learn", href: "/learn", label: ["8대 공정 학습", "Process learning", "8大工程の学習"] },
  { id: "practice", href: "/training", label: ["판단 연습", "Judgment practice", "判断練習"] },
  { id: "model", href: "/live", label: ["장비 모형 실습", "Equipment lab", "装置模型の実習"] },
] as const;
export type NavigationId = typeof PRIMARY_NAVIGATION[number]["id"];
export const navigationLabel = (label: readonly [string, string, string], language: ProductLanguage) => label[language === "en" ? 1 : language === "ja" ? 2 : 0];

export function activeNavigation(path: string): NavigationId | null {
  const pathname = path.split(/[?#]/, 1)[0];
  if (pathname === "/" || pathname === "/welcome") return "home";
  if (pathname === "/learn" || pathname.startsWith("/learn/")) return "learn";
  if (pathname === "/live" || pathname.startsWith("/live/") || pathname === "/model-preview.html") return "model";
  if (pathname === "/training" || pathname.startsWith("/training/") || pathname === "/preview" || pathname === "/demo" || pathname === "/dashboard" || pathname.startsWith("/dashboard/")) return "practice";
  return null;
}

export function getSiteHeaderHeight() {
  return typeof document === "undefined" ? 80 : document.getElementById("site-header")?.getBoundingClientRect().height ?? 80;
}

export function createSiteNavigationRegistry() {
  const guards = new Set<() => boolean>();
  const actions = new Map<string, () => void>();
  return {
    registerGuard(guard: () => boolean) { guards.add(guard); return () => { guards.delete(guard); }; },
    registerAction(path: string, action: () => void) { actions.set(path, action); return () => { if (actions.get(path) === action) actions.delete(path); }; },
    canLeave() { for (const guard of Array.from(guards)) if (!guard()) return false; return true; },
    runCurrentPageAction(path: string) { const action = actions.get(path); if (!action) return false; action(); return true; },
  };
}
const SiteNavigationContext = createContext<ReturnType<typeof createSiteNavigationRegistry> | null>(null);
export function SiteNavigationProvider({ children }: { children: ReactNode }) {
  const registry = useMemo(createSiteNavigationRegistry, []);
  return <SiteNavigationContext.Provider value={registry}>{children}</SiteNavigationContext.Provider>;
}
export const useSiteNavigation = () => useContext(SiteNavigationContext);

export function useSiteNavigationGuard(guard: () => boolean) {
  const registry = useSiteNavigation();
  const latest = useRef(guard); latest.current = guard;
  useEffect(() => registry?.registerGuard(() => latest.current()), [registry]);
}

export function useSiteNavigationAction(path: string, action: () => void) {
  const registry = useSiteNavigation();
  const latest = useRef(action); latest.current = action;
  useEffect(() => registry?.registerAction(path, () => latest.current()), [registry, path]);
}
