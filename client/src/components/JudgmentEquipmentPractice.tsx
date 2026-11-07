import { lazy, Suspense, useState } from "react";
import type { ProcessId } from "@shared/processScenarios";
import { tr, type ProductLanguage } from "../lib/productLanguage";

const StudioPreparation = lazy(() => import("./judgment-studio/StudioPreparation"));

export default function JudgmentEquipmentPractice({
  processId,
  language,
  onObserve,
}: {
  processId: ProcessId;
  language: ProductLanguage;
  onObserve: () => void;
}) {
  const [open, setOpen] = useState(true);
  const l = (ko: string, en: string, ja: string) => tr(language, ko, en, ja);

  return (
    <details className="jd-preparation et-panel" open={open} onToggle={event => setOpen(event.currentTarget.open)}>
      <summary>{l("장비를 직접 움직여 본 뒤 판단 연습 시작하기", "Try the equipment before judgment practice", "装置を動かしてから判断練習を始める")}</summary>
      {open && (
        <Suspense fallback={<p role="status">{l("장비 준비 체험을 여는 중…", "Opening equipment preparation…", "装置の準備体験を開いています…")}</p>}>
          <StudioPreparation key={processId} processId={processId} language={language} onObserve={onObserve} />
        </Suspense>
      )}
    </details>
  );
}
