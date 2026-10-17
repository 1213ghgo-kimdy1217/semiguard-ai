import React, { useState } from "react";
import { getProcessScenario, processSamples } from "../../../shared/processScenarios";
import { tr, type ProductLanguage } from "../lib/productLanguage";
import "./packaging-observation.css";

const scenario = getProcessScenario("packaging")!;
/** Only observed authored records. Geometry is conceptual, never a fault diagnosis. */
export function packagingObservation(time: number) {
  const records = processSamples(scenario, "connection", time);
  const outside = records.findIndex(record => record.value < record.low || record.value > record.high);
  const returned = outside < 0 ? undefined : records.slice(outside + 1).find(record => record.value >= record.low && record.value <= record.high);
  return { records, outside: outside < 0 ? undefined : records[outside], returned };
}
export default function PackagingObservationWorkspace({ time, language }: { time: number; language: ProductLanguage }) {
  const l = (ko: string, en: string, ja: string) => tr(language, ko, en, ja);
  const view = packagingObservation(time);
  const until = view.records[view.records.length - 1].time;
  const [pinned, setPinned] = useState(0);
  const earlier = view.records[Math.min(pinned, until)];
  const current = view.records[until];
  const inside = (record: typeof current) => record.value >= record.low && record.value <= record.high;
  return <section className="pk-workspace" aria-label={l("패키징 연결 기록 비교", "Packaging connection comparison", "パッケージング接続記録比較")}>
    <h3>{l("연결 기록이 돌아오면, 무엇까지 말할 수 있나요?", "What does a returning connection record establish?", "接続記録が戻ると何が言えますか？")}</h3>
    <div className="pk-layout"><figure>
      <svg viewBox="0 0 380 240" role="img" aria-label={l("칩·본딩 와이어·기판의 패키지 단면 개념도", "Conceptual package cross-section: die, bond wires and substrate", "チップ・ボンディングワイヤ・基板のパッケージ断面概念図")}>
        <rect x="30" y="30" width="320" height="140" rx="22" fill="#263e45" stroke="#9fc4c8" strokeDasharray="6 4" />
        <rect x="25" y="170" width="330" height="25" rx="4" fill="#43635a" />
        <rect x="120" y="115" width="140" height="55" rx="4" fill="#355768" stroke="#a5d5dc" />
        <path d="M65 170Q75 65 135 115M245 115Q305 65 315 170" fill="none" stroke="#f5d589" strokeWidth="4" />
        {[60, 110, 160, 210, 260, 310].map(x => <circle key={x} cx={x} cy="210" r="10" fill="#aebdc2" />)}
        <text x="157" y="145" fill="#fff" fontSize="15">{l("칩", "Die", "チップ")}</text>
        <text x="118" y="70" fill="#f5d589" fontSize="14">{l("본딩 와이어 예시", "Example bond wires", "ボンディングワイヤ例")}</text>
      </svg>
      <figcaption>{l("본딩 방식의 한 가지 개념 예시입니다. 단면은 실제 검사 영상이 아니며, 연결 기록이 달라져도 단선·수리를 그려 넣지 않습니다.", "One conceptual wire-bonded example, not an inspection image. Record changes do not depict broken wires or repairs.", "ワイヤボンディング方式の概念例であり検査画像ではありません。記録が変わっても断線・修理を描きません。")}</figcaption>
    </figure><div>
      <label>{l("관측한 비교 시점 고정", "Pin an observed comparison time", "観測済み比較時点を固定")} · {earlier.time}s
        <input type="range" min={0} max={until} step={1} value={earlier.time} onChange={event => setPinned(Number(event.target.value))} />
      </label>
      {[{ title: l("고정한 기록", "Pinned record", "固定記録"), record: earlier }, { title: l("현재 선택 기록", "Selected record", "選択記録"), record: current }].map(({ title, record }) => {
        const x = 20 + (record.value - 80) * 5;
        return <figure key={title}><figcaption>{title} · {record.time}s · {inside(record) ? l("띠 안", "Inside band", "基準帯内") : l("띠 밖", "Outside band", "基準帯外")}</figcaption>
          <svg viewBox="0 0 240 80" role="img" aria-label={`${title}: ${record.value.toFixed(1)}`}>
            <path d="M20 40H220" stroke="#91a49a" /><rect x="100" y="16" width="40" height="45" rx="5" fill="#315d50" stroke="#9ac4b2" />
            <path d={`M${20 + (record.reference - 80) * 5} 10V66`} stroke="#fff" strokeDasharray="4 4" />
            <circle cx={x} cy="38" r="8" fill={inside(record) ? "#9bd9c3" : "#ffc078"} />
            <text x="20" y="76" fill="#c0cfc3" fontSize="10">80</text><text x="204" y="76" fill="#c0cfc3" fontSize="10">120</text>
          </svg><small>{record.value.toFixed(1)} · {l("정상 참고", "Normal reference", "正常参照")} {record.reference.toFixed(1)}</small>
        </figure>;
      })}
      <p>{l("● 연결 기록　┆ 정상 참고　▰ 참고 띠 · 교육용 상대지수", "● Connection record　┆ Normal reference　▰ Reference band · teaching indices", "● 接続記録　┆ 正常参照　▰ 基準帯・教育用相対指数")}</p>
    </div></div>
    <details><summary>{l("지금까지의 띠 이탈·복귀 기록 확인", "Inspect band exits and returns observed so far", "ここまでの基準帯逸脱・復帰を確認")}</summary>
      <p>{view.outside ? l(`첫 띠 이탈: ${view.outside.time}s`, `First band exit: ${view.outside.time}s`, `最初の帯外記録：${view.outside.time}s`) : l("아직 띠 이탈 기록 없음", "No band exit observed yet", "帯外記録はまだありません")}</p>
      <p>{view.returned ? l(`첫 띠 안 복귀: ${view.returned.time}s`, `First return inside: ${view.returned.time}s`, `最初の帯内復帰：${view.returned.time}s`) : l("이탈 뒤 띠 안 복귀는 아직 관측되지 않음", "A return inside after an exit has not yet been observed", "逸脱後の帯内復帰はまだ観測されていません")}</p>
    </details>
    <p>{l("추세 변화 시작과 띠 이탈은 다르고, 참고값 쪽으로 돌아오는 동안에도 띠 밖일 수 있습니다. 고정한 앞 기록과 현재 기록을 비교하세요. 띠 안 복귀는 실제 원인 해결의 증거가 아닙니다. 외관 기록은 기존 수치표에서 별도 근거로 확인하세요.", "Trend onset differs from band exit; a record returning toward the reference can still be outside. Compare pinned and selected records. A return inside is not proof of cause resolution. Inspect appearance separately in the existing evidence table.", "傾向変化の開始と帯逸脱は異なり、参考値へ戻る途中でも帯外の場合があります。固定記録と選択記録を比較してください。帯内復帰は原因解決の証拠ではありません。外観は既存表で別に確認してください。")}</p>
    <p className="pk-limit">{l("教育用の仮想記録", "Synthetic teaching records", "教育用の仮想記録").replace("教育用の仮想記録", "교육용 가상 기록")} · {l("관측하지 않은 결과는 표시하지 않습니다. 시점 고정은 관찰용이며 답안·채점·저장·이어하기·공유·AI 입력을 변경하지 않습니다.", "Unobserved results are hidden. Pinning is view-only, not an answer, score, save, resume, share or AI input.", "未観測結果は表示しません。時点固定は観察用で回答・採点・保存・再開・共有・AI入力を変更しません。")}</p>
  </section>;
}
