import { useEffect } from "react";
import { Link } from "wouter";
import { processEquipment } from "../../../shared/processEquipment";
import type { ProcessId } from "../../../shared/processScenarios";
import ProcessHandsOnLab from "../components/ProcessHandsOnLab";
import { tr, useProductLanguage } from "../lib/productLanguage";
export default function ProcessExperience({
  processId,
}: {
  processId?: string;
}) {
  const [language] = useProductLanguage();
  const l = (ko: string, en: string, ja: string) => tr(language, ko, en, ja);
  const initialProcess: ProcessId =
    processId &&
    Object.prototype.hasOwnProperty.call(processEquipment, processId)
      ? (processId as ProcessId)
      : "etch";
  useEffect(() => {
    document.title = tr(
      language,
      "SemiGuard — 8대 공정 직접 체험",
      "SemiGuard — Eight-process hands-on lab",
      "SemiGuard — 8大工程の操作体験"
    );
  }, [language]);
  return (
    <div className="ho-page">
      <div className="ho-page-links">
        <Link href="/learn">
          {l("← 8대 공정 학습", "← Process learning", "← 8大工程の学習")}
        </Link>
        <Link href="/training">
          {l(
            "판단 연습 선택 →",
            "Choose judgment practice →",
            "判断練習の選択 →"
          )}
        </Link>
      </div>
      <ProcessHandsOnLab
        key={initialProcess}
        language={language}
        initialProcess={initialProcess}
      />
    </div>
  );
}
