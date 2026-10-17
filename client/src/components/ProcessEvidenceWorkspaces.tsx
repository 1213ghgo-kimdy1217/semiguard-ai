import React, { useId, useState } from "react";
import { depositionEvidence, metalObservation, referenceBandPosition, type EvidenceClaim, type EvidenceSource } from "../../../shared/inspectionEvidence";
import { tr, type ProductLanguage } from "../lib/productLanguage";
import "./process-evidence-workspaces.css";

type Props = { time: number; language: ProductLanguage };
const clock = (time: number) => `${Math.floor(time / 60).toString().padStart(2, "0")}:${(time % 60).toString().padStart(2, "0")}`;
const signed = (value: number) => `${value > 0 ? "+" : ""}${value.toFixed(1)}`;
const claims: Record<EvidenceClaim, readonly [string, string, string]> = {
  "film-difference": ["선택 시점의 막 검사 기록은 자신의 참고 띠를 벗어났다.", "At the selected time, the film record is outside its own reference band.", "選択時点の膜検査記録は自身の基準帯を外れている。"],
  "electrical-in-band": ["선택 시점의 별도 전기적 검사 기록은 자신의 참고 띠 안이다.", "At the selected time, the separate electrical record is inside its own reference band.", "選択時点の別の電気的検査記録は自身の基準帯内にある。"],
  "equipment-cause": ["이 기록만으로 특정 제조 장비의 원인을 확정할 수 있다.", "These records alone confirm a particular manufacturing-equipment cause.", "この記録だけで特定の製造装置の原因を確定できる。"],
};
const claimTitles: Record<EvidenceClaim, readonly [string, string, string]> = {
  "film-difference": ["막 검사 기록의 띠 이탈", "Film record outside its band", "膜検査記録の基準帯逸脱"],
  "electrical-in-band": ["별도 전기적 기록의 띠 안", "Separate electrical record inside its band", "別の電気的記録が基準帯内"],
  "equipment-cause": ["특정 제조 장비 원인 확정", "Confirming an equipment cause", "特定の製造装置原因の確定"],
};
const sources: readonly { id: EvidenceSource; name: readonly [string, string, string] }[] = [
  { id: "film", name: ["막 검사 기록", "Film inspection record", "膜検査記録"] },
  { id: "electrical", name: ["별도 전기적 검사 기록", "Separate electrical record", "別の電気的検査記録"] },
  { id: "insufficient", name: ["이 자료로는 뒷받침할 수 없음", "Not supported by these records", "この資料では裏付けられない"] },
];

export function ProcessEvidenceBrief({ processId, language }: { processId: "deposition" | "metal"; language: ProductLanguage }) {
  const l = (ko: string, en: string, ja: string) => tr(language, ko, en, ja);
  const deposition = processId === "deposition";
  return <section className="et-panel pe-intro">
    <p className="et-eyebrow">{deposition ? "SORT THE EVIDENCE" : "FOLLOW THE RECURRENCE"}</p>
    <h2>{deposition ? l("두 검사 결과가 같은 말을 해 줄까요?", "Do two inspections support the same claim?", "二つの検査は同じ主張を裏付けますか？") : l("한 번 돌아온 기록, 그 뒤에도 같을까요?", "A record returned inside. What happened next?", "一度戻った記録、その後も同じですか？")}</h2>
    <ol>{deposition ? <>
      <li>{l("막 검사와 별도 전기적 검사를 각각 자기 기준과 비교합니다.", "Compare film and separate electrical inspections with their own references.", "膜検査と別の電気的検査を各々の基準と比較します。")}</li>
      <li>{l("문장 하나를 고르고, 어느 기록이 그 문장을 뒷받침하는지 분류해 봅니다.", "Choose a claim and classify which record supports it.", "主張を一つ選び、どの記録が裏付けるか分類します。")}</li>
    </> : <>
      <li>{l("이미 관측한 기록을 짧은 구간으로 나누고, 연결·외관의 띠 밖 기록 수를 함께 봅니다.", "Split observed records into short intervals and compare out-of-band counts for connection and appearance.", "観測済みの記録を短い区間に分け、接続・外観の基準帯外の記録数を比較します。")}</li>
      <li>{l("구간을 선택해 세부 기록을 확인하고, 앞뒤 구간에도 같은 모습이 이어지는지 살펴봅니다.", "Select an interval, inspect its records, and compare it with neighbouring intervals.", "区間を選んで詳細を確認し、前後の区間にも同じ状態が続くか比較します。")}</li>
    </>}</ol>
    <p className="et-caption">{l("교육용 가상 검사 기록입니다. 실제 생산 주기·수율·장비 고장 원인을 재현하지 않습니다.", "Synthetic inspection records for learning, not real production cycles, yield or equipment-fault causes.", "教育用の仮想検査記録です。実際の生産周期・歩留まり・装置故障原因を再現しません。")}</p>
  </section>;
}

