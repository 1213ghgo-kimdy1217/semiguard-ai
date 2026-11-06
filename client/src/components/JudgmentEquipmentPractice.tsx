import { lazy, Suspense, useState } from "react";
import type { ProcessId } from "../../../shared/processScenarios";
import { tr, type ProductLanguage } from "../lib/productLanguage";
const EquipmentPractice = lazy(() => import("./ProcessHandsOnLab"));
export default function JudgmentEquipmentPractice({
  processId,
  language,
}: {
  processId: ProcessId;
  language: ProductLanguage;
}) {
  const [open, setOpen] = useState(false);
  const l = (ko: string, en: string, ja: string) => tr(language, ko, en, ja);
  return (
    <details
      className="jd-preparation et-panel"
      open={open}
      onToggle={event => setOpen(event.currentTarget.open)}
    >
      <summary>
        {l(
          "장비를 직접 움직여 본 뒤 판단 연습 시작하기",
          "Try the equipment before judgment practice",
          "装置を動かしてから判断練習を始める"
        )}
      </summary>
      {open ? (
        <>
          <p className="et-caption">
            {l(
              "먼저 이 장비의 공정 역할을 손으로 익혀보세요. 그다음 주어진 가상 기록을 관찰하고 판단을 제출하면, 같은 장면에서 복기할 수 있어요.",
              "Explore the equipment's process role first. Then observe the supplied virtual record, submit your reasoning and review the same scene.",
              "先に装置の工程での役割を体験します。その後、用意された仮想記録を観察し、判断を提出して同じ場面で振り返れます。"
            )}
          </p>
          <Suspense
            fallback={
              <p role="status">
                {l(
                  "장비 준비 체험을 여는 중…",
                  "Opening equipment preparation…",
                  "装置の準備体験を開いています…"
                )}
              </p>
            }
          >
            <EquipmentPractice
              language={language}
              initialProcess={processId}
              embedded
            />
          </Suspense>
        </>
      ) : null}
    </details>
  );
}
