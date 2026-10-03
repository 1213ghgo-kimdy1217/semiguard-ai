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
    <p>{l("모듈·선택 답안·발견 표시·구성 기준 비교만 공유합니다. 이름·계정 정보·서술형 답변·다른 기록은 포함하지 않습니다. 링크를 가진 사람은 7일 동안 로그인 없이 볼 수 있으며, 만들어진 링크를 개별 취소할 수는 없습니다. 자동으로 친구에게 보내지 않습니다.", "Shares this module, choices, marker and teaching-criteria comparison only—not your name, account, written answers or other records. Anyone holding the link can view it for seven days. Issued links cannot be individually revoked; nothing is sent automatically.", "モジュール・選択回答・印・構成基準との比較だけ共有し、名前・アカウント情報・記述回答・他の記録は含みません。リンクを持つ人は7日間ログインせず閲覧できます。発行済みリンクは個別に取り消せず、自動送信もしません。")}</p>
    <label><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} /> {l("공유 범위와 7일 공개에 동의합니다.", "I agree to this scope and seven-day link access.", "共有範囲と7日間のリンク閲覧に同意します。")}</label>
    <div className="et-actions"><button type="button" className="et-linkbutton" disabled={!consent || share.isPending} onClick={() => void create()}>{share.isPending ? l("생성 중…", "Creating…", "作成中…") : l("읽기 전용 공유 링크 만들기", "Create a read-only share link", "閲覧専用リンクを作成")}</button></div>
    {link ? <><label htmlFor="training-share-url">{l("공유 링크", "Share link", "共有リンク")}</label><input id="training-share-url" readOnly value={link} onFocus={e => e.currentTarget.select()} /><button type="button" className="et-linkbutton" onClick={() => void copy()}>{l("링크 복사", "Copy link", "リンクをコピー")}</button><p>{l("만료", "Expires", "有効期限")} · {new Date(expires).toLocaleString(language)}</p></> : null}
    <p role="status" aria-live="polite">{notice}</p>
  </section>;
}
