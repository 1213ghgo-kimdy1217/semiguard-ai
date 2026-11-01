import { createElement } from "react";
import { tr, type ProductLanguage } from "./productLanguage";

// This public build flag changes navigation and disclosure only; it grants no access.
export const isRecoveryQaBuild = (value: unknown) => value === "1";
export const RECOVERY_QA_BUILD = isRecoveryQaBuild(import.meta.env.VITE_RECOVERY_QA);
export const recoveryQaLoginTarget = (enabled: boolean): "/account" | "/training" => enabled ? "/account" : "/training";
export const recoveryQaAccountLabel = (language: ProductLanguage) => tr(language, "계정 관리로 이동", "Open account settings", "アカウント管理へ");

export function RecoveryQaBanner({ enabled, language }: { enabled: boolean; language: ProductLanguage }) {
  if (!enabled) return null;
  const title = tr(language, "계정 복구 QA 미리보기", "Account recovery QA preview", "アカウント復旧QAプレビュー");
  const description = tr(language,
    "가상 테스트 계정만 사용하세요. 이 미리보기에는 기존 회원이나 학습 기록이 없습니다.",
    "Use synthetic test accounts only. This preview contains no existing members or learning records.",
    "架空のテストアカウントのみご利用ください。このプレビューには既存の会員・学習記録はありません。");
  return createElement("aside", {
    role: "note", "aria-label": title,
    className: "border-b border-amber-300/50 bg-amber-100 px-4 py-3 text-sm leading-6 text-slate-950",
  }, createElement("div", { className: "mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-1" },
    createElement("strong", null, title),
    createElement("span", { className: "min-w-0 flex-1 basis-80" }, description),
    createElement("a", {
      href: "/account",
      className: "inline-flex min-h-11 items-center rounded px-2 font-bold underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950",
    }, recoveryQaAccountLabel(language))));
}
