import React, { type Ref } from "react";
import { Link } from "wouter";
import { ArrowLeft, ArrowRight, Layers, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { tr, type ProductLanguage } from "../lib/productLanguage";
import "./practice-entry-options.css";

type LanguageProps = { language: ProductLanguage };

export function PracticeWorkspaceNav({ language }: LanguageProps) {
  const l = (ko: string, en: string, ja: string) => tr(language, ko, en, ja);
  return <nav className="et-workspace-links" aria-label={l("학습 작업 공간 바로가기", "Learning workspace shortcuts", "学習画面のショートカット")}>
    <a href="#practice-options">{l("연습 방식", "Practice options", "練習方法")} <span aria-hidden="true">↓</span></a>
    <a href="#practice-history">{l("내 학습 기록", "My practice history", "自分の練習記録")} <span aria-hidden="true">↓</span></a>
  </nav>;
}

export function PracticeLearningOptions({ language, onSensorBrief }: LanguageProps & { onSensorBrief: () => void }) {
  const l = (ko: string, en: string, ja: string) => tr(language, ko, en, ja);
  return <>
    <section className="et-panel et-entry-card" aria-labelledby="process-option-title">
      <div className="et-card-top"><span className="et-card-icon"><Layers aria-hidden="true" /></span><span className="et-card-kind">{l("공정 이해", "Process concepts", "工程を理解")}</span></div>
      <p className="et-eyebrow">PROCESS LEARNING</p>
      <h2 id="process-option-title">{l("8대 공정 학습", "Eight-process learning", "8大工程の学習")}</h2>
      <p>{l("신호의 의미가 낯설다면 여기서 시작하세요. 8대 공정의 원리·장비·확인 근거를 읽고 간단한 자가 확인을 해봅니다.", "Start here if the signals are unfamiliar. Read about eight process principles, equipment and evidence, then try short self-checks.", "信号の意味に慣れていなければ、ここから始めましょう。8工程の原理・装置・確認根拠を読み、簡単な自己確認を行います。")}</p>
      <div className="et-tags"><span>{l("공정 · 장비 · 근거", "Processes · equipment · evidence", "工程・装置・根拠")}</span><span>{l("자가 확인", "Self-checks", "自己確認")}</span></div>
      <p className="et-caption">{l("필요한 공정만 읽어도 됩니다. 각 공정의 판단 연습으로 연결되며, 상단 메뉴로 언제든 다시 볼 수 있습니다.", "Read only what you need. Each process connects to its judgment exercise; return anytime through the top menu.", "必要な工程だけ読めます。各工程の判断練習へ進め、上部メニューからいつでも見直せます。")}</p>
      <Link className="et-linkbutton" href="/learn">{l("공정 학습 열기", "Open process learning", "工程学習を開く")} <ArrowRight size={18} aria-hidden="true" /></Link>
    </section>
    <section className="et-panel et-entry-card et-navy" aria-labelledby="sensor-option-title">
      <div className="et-card-top"><span className="et-card-icon"><SlidersHorizontal aria-hidden="true" /></span><span className="et-card-kind">{l("단위·기여도 비교", "Units and contributions", "単位・寄与を比較")}</span></div>
      <p className="et-eyebrow">FOUR-SENSOR WORKSPACE</p>
      <h2 id="sensor-option-title">{l("4센서 대시보드", "Four-sensor dashboard", "4センサーダッシュボード")}</h2>
      <p>{l("전류·온도·진동·소음의 단위와 정상 참고 범위를 구분하고, 변화 그래프·규칙 점수 기여도·관측 이력을 함께 읽어보세요.", "Distinguish current, temperature, vibration and noise units and reference ranges. Read their trends, rule-score contributions and observation history together.", "電流・温度・振動・騒音の単位と正常参照範囲を区別し、推移・ルールスコアへの寄与・観測履歴を一緒に読みます。")}</p>
      <div className="et-tags"><span>{l("서로 다른 4개 단위", "Four distinct units", "異なる4つの単位")}</span><span>{l("근거 · 추이 · 이력", "Evidence · trends · history", "根拠・推移・履歴")}</span></div>
      <p className="et-caption">{l("고정 답안을 제출하는 시나리오가 아닙니다. 로그인 후 사용하는 교육용 가상 센서 작업 공간이며, 먼저 활용 방법을 확인합니다.", "Not a fixed-answer scenario. This signed-in workspace uses synthetic training sensors; review its purpose before entering.", "決まった回答を提出するシナリオではありません。ログインして使う教育用の仮想センサー画面です。まず使い方を確認します。")}</p>
      <Button type="button" className="et-primary" onClick={onSensorBrief}>{l("활용 방법 먼저 보기", "See how to use it", "まず使い方を見る")}<ArrowRight aria-hidden="true" /></Button>
    </section>
  </>;
}

export function FourSensorBrief({ language, headingRef, onBack }: LanguageProps & { headingRef: Ref<HTMLHeadingElement>; onBack: () => void }) {
  const l = (ko: string, en: string, ja: string) => tr(language, ko, en, ja);
  return <>
    <p className="et-eyebrow">BEFORE YOU ENTER / FOUR-SENSOR WORKSPACE</p>
    <h1 ref={headingRef} tabIndex={-1}>{l("4개의 신호를, 하나의 근거로 연결하세요.", "Connect four signals into evidence.", "4つの信号を、判断の根拠につなげましょう。")}</h1>
    <p className="et-lead">{l("이 대시보드는 전류·온도·진동·소음의 가상 관측값을 비교하는 작업 공간입니다. 점수만 보는 대신 어느 신호가 달라졌고, 그 변화가 이어지는지 직접 확인하세요.", "This workspace compares synthetic current, temperature, vibration, and noise observations. Look beyond the score: identify which signal changed and whether the change persists.", "この画面では電流・温度・振動・騒音の仮想観測値を比較します。点数だけでなく、どの信号が変化し、その変化が続いているかを確認してください。")}</p>
    <div className="et-columns">
      <section className="et-panel">
        <h2>{l("여기서 연습할 수 있는 것", "What you can practice", "ここで練習できること")}</h2>
        <ol className="et-entry-steps">
          <li><h3>{l("현재값과 참고 범위 비교", "Compare values with reference ranges", "現在値と参照範囲を比較")}</h3><p>{l("전류 A · 온도 °C · 진동 mm/s · 소음 dB를 구분하고, 센서별 편차와 규칙 점수 기여도를 살펴보세요.", "Distinguish current A, temperature °C, vibration mm/s, and noise dB. Inspect each deviation and its rule-score contribution.", "電流A・温度°C・振動mm/s・騒音dBを区別し、各センサーの偏差とルールスコアへの寄与を確認します。")}</p></li>
          <li><h3>{l("한 점이 아닌 변화 추이 확인", "Check trends, not just one point", "一点ではなく変化の推移を確認")}</h3><p>{l("변화 그래프와 관측 이력에서 같은 시점의 다른 센서도 비교하세요. 한 번의 범위 이탈만으로 고장을 확정하지 마세요.", "Compare other sensors at the same time using trends and observation history. One out-of-range reading does not confirm a failure.", "変化グラフと観測履歴で同じ時点の他のセンサーも比較します。一度の範囲逸脱だけで故障を断定しないでください。")}</p></li>
          <li><h3>{l("관찰 사실과 원인 후보 분리", "Separate facts from possible causes", "観察した事実と原因候補を分ける")}</h3><p>{l("직접 근거를 읽은 뒤 AI 설명 보조에 질문하세요. 설명 속 원인 후보는 추정이며, 확인할 근거가 무엇인지 함께 검토하세요.", "Read the evidence yourself, then ask the AI explanation assistant. Possible causes are hypotheses; consider what evidence would check them.", "自分で根拠を読んでからAIの説明補助に質問します。原因候補は推定であり、確認に必要な根拠も検討してください。")}</p></li>
        </ol>
      </section>
      <aside className="et-panel et-navy">
        <h2>{l("다른 연습과 무엇이 다른가요?", "How is this different?", "他の練習との違いは？")}</h2>
        <p>{l("8대 공정 판단 연습은 준비된 공정별 가상 기록을 끝까지 관찰하고 답안을 제출·복기합니다. 자유 분석은 별도의 식각 신호나 CSV를 제한 없이 관찰합니다. 여기서는 단위가 다른 4센서와 규칙 기반 위험 근거·이력을 함께 비교합니다.", "Eight-process judgment practice uses prepared synthetic process records for complete observation, submission, and review. Free observation explores a separate etch stream or CSV without a time limit. Here, compare four sensors with distinct units, rule-based risk evidence, and history.", "8大工程の判断練習では、準備された工程別の仮想記録を最後まで観察し、回答提出と振り返りを行います。自由観察では別のエッチング信号やCSVを時間制限なく確認します。ここでは単位が異なる4センサーと、ルールベースのリスク根拠・履歴を比較します。")}</p>
        <h3>{l("이용 범위와 한계", "Scope and limits", "利用範囲と限界")}</h3>
        <p>{l("센서 데이터와 정상 참고 범위는 교육용 가상 값이며 특정 장비의 실제 운전 기준이 아닙니다. 위험 점수는 정상 기준과 z-score를 이용한 규칙 기반 계산입니다. AI는 위험 점수를 계산하거나 고장을 확정하지 않습니다.", "Sensor data and reference ranges are synthetic training values, not real equipment operating limits. Risk scores use rule-based reference and z-score calculations. AI does not calculate the risk score or confirm failures.", "センサーデータと正常参照範囲は教育用の仮想値で、特定装置の実際の運転基準ではありません。リスクスコアは正常基準とz-scoreによるルールベースの計算です。AIはリスクスコアを計算せず、故障を確定しません。")}</p>
        <p className="et-caption">{l("실제 팹 장비 연결·제어는 없으며 현장 성능은 검증되지 않았습니다. 가상 신호 생성은 내 계정의 관측 로그를 만들 수 있습니다. 초기화·삭제 도구는 설명을 확인하고 사용하세요.", "There is no real fab connection or control, and field performance is unvalidated. Generating synthetic signals can create observation logs in your account. Read notices before using reset or deletion tools.", "実際の製造装置への接続・制御はなく、現場性能は未検証です。仮想信号の生成でアカウントに観測ログが作成される場合があります。リセット・削除の案内を確認してから使用してください。")}</p>
        <Link className="et-inline-link" href="/learn">{l("공정 맥락이 필요하다면 8대 공정 학습 →", "Need process context? Open the learning hub →", "工程の背景が必要なら8大工程の学習へ →")}</Link>
      </aside>
    </div>
    <div className="et-actions">
      <Button type="button" variant="outline" onClick={onBack}><ArrowLeft aria-hidden="true" />{l("선택 화면으로", "Back to choices", "選択画面へ")}</Button>
      <Link className="et-linkbutton" href="/dashboard">{l("4센서 대시보드 들어가기", "Enter four-sensor dashboard", "4センサーダッシュボードに進む")} <ArrowRight size={18} aria-hidden="true" /></Link>
    </div>
    <p className="et-caption">{l("로그인이 필요합니다. 시나리오 완료는 필요하지 않으며, 이 안내를 열어도 진행 중인 시나리오 답안은 바뀌지 않습니다.", "Sign-in is required; scenario completion is not. Opening this guide does not change your in-progress scenario draft.", "ログインが必要です。シナリオの完了は不要で、この案内を開いても進行中の回答は変わりません。")}</p>
  </>;
}
