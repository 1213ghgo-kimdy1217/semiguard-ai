export const learningCheckpoints = [
  {
    id: "reference",
    title: { ko: "정상과 비교", en: "Compare references", ja: "正常と比較" },
    question: {
      ko: "같은 공정 단계·같은 시점의 정상 참고 기록과 무엇이 다른가요? 값의 차이와 범위 이탈은 따로 확인하세요.",
      en: "What differs from the normal reference at the same phase and time? Check the difference and crossing a range boundary separately.",
      ja: "同じ工程段階・同じ時点の正常参照記録と何が違いますか？値の差と範囲からの逸脱を別々に確認しましょう。",
    },
  },
  {
    id: "compare",
    title: { ko: "여러 신호 비교", en: "Compare signals", ja: "複数の信号を比較" },
    question: {
      ko: "같은 시점에 다른 센서도 달라졌나요? 센서의 단위와 위치를 구분하고, 한 점이 아닌 변화 추이를 확인하세요.",
      en: "Did other sensors change at the same time? Distinguish units and locations, then check the trend rather than one point.",
      ja: "同じ時点で他のセンサーも変化しましたか？単位と位置を区別し、一点ではなく変化の推移を確認しましょう。",
    },
  },
  {
    id: "uncertainty",
    title: { ko: "사실과 추정 구분", en: "Separate facts and inference", ja: "事実と推測を区別" },
    question: {
      ko: "직접 본 수치·시점은 사실이고, 가능한 원인은 아직 추정입니다. 모르는 점을 적고 기존 가상 기록에서 다음에 비교할 근거를 정하세요.",
      en: "The values and times you observed are facts; possible causes remain hypotheses. Note what is unknown and choose the next evidence to compare in existing virtual records.",
      ja: "観察した数値と時点は事実ですが、原因候補はまだ推測です。不明な点を記録し、既存の仮想記録で次に比較する根拠を選びましょう。",
    },
  },
] as const;

export type LearningCheckpoint = typeof learningCheckpoints[number]["id"];
