import { Link } from "wouter";
import type { ProcessId } from "../../../shared/processScenarios";
import { tr, type ProductLanguage } from "../lib/productLanguage";
import "./judgment-review-links.css";
export default function JudgmentReviewLinks({
  language,
  processId,
}: {
  language: ProductLanguage;
  processId?: ProcessId;
}) {
  const l = (ko: string, en: string, ja: string) => tr(language, ko, en, ja);
  return (
    <nav
      className="jd-review-links"
      aria-label={l(
        "판단 연습과 복기",
        "Judgment practice and review",
        "判断練習と振り返り"
      )}
    >
      <Link href="/training">
        {l("판단 연습 선택", "Choose judgment practice", "判断練習の選択")}
      </Link>
      <Link
        href={`/training/history${processId ? `?process=${processId}` : ""}`}
      >
        {l(
          "내 학습 기록·복기 →",
          "My saved practice and review →",
          "自分の練習記録・振り返り →"
        )}
      </Link>
    </nav>
  );
}
