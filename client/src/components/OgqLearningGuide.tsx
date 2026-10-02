import { useId, useState } from "react";
import { BookOpen } from "lucide-react";
import { learningCheckpoints, type LearningCheckpoint } from "../../../shared/learningGuide";
import { tr, type ProductLanguage } from "../lib/productLanguage";
import { trpc } from "../lib/trpc";
import "./ogq-learning-guide.css";

export default function OgqLearningGuide({ language, review = false }: { language: ProductLanguage; review?: boolean }) {
  const l = (ko: string, en: string, ja: string) => tr(language, ko, en, ja);
  const id = useId();
  const [checkpoint, setCheckpoint] = useState<LearningCheckpoint>("reference");
  const [showImage, setShowImage] = useState(true);
  const [failedUrl, setFailedUrl] = useState("");
  const auth = trpc.auth.me.useQuery();
  // Reuse the existing query cache, including across prompt and language changes.
  const guide = trpc.learning.guide.useQuery(undefined, {
    enabled: Boolean(auth.data) && showImage, staleTime: 10 * 60_000,
    retry: false, refetchOnWindowFocus: false,
  });
  const prompt = learningCheckpoints.find(item => item.id === checkpoint)!;
  const asset = auth.data && guide.data?.status === "ready" ? guide.data.asset : null;
  const imageUrl = asset ? guide.data?.images.find(item => item.checkpoint === checkpoint)?.imageUrl : undefined;
  const displayImage = showImage && imageUrl && imageUrl !== failedUrl;

  return <aside className="ogq-guide" aria-labelledby={`${id}-title`}>
    <div className="ogq-guide-visual" aria-hidden="true">
      {displayImage ? <img src={imageUrl} alt="" width={104} height={104} loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setFailedUrl(imageUrl)} /> : <BookOpen size={36} />}
    </div>
    <div className="ogq-guide-content">
      <p className="ogq-guide-label">LEARNING CHECKPOINT</p>
      <h2 id={`${id}-title`}>{review ? l("복기할 때 다시 던질 세 가지 질문", "Three questions for your review", "振り返りで再確認する3つの問い") : l("판단 연습의 세 가지 질문", "Three questions for your reasoning", "判断練習の3つの問い")}</h2>
      <div className="ogq-guide-choices" role="group" aria-label={l("학습 질문 선택", "Choose a learning prompt", "学習の問いを選ぶ")}>
        {learningCheckpoints.map(item => <button key={item.id} type="button" aria-pressed={checkpoint === item.id} aria-controls={`${id}-prompt`} onClick={() => setCheckpoint(item.id)}>{item.title[language]}</button>)}
      </div>
      <p id={`${id}-prompt`} className="ogq-guide-question" aria-live="polite">{prompt.question[language]}</p>
      <p className="ogq-guide-note">{l("SemiGuard 사전 작성 학습 안내 · AI 생성 답변·정답·기술 근거가 아닙니다.", "SemiGuard's prewritten learning prompts · not AI responses, answers, or technical evidence.", "SemiGuardが作成した学習案内 · AI生成回答、正解、技術的根拠ではありません。")}</p>
      <details className="ogq-guide-credit"><summary>{l("안내 이미지 출처와 표시 설정", "Image credit and display settings", "案内画像の出典と表示設定")}</summary>
        <p>{asset ? `${asset.title} · ${asset.creator} · ` : "OGQ · "}{l("대회에서 제공한 공식 IP의 미리보기입니다. 안내용이며 반도체 장비 이미지나 OGQ의 기술 검증을 의미하지 않습니다. 대회 참여 목적 외 재배포·복제는 금지됩니다.", "Preview of official IP provided for the competition. This is a learning illustration, not semiconductor equipment or technical validation by OGQ. Redistribution or copying outside competition participation is prohibited.", "大会で提供された公式IPのプレビューです。案内用であり、半導体装置の画像やOGQによる技術検証を意味しません。大会参加目的以外の再配布・複製は禁止されています。")}</p>
        <p>{!auth.data ? l("로그인하면 OGQ 안내 이미지를 표시합니다. 학습 질문은 로그인 없이도 사용할 수 있습니다.", "Sign in to display OGQ illustrations. The learning prompts work without signing in.", "ログインするとOGQの案内画像を表示します。学習の問いはログインなしでも使えます。") : guide.isLoading && showImage ? l("안내 이미지를 불러오는 중입니다.", "Loading the illustration.", "案内画像を読み込み中です。") : (!asset || failedUrl === imageUrl) && showImage ? l("안내 이미지를 불러오지 못했습니다. 학습 질문과 훈련은 그대로 사용할 수 있습니다.", "The illustration is unavailable. Learning prompts and practice still work.", "案内画像を読み込めませんでした。学習の問いと練習はそのまま使えます。") : l("이미지는 OGQ 미리보기 서버에서 불러오며, 질문·답안·센서값은 OGQ에 전송하지 않습니다.", "Images load from OGQ's preview server. Questions, answers, and sensor values are not sent to OGQ.", "画像はOGQのプレビューサーバーから読み込みます。質問、回答、センサー値はOGQに送信しません。")}</p>
        <label><input type="checkbox" checked={showImage} onChange={event => setShowImage(event.target.checked)} />{l("OGQ 안내 이미지 표시", "Show OGQ illustrations", "OGQの案内画像を表示")}</label>
      </details>
    </div>
  </aside>;
}
