import React from "react";
import type { ProductLanguage } from "../lib/productLanguage";

const COPY = {
  ko: {
    title: "먼저 이것부터 해보세요",
    judgment: {
      goal: "수치의 크기만 보지 말고, 같은 관측 항목의 이번 기록과 정상 참고를 비교하세요.",
      steps: ["관측 항목 하나 선택", "같은 조건의 정상 참고와 비교", "차이가 이어지는지·반복되는지 확인"],
      scope: "정상 참고와 차이가 없는 기록도 있습니다. 변화만으로 고장을 단정하지 마세요.",
    },
    free: {
      goal: "관찰한 사실과 원인 추정을 구분하는 연습입니다. 정해진 정답을 제출하지 않습니다.",
      steps: ["관찰 시작 후 센서 하나 선택", "같은 단계의 정상 참고와 비교", "시점을 고르고 관찰 사실 메모"],
      scope: "차이가 없다면 그것도 관찰 사실입니다. 실제 장비의 고장을 진단하는 화면은 아닙니다.",
    },
  },
  en: {
    title: "Start with these three steps",
    judgment: {
      goal: "Compare the current record and normal reference for the same observation, not just the size of a number.",
      steps: ["Select one observation", "Compare with a same-condition normal reference", "Check whether a difference persists or recurs"],
      scope: "Some records do not deviate from the normal reference. A change alone does not establish a fault.",
    },
    free: {
      goal: "Practise separating observed facts from possible causes. There is no fixed answer to submit.",
      steps: ["Start observing and select one sensor", "Compare with a same-phase normal reference", "Choose a time and note what you observe"],
      scope: "No difference is also an observation. This screen does not diagnose real equipment faults.",
    },
  },
  ja: {
    title: "まずはこの3つから",
    judgment: {
      goal: "数値の大きさだけでなく、同じ観測項目の今回の記録と正常参照を比較します。",
      steps: ["観測項目を1つ選ぶ", "同じ条件の正常参照と比較", "差が続くか・繰り返すか確認"],
      scope: "正常参照と差がない記録もあります。変化だけで故障と断定しないでください。",
    },
    free: {
      goal: "観察した事実と原因の推測を分ける練習です。決まった正解を提出する画面ではありません。",
      steps: ["観察を始めてセンサーを1つ選ぶ", "同じ段階の正常参照と比較", "時点を選び、観察した事実をメモ"],
      scope: "差がないことも観察事実です。実装置の故障を診断する画面ではありません。",
    },
  },
} as const;

/** Guidance only: it cannot read or change the attempt, clock, answers, or notes. */
export default function PracticeFirstStep({ language, mode = "judgment" }: {
  language: ProductLanguage;
  mode?: "judgment" | "free";
}) {
  const copy = COPY[language];
  const guidance = copy[mode];
  return <section className="et-first-step" aria-label={copy.title}>
    <h2>{copy.title}</h2>
    <p>{guidance.goal}</p>
    <ol>{guidance.steps.map(step => <li key={step}>{step}</li>)}</ol>
    <p className="et-caption">{guidance.scope}</p>
  </section>;
}
