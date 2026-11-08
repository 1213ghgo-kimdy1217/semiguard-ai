import { useState } from "react";
import { trpc } from "../lib/trpc";
import { tr, type ProductLanguage } from "../lib/productLanguage";

export default function TrainingShareControls({ id, language }: { id: number; language: ProductLanguage }) {
  const l = (ko: string, en: string, ja: string) => tr(language, ko, en, ja);
  const share = trpc.training.share.useMutation();
  const [consent, setConsent] = useState(false);
  const [link, setLink] = useState("");
  const [expires, setExpires] = useState("");
  const [notice, setNotice] = useState("");
  const create = async () => {
    if (!consent || share.isPending) return;
    setNotice("");
    try {
      const result = await share.mutateAsync({ id, consent: true });
      // A fragment keeps the bearer token out of page-path and referrer logs.
      setLink(`${window.location.origin}/training/shared#${result.token}`); setExpires(result.expiresAt);
    } catch { setNotice(l("공유 링크를 만들지 못했습니다. 다시 시도하세요.", "Could not create a shared link. Please retry.", "共有リンクを作成できませんでした。再試行してください。")); }
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(link); setNotice(l("링크를 복사했습니다. 원하는 사람에게 직접 보내세요.", "Link copied. Send it to the people you choose.", "リンクをコピーしました。共有したい相手に直接送ってください。")); }
    catch { setNotice(l("아래 링크를 직접 선택해 복사하세요.", "Select and copy the link below manually.", "下のリンクを選択し、手動でコピーしてください。")); }
  };
  return <section className="et-panel"><p className="et-eyebrow">SHARE A SELECTED RESULT</p><h2>{l("이 판단 결과만 공유하기", "Share only this reasoning result", "この判断結果だけ共有")}</h2>
    <p>{l("이 공정의 선택 답안, 저장된 표시 한 개, 연습 기준과의 비교 결과를 공유합니다. 이름, 계정 정보, 서술형 답변, 다른 기록은 포함하지 않습니다. 로그인한 사용자는 유효한 링크로 발급 후 7일 동안 볼 수 있습니다. 발급한 링크를 개별 취소할 수 없으며, 링크는 직접 전달해야 합니다.", "The link shares your choices for this process, the saved marker, and how the choices compare with the practice criteria. It leaves out your name, account details, written answers, and other records. Signed-in users with a valid link can view it for seven days. You share the link yourself, and issued links cannot be revoked individually.", "この工程の選択回答、保存された印1件、練習基準との比較結果を共有します。氏名、アカウント情報、記述回答、他の記録は含みません。ログインしたユーザーは有効なリンクで発行から7日間閲覧できます。リンクはご自身で共有してください。発行済みリンクの個別の取り消しはできません。")}</p>
    <label><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} /> {l("공유 범위와 로그인 사용자의 7일 링크 열람에 동의합니다.", "I agree to this scope and seven-day link access for signed-in users.", "共有範囲とログインしたユーザーによる7日間のリンク閲覧に同意します。")}</label>
    <div className="et-actions"><button type="button" className="et-linkbutton" disabled={!consent || share.isPending} onClick={() => void create()}>{share.isPending ? l("생성 중…", "Creating…", "作成中…") : l("읽기 전용 공유 링크 만들기", "Create a read-only share link", "閲覧専用リンクを作成")}</button></div>
    {link ? <><label htmlFor="training-share-url">{l("공유 링크", "Share link", "共有リンク")}</label><input id="training-share-url" readOnly value={link} onFocus={e => e.currentTarget.select()} /><button type="button" className="et-linkbutton" onClick={() => void copy()}>{l("링크 복사", "Copy link", "リンクをコピー")}</button><p>{l("만료", "Expires", "有効期限")} · {new Date(expires).toLocaleString(language)}</p></> : null}
    <p role="status" aria-live="polite">{notice}</p>
  </section>;
}