export function DepositionWorkspace({ time, language, onInteraction }: Props & { onInteraction: () => void }) {
  const l = (ko: string, en: string, ja: string) => tr(language, ko, en, ja);
  const [claim, setClaim] = useState<EvidenceClaim>("film-difference");
  const [check, setCheck] = useState<{ time: number; claim: EvidenceClaim; source: EvidenceSource } | null>(null);
  const id = useId();
  const view = depositionEvidence(time, claim);
  const checked = check?.time === view.time && check.claim === claim ? check : null;
  return <section className="pe-workspace pe-deposition">
    <p className="et-eyebrow">EVIDENCE SORTING DESK</p>
    <h3>{l("이 문장은 어떤 기록으로 말할 수 있나요?", "Which record supports this claim?", "この主張をどの記録で裏付けられますか？")}</h3>
    <p>{l(`선택 기록 ${clock(view.time)} · 다른 목적의 별도 검사 자료입니다. 같은 웨이퍼·같은 검사라는 뜻이 아닙니다.`, `Selected record ${clock(view.time)} · separate inspections with different purposes, not evidence that they concern the same wafer or inspection.`, `選択記録 ${clock(view.time)}・異なる目的の別の検査資料です。同じウェーハ・同じ検査を意味しません。`)}</p>
    <div className="pe-evidence-cards">{(["film", "electrical"] as const).map(signal => {
      const sample = view[signal];
      return <article key={signal}>
        <p className="pe-card-code">{signal === "film" ? "RECORD A / FILM" : "RECORD B / ELECTRICAL"}</p>
        <h4>{signal === "film" ? l("증착 결과의 막 검사", "Deposition-result film inspection", "成膜結果の膜検査") : l("별도 이온 주입 결과의 전기적 검사", "Separate implantation-result electrical inspection", "別のイオン注入結果の電気的検査")}</h4>
        <p>{signal === "film" ? l("막 검사 기록이 자기 참고 기준과 다른지 확인하는 자료", "Evidence for comparing film inspection with its own reference", "膜検査記録を自身の参考基準と比較する資料") : l("전기적 검사 기록을 자기 기준과 비교하는 자료 · 막 검사를 대신하지 않음", "Evidence for its own electrical reference comparison, not a substitute for film inspection", "電気的検査を自身の基準と比較する資料・膜検査の代わりにはならない")}</p>
        <dl><div><dt>{l("이번 / 정상 참고", "Current / normal reference", "今回 / 正常参照")}</dt><dd>{sample.value.toFixed(1)} / {sample.reference.toFixed(1)}</dd></div>
          <div><dt>{l("차이", "Difference", "差")}</dt><dd>{signed(sample.value - sample.reference)}</dd></div>
          <div><dt>{l("이 검사의 참고 띠", "This inspection's reference band", "この検査の基準帯")}</dt><dd>{sample.low.toFixed(1)}–{sample.high.toFixed(1)}</dd></div></dl>
      </article>;
    })}</div>
    <div className="pe-classifier">
      <label htmlFor={id}>{l("검토할 문장", "Claim to examine", "検討する主張")}</label>
      <select id={id} value={claim} onChange={event => { onInteraction(); setClaim(event.target.value as EvidenceClaim); setCheck(null); }}>
        {(Object.keys(claims) as EvidenceClaim[]).map(key => <option key={key} value={key}>{l(...claimTitles[key])}</option>)}
      </select>
      <p className="pe-claim">{l(...claims[claim])}</p>
      <div className="pe-source-picker" role="group" aria-label={l("문장을 뒷받침하는 근거 선택", "Choose supporting evidence", "主張を裏付ける根拠を選ぶ")}>
        {sources.map(source => <button type="button" key={source.id} aria-pressed={checked?.source === source.id} onClick={() => { onInteraction(); setCheck({ time: view.time, claim, source: source.id }); }}>{l(...source.name)}</button>)}
      </div>
      {checked ? <div className="pe-check" role="status">
        <h4>{l("사전 연습 · 규칙 기반 안내", "Exploration · rule-based guidance", "事前練習・ルールに基づく案内")}</h4>
        <p>{checked.source === view.supportedBy ? view.supportedBy === "insufficient"
          ? l("이 문장은 현재 가상 기록만으로 뒷받침되지 않는다는 분류가 맞습니다.", "Correct classification: this claim is not supported by the selected synthetic records.", "この主張は現在の仮想記録だけでは裏付けられない、という分類が適切です。")
          : l("선택한 기록은 이 문장을 뒷받침하는 근거입니다.", "The selected record supports this observation claim.", "選んだ記録はこの観察の主張を裏付けます。")
          : l("이 문장을 뒷받침할 수 있는 자료인지 다시 비교해 보세요.", "Recheck whether this record supports the claim.", "この主張を裏付ける資料か、もう一度比較してください。")}</p>
        <p>{claim === "equipment-cause" ? l("두 검사는 가상 검사 결과입니다. 어느 하나가 띠 안이거나 밖이라는 사실만으로 특정 장비 원인을 확정·배제할 수 없습니다.", "These are synthetic inspection results. A record inside or outside its band cannot alone confirm or exclude a particular equipment cause.", "二つは仮想検査結果です。一方が基準帯内・帯外という事実だけでは特定の装置原因を確定・除外できません。") : claim === "film-difference" ? l(
          `막 기록: ${view.film.value.toFixed(1)} · 막 참고 띠: ${view.film.low.toFixed(1)}–${view.film.high.toFixed(1)}. 두 수치를 비교하세요. ${referenceBandPosition(view.film) === "inside" ? "이 시점의 막 기록은 띠 안이므로 ‘벗어났다’는 문장은 뒷받침되지 않습니다." : "이 시점의 막 기록은 띠 밖입니다. 별도 전기적 기록으로 그 차이를 지울 수 없습니다."}`,
          `Compare film ${view.film.value.toFixed(1)} with its band ${view.film.low.toFixed(1)}–${view.film.high.toFixed(1)}. ${referenceBandPosition(view.film) === "inside" ? "It is inside at this time, so the outside-band claim is not supported." : "It is outside at this time. The separate electrical record does not erase that difference."}`,
          `膜記録${view.film.value.toFixed(1)}と膜の基準帯${view.film.low.toFixed(1)}–${view.film.high.toFixed(1)}を比較してください。${referenceBandPosition(view.film) === "inside" ? "この時点では帯内で、「帯外」という主張は裏付けられません。" : "この時点では帯外です。別の電気的記録でこの差は消えません。"}`)
          : l(`전기적 기록: ${view.electrical.value.toFixed(1)} · 자기 참고 띠: ${view.electrical.low.toFixed(1)}–${view.electrical.high.toFixed(1)}. 이 비교는 해당 전기적 기록의 관찰을 뒷받침하지만, 막 상태나 장비 원인을 뒷받침하지는 않습니다.`, `Compare electrical ${view.electrical.value.toFixed(1)} with its own band ${view.electrical.low.toFixed(1)}–${view.electrical.high.toFixed(1)}. This supports an observation about that electrical record, not film condition or equipment cause.`, `電気的記録${view.electrical.value.toFixed(1)}を自身の基準帯${view.electrical.low.toFixed(1)}–${view.electrical.high.toFixed(1)}と比較します。電気的記録の観察を裏付けますが、膜の状態や装置原因は裏付けません。`)}</p>
      </div> : null}
    </div>
    <p className="pe-scope">{l("분류는 관찰 화면 안의 사전 연습입니다. 점수가 아니며 답안·계정 저장·이어하기·AI 입력에 포함되지 않습니다. 안내는 검토한 시점·문장에만 표시됩니다. 분류 도구를 조작하면 재생이 멈추므로 위의 ‘재개’로 관찰을 이어가세요.", "Classification is exploration within this view, not a score, answer, account save, checkpoint or AI input. Guidance only appears for the examined time and claim. Using this tool pauses playback; use Resume above to continue.", "分類はこの観察画面内の事前練習です。点数・回答・保存・再開・AI入力には含まれません。案内は検討した時点・主張にだけ表示します。操作すると再生が止まるため、上の「再開」で観察を続けてください。")}</p>
  </section>;
}

