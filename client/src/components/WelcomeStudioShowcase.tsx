import { useState } from "react";
import { ArrowUpRight, Box, History, ScanLine } from "lucide-react";
import { Link } from "wouter";
import { tr, type ProductLanguage } from "../lib/productLanguage";

const stages = [
  {
    id: "prepare",
    icon: Box,
    label: ["장비 열기", "Open equipment", "装置を開く"],
    title: [
      "외관에서 공정 원리로",
      "From equipment to process",
      "装置の外観から工程の原理へ",
    ],
    detail: [
      "산화로 문을 열고, 내부의 웨이퍼 보트와 히터를 살펴봐요.",
      "Open the oxidation furnace and inspect the wafer boat and heater inside.",
      "酸化炉の扉を開け、内部のウェーハボートとヒーターを観察します。",
    ],
    alt: [
      "수직 배치식 산화로의 3D 외관",
      "3D exterior of the vertical batch oxidation furnace",
      "縦型バッチ式酸化炉の3D外観",
    ],
  },
  {
    id: "observe",
    icon: ScanLine,
    label: ["원리 관찰", "Observe the process", "原理を観察"],
    title: [
      "산화막이 자라는 원리를 확대해 관찰",
      "Explore how the oxide layer grows",
      "酸化膜が成長する仕組みを観察",
    ],
    detail: [
      "웨이퍼 단면의 산화막이 자라는 모습을 보고, 이어서 가상 검사 기록을 정상 참고와 비교해요.",
      "Watch the oxide layer grow in the wafer cross-section, then compare synthetic readings with a normal reference.",
      "ウェーハ断面で酸化膜の成長を観察した後、仮想の検査記録を正常参照値と比べます。",
    ],
    alt: [
      "산화로 내부와 웨이퍼 단면의 3D 확대 장면",
      "Close-up of the furnace interior and wafer cross-section",
      "酸化炉内部とウェーハ断面の3D拡大画面",
    ],
  },
  {
    id: "review",
    icon: History,
    label: ["판단 복기", "Review judgment", "判断を振り返る"],
    title: [
      "같은 장면에서 판단 다시 보기",
      "Revisit your judgment in the same scene",
      "同じ場面で判断を見直す",
    ],
    detail: [
      "제출 뒤 표시한 시점으로 돌아가 검사값과 내 판단을 다시 보고, 참고 장비와 제조사 자료를 확인해요.",
      "After submitting, return to a marked time to review the readings and your judgment, then explore equipment and manufacturer sources.",
      "提出後は記録した時点に戻って検査値と自分の判断を見直し、参考装置やメーカー資料も確認できます。",
    ],
    alt: [
      "복기 시점의 산화막 단면과 검사 모니터",
      "Oxide cross-section and inspection monitor at a review point",
      "振り返り時点の酸化膜断面と検査モニター",
    ],
  },
] as const;

type Stage = (typeof stages)[number]["id"];

export default function WelcomeStudioShowcase({
  language,
  signedIn,
}: {
  language: ProductLanguage;
  signedIn: boolean;
}) {
  const [stageId, setStageId] = useState<Stage>("prepare");
  const index = stages.findIndex(stage => stage.id === stageId);
  const stage = stages[index];
  const l = (ko: string, en: string, ja: string) => tr(language, ko, en, ja);
  const localized = (copy: readonly [string, string, string]) => l(...copy);
  return (
    <figure
      className="sg-studio-showcase"
      id="studio-preview"
      aria-labelledby="sg-showcase-title"
    >
      <header className="sg-showcase-head">
        <div>
          <p className="sg-eyebrow">
            {l(
              "8대 공정 판단 연습",
              "EIGHT-PROCESS JUDGMENT PRACTICE",
              "8大工程の判断練習"
            )}
          </p>
          <h2 id="sg-showcase-title">
            {l(
              "산화 장비 안에서 판단하기",
              "Practise judgment inside the oxidation furnace",
              "酸化炉の中を観察して判断する"
            )}
          </h2>
        </div>
        <span className="sg-showcase-badge">3D</span>
      </header>
      <div className="sg-showcase-viewport" data-stage={stageId}>
        <img
          key={stageId + language}
          src={
            stageId === "prepare"
              ? "/studio-preview/oxidation-prepare.jpg"
              : "/studio-preview/oxidation-" + stageId + "-" + language + ".jpg"
          }
          width={983}
          height={600}
          alt={localized(stage.alt)}
          fetchPriority={stageId === "prepare" ? "high" : "auto"}
          decoding="async"
        />
        <div className="sg-showcase-overlay" aria-hidden="true">
          <span>
            <i />
            {l("산화", "Oxidation", "酸化")}
          </span>
          <span>0{index + 1} / 03</span>
        </div>
      </div>
      <div
        className="sg-showcase-tabs"
        role="group"
        aria-label={l(
          "미리 볼 단계 선택",
          "Choose a stage to preview",
          "プレビューする段階を選択"
        )}
      >
        {stages.map(item => (
          <button
            type="button"
            key={item.id}
            data-stage={item.id}
            aria-pressed={stageId === item.id}
            aria-controls="sg-showcase-stage"
            onClick={() => setStageId(item.id)}
          >
            <item.icon size={16} aria-hidden="true" />
            <span>{localized(item.label)}</span>
          </button>
        ))}
      </div>
      <figcaption className="sg-showcase-caption" id="sg-showcase-stage">
        <div aria-live="polite">
          <h3>{localized(stage.title)}</h3>
          <p>{localized(stage.detail)}</p>
        </div>
        <div className="sg-showcase-footer">
          <span>
            {l(
              "교육용 가상 기록",
              "Synthetic training records",
              "教育用の仮想記録"
            )}
          </span>
          <Link href="/training/process/oxidation">
            {signedIn
              ? l(
                  "산화 판단 연습 열기",
                  "Open oxidation practice",
                  "酸化の判断練習を開く"
                )
              : l(
                  "산화 판단 연습 · 로그인 필요",
                  "Oxidation practice · sign-in required",
                  "酸化の判断練習・ログインが必要"
                )}
            <ArrowUpRight size={15} aria-hidden="true" />
          </Link>
        </div>
      </figcaption>
    </figure>
  );
}
