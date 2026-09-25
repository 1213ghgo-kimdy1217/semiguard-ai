import { useEffect, useState } from "react";

export type ProductLanguage = "ko" | "en" | "ja";

const STORAGE_KEY = "semiguard_lang";

export function readProductLanguage(): ProductLanguage {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    return saved === "en" || saved === "ja" ? saved : "ko";
  } catch {
    return "ko";
  }
}

export function tr(language: ProductLanguage, korean: string, english: string, japanese: string) {
  return language === "en" ? english : language === "ja" ? japanese : korean;
}

export function useProductLanguage() {
  const [language, setLanguage] = useState<ProductLanguage>(readProductLanguage);

  useEffect(() => {
    document.documentElement.lang = language === "ko" ? "ko-KR" : language === "ja" ? "ja-JP" : "en-US";
    try { window.localStorage.setItem(STORAGE_KEY, language); } catch { /* Session-only preference when storage is unavailable. */ }
  }, [language]);

  return [language, setLanguage] as const;
}