export function MetalWorkspace({ time, observedUntil, language, onTimeChange }: Props & { observedUntil: number; onTimeChange: (time: number) => void }) {
  const l = (ko: string, en: string, ja: string) => tr(language, ko, en, ja);
  const view = metalObservation(time, observedUntil);
  const bandLabel = (band: "below" | "inside" | "above") => band === "inside" ? l("띠 안", "Inside band", "帯内") : band === "above" ? l("띠 위", "Above band", "帯の上") : l("띠 아래", "Below band", "帯の下");
  return <section className="pe-workspace pe-metal">
    <p className="et-eyebrow">RECURRENCE RECORD BOARD</p>
    <h3>{l("한 구간의 복귀와, 이어지는 기록을 구분하기", "Separate one interval's return from what follows", "一区間の復帰と、その後の記録を区別する")}</h3>
    <p>{l(`관측 누적 ${clock(view.until)}까지 · 선택 시점 ${clock(view.selectedTime)} · 6초 단위로 묶은 가상 기록입니다. 실제 검사 주기가 아닙니다.`, `Observed through ${clock(view.until)} · selected ${clock(view.selectedTime)} · synthetic records grouped into six-second replay intervals, not real inspection cycles.`, `観測済み${clock(view.until)}まで・選択時点${clock(view.selectedTime)}・6秒単位にまとめた仮想記録で、実際の検査周期ではありません。`)}</p>
    <p className="pe-key">{l("각 칸은 ‘띠 밖 기록 수 / 관측 기록 수’입니다. 비율은 이 가상 재생 구간의 기록 수이며 실제 불량률·수율이 아닙니다.", "Each cell shows out-of-band records / observed records. These counts describe the synthetic replay, not real defect rates or yield.", "各枠は「基準帯外の記録数 / 観測記録数」です。仮想再生区間の記録数であり、実際の不良率・歩留まりではありません。")}</p>
    <div className="pe-window-grid" role="group" aria-label={l("관측한 구간 선택", "Choose an observed interval", "観測済みの区間を選ぶ")}>
      {view.windows.map(window => <button type="button" key={window.start} aria-pressed={window.start === view.selected.start} onClick={() => onTimeChange(window.end)}>
        <strong>{clock(window.start)}–{clock(window.end)}</strong>
        <span data-outside={window.connectionOutside > 0}>{l("연결", "Connection", "接続")} <b>{window.connectionOutside}/{window.rows.length}</b></span>
        <span data-outside={window.appearanceOutside > 0}>{l("외관", "Appearance", "外観")} <b>{window.appearanceOutside}/{window.rows.length}</b></span>
      </button>)}
    </div>
    <div className="pe-interval-detail">
      <h4>{l(`선택 구간 ${clock(view.selected.start)}–${clock(view.selected.end)}의 세부 가상 기록`, `Synthetic records in selected interval ${clock(view.selected.start)}–${clock(view.selected.end)}`, `選択区間${clock(view.selected.start)}–${clock(view.selected.end)}の仮想記録`)}</h4>
      <div className="et-table" role="region" tabIndex={0} aria-label={l("구간별 연결·외관 수치 비교표", "Connection and appearance records in the interval", "区間の接続・外観数値比較表")}>
        <table><caption>{l("각 수치는 자기 정상 참고와 비교합니다. 다른 검사의 숫자를 서로 빼지 않습니다.", "Compare each value with its own normal reference, not by subtracting different inspections.", "各数値を自身の正常参照と比較し、異なる検査の数値を引き算しません。")}</caption>
          <thead><tr><th scope="col">{l("시점", "Time", "時点")}</th><th scope="col">{l("연결: 이번 / 참고", "Connection: current / reference", "接続：今回 / 参照")}</th><th scope="col">{l("외관: 이번 / 참고", "Appearance: current / reference", "外観：今回 / 参照")}</th></tr></thead>
          <tbody>{view.selected.rows.map(row => <tr key={row.time} aria-current={row.time === view.selectedTime ? "true" : undefined}>
            <th scope="row"><button type="button" aria-label={l(`${clock(row.time)} 기록 보기`, `View record ${clock(row.time)}`, `${clock(row.time)}の記録を見る`)} onClick={() => onTimeChange(row.time)}>{clock(row.time)}</button></th>
            <td>{row.connection.value.toFixed(1)} / {row.connection.reference.toFixed(1)}<small>{bandLabel(row.connectionBand)} · {row.connection.low.toFixed(1)}–{row.connection.high.toFixed(1)}</small></td>
            <td>{row.appearance.value.toFixed(1)} / {row.appearance.reference.toFixed(1)}<small>{bandLabel(row.appearanceBand)} · {row.appearance.low.toFixed(1)}–{row.appearance.high.toFixed(1)}</small></td>
          </tr>)}</tbody>
        </table>
      </div>
    </div>
    <p>{l("띠 안인 구간 하나를 찾았다면 앞뒤 구간도 선택해 보세요. 연결 기록과 외관 기록의 반복 모습이 같은가요? 여기서 보는 것은 가상 기록의 분포이지 장비 원인의 확정이나 해결 여부가 아닙니다.", "If you find one interval inside the band, inspect its neighbours. Do connection and appearance show the same pattern? This is a distribution of synthetic records, not confirmation of an equipment cause or its resolution.", "帯内の区間を一つ見つけたら前後も選んでください。接続と外観の繰り返し方は同じですか？仮想記録の分布であり、装置原因や解決の確認ではありません。")}</p>
    <p className="pe-scope">{l("관측하지 않은 구간은 표시하지 않습니다. 구간·시점 선택은 재생을 멈추고 표시 위치만 옮깁니다. 답안·발견 표시·점수·계정 기록을 바꾸거나 AI에 전송하지 않습니다.", "Unobserved intervals are not shown. Interval/time selection pauses playback and only moves the displayed record; it does not change answers, discovery markers, scores or account records, or send data to AI.", "未観測の区間は表示しません。区間・時点を選ぶと再生を止めて表示位置だけ移動します。回答・発見印・点数・アカウント記録の変更やAIへの送信はありません。")}</p>
  </section>;
}
