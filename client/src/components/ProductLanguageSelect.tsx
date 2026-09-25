import type { ProductLanguage } from "@/lib/productLanguage";
import { tr } from "@/lib/productLanguage";

export default function ProductLanguageSelect({ language, onChange }: { language: ProductLanguage; onChange: (language: ProductLanguage) => void }) {
  return <label className="sg-language-select">
    <span>{tr(language, "언어", "Language", "言語")}</span>
    <select aria-label={tr(language, "표시 언어", "Display language", "表示言語")} value={language} onChange={event => onChange(event.target.value as ProductLanguage)}>
      <option value="ko">한국어</option>
      <option value="en">English</option>
      <option value="ja">日本語</option>
    </select>
  </label>;
}
