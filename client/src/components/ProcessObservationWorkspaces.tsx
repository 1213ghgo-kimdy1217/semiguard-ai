import React, { useId } from "react";
import { oxidationComparison, photoObservation, type OxidationReference, type PhotoSignal } from "../../../shared/processObservation";
import { tr, type ProductLanguage } from "../lib/productLanguage";
import "./process-observation-workspaces.css";

const clock = (time: number) => `${Math.floor(time / 60).toString().padStart(2, "0")}:${(time % 60).toString().padStart(2, "0")}`;
const signed = (value: number) => `${value > 0 ? "+" : ""}${value.toFixed(1)}`;
type CommonProps = { time: number; language: ProductLanguage };

export function ProcessObservationBrief({ processId, language }: { processId: "oxidation" | "photo"; language: ProductLanguage }) {
  const l = (ko: string, en: string, ja: string) => tr(language, ko, en, ja);
  const oxidation = processId === "oxidation";
  return <section className="et-panel po-intro">
    <p className="et-eyebrow">{oxidation ? "MATCH THE REFERENCE" : "COMPARE PATTERN RECORDS"}</p>
    <h2>{oxidation ? l("기준을 바꿔 비교하면, 판단도 달라질까요?", "Can a different reference change your judgment?", "比較基準を変えると判断も変わりますか？") : l("마지막 한 장만 보면 무엇을 놓칠까요?", "What might the last frame miss?", "最後の一枚だけでは何を見逃しますか？")}</h2>
    <ol>{oxidation ? <>
      <li>{l("선택한 기록이 어느 검사 묶음인지 먼저 확인합니다.", "First identify the inspection group of the selected record.", "まず選択記録の検査グループを確認します。")}</li>
      <li>{l("같은 묶음의 기준과 비교하고, 다른 묶음의 기준을 적용했을 때 생기는 차이도 살펴봅니다.", "Compare with the matching group's reference, then explore what happens with another group's reference.", "同じグループの基準と比較し、別グループの基準を使った場合の差も確認します。")}</li>
    </> : <>
      <li>{l("정상 참고와 이번 패턴을 겹쳐 봅니다. 위치와 형상은 따로 선택해 확인합니다.", "Overlay the normal reference and current pattern; examine position and shape separately.", "正常参照と今回のパターンを重ね、位置と形状を別々に確認します。")}</li>
      <li>{l("관측한 시점을 한 장 고정한 뒤, 재생을 이어 전후 기록이 어떻게 달라지는지 비교합니다.", "Pin an observed frame, resume playback, then compare earlier and later records.", "観測済みの一枚を固定して再生を続け、前後の記録を比較します。")}</li>
    </>}</ol>
    <p className="et-caption">{l("이 화면은 가상 검사 기록을 읽기 위한 도식입니다. 실제 측정 영상·장비 출력·공정 조건을 재현하지 않습니다.", "These diagrams help read synthetic inspection records. They do not reproduce measurement images, equipment output or process conditions.", "仮想検査記録を読むための模式図です。実測画像・装置出力・工程条件を再現しません。")}</p>
  </section>;
}

export function OxidationWorkspace({ time, language, reference, onReferenceChange }: CommonProps & {
  reference: OxidationReference; onReferenceChange: (reference: OxidationReference) => void;
}) {
  const l = (ko: string, en: string, ja: string) => tr(language, ko, en, ja);
  const view = oxidationComparison(time, reference);
  return <section className="po-workspace po-oxidation">
    <p className="et-eyebrow">INSPECTION GROUP WORKBENCH</p>
    <h3>{l("이전 숫자가 아니라, 맞는 기준과 비교하기", "Compare with a matching reference, not just an earlier number", "以前の数値ではなく対応する基準と比較する")}</h3>
    <p className="po-current">{l(`선택 기록 ${clock(view.time)} · 검사 묶음 ${view.group}`, `Selected record ${clock(view.time)} · inspection group ${view.group}`, `選択記録 ${clock(view.time)}・検査グループ ${view.group}`)}</p>
    <div className="po-reference-picker" role="group" aria-label={l("비교에 적용할 참고 기준", "Reference to compare against", "比較に用いる参考基準")}>
      <button type="button" aria-pressed={view.reference === "matching"} onClick={() => onReferenceChange("matching")}>
        <strong>{l(`현재 묶음 ${view.group}의 정상 참고`, `Normal reference for current group ${view.group}`, `現在のグループ${view.group}の正常参照`)}</strong>
        <span>{l("같은 검사 조건", "Matching inspection conditions", "同じ検査条件")}</span>
      </button>
      <button type="button" disabled={!view.otherGroupAvailable} aria-pressed={view.reference === "group-a"} onClick={() => onReferenceChange("group-a")}>
        <strong>{l("앞서 관측한 묶음 A의 정상 참고", "Previously observed group A reference", "観測済みのグループAの正常参照")}</strong>
        <span>{view.otherGroupAvailable ? l("00:29 기준 · 다른 검사 조건", "Reference at 00:29 · different inspection conditions", "00:29の基準・別の検査条件") : l("다른 묶음이 관측된 뒤 비교 가능", "Available after another group has been observed", "別のグループを観測した後に比較可能")}</span>
      </button>
    </div>
    {view.reference === "group-a" ? <p className="po-warning" role="status">{l("다른 묶음의 기준을 적용 중입니다. 이 차이만으로 현재 묶음이 비정상이라고 판단하지 마세요.", "You are applying another group's reference. This difference alone does not establish that the current group is abnormal.", "別グループの基準を使用中です。この差だけでは現在のグループが異常とは判断できません。")}</p> : null}
    <div className="po-records">{view.records.map(({ signal, sample, compared, difference }) => <article key={signal.id}>
      <h4>{l(...signal.name)}</h4>
      <div className="po-reading"><strong>{sample.value.toFixed(1)}</strong><span>{l("이번 기록", "Current record", "今回の記録")}</span></div>
      <div className="po-gauge" aria-hidden="true">
        <i className="po-band" style={{ left: `${compared.low / 1.2}%`, width: `${(compared.high - compared.low) / 1.2}%` }} />
        <i className="po-reference-tick" style={{ left: `${compared.reference / 1.2}%` }} />
        <i className="po-current-tick" style={{ left: `${sample.value / 1.2}%` }} />
      </div>
      <dl>
        <div><dt>{l(`묶음 ${view.referenceGroup} 정상 참고`, `Group ${view.referenceGroup} normal reference`, `グループ${view.referenceGroup}正常参照`)}</dt><dd>{compared.reference.toFixed(1)}</dd></div>
        <div><dt>{l("선택 기준과의 차이", "Difference from selected reference", "選択基準との差")}</dt><dd>{signed(difference)}</dd></div>
        <div><dt>{l("선택 기준의 참고 띠", "Selected reference band", "選択基準の範囲")}</dt><dd>{compared.low.toFixed(1)}–{compared.high.toFixed(1)}</dd></div>
      </dl>
    </article>)}</div>
    <p className="po-key">{l("● 이번 기록　┊ 선택한 정상 참고　▰ 해당 참고 띠 · 모두 교육용 상대지수", "● Current record　┊ Selected normal reference　▰ Its reference band · teaching-only relative indices", "● 今回の記録　┊ 選択した正常参照　▰ その基準帯・すべて教育用相対指数")}</p>
    <p className="po-scope">{l("기준 선택은 관찰용입니다. 답안·점수·계정 저장·AI 입력을 바꾸지 않습니다. 제출에는 직접 선택한 비교 기준이 사용됩니다.", "This reference selection is a viewing tool. It does not change answers, scores, account saves or AI input. Submission uses the comparison reference you explicitly answer.", "基準選択は観察用です。回答・点数・アカウント保存・AI入力は変わりません。提出には回答欄で選んだ比較基準を使用します。")}</p>
  </section>;
}

type PhotoFrame = ReturnType<typeof photoObservation>["current"];
function PatternFrame({ frame, signal, overlay, title, language }: { frame: PhotoFrame; signal: PhotoSignal; overlay: boolean; title: string; language: ProductLanguage }) {
  const l = (ko: string, en: string, ja: string) => tr(language, ko, en, ja);
  const id = useId();
  const offset = signal === "position" ? frame.displayOffset : 0;
  const width = signal === "shape" ? 18 + frame.displayOffset / 4 : 18;
  return <figure className="po-pattern-frame">
    <figcaption>{title}<time>{clock(frame.time)}</time></figcaption>
    <svg viewBox="0 0 220 160" role="img" aria-labelledby={id}>
      <title id={id}>{l(`도식 비교. 이번 ${frame.value.toFixed(1)}, 정상 참고 ${frame.reference.toFixed(1)}, 차이 ${signed(frame.difference)}.`, `Schematic comparison. Current ${frame.value.toFixed(1)}, normal reference ${frame.reference.toFixed(1)}, difference ${signed(frame.difference)}.`, `模式図の比較。今回${frame.value.toFixed(1)}、正常参照${frame.reference.toFixed(1)}、差${signed(frame.difference)}。`)}</title>
      <path className="po-grid" d="M20 40H200M20 80H200M20 120H200M40 20V140M80 20V140M120 20V140M160 20V140M200 20V140" />
      {[48, 92, 136].map(x => <g key={x}>
        <rect className="po-pattern-current" x={x + offset - (width - 18) / 2} y={36} width={width} height={88} rx={2} />
        {overlay ? <rect className="po-pattern-reference" x={x} y={36} width={18} height={88} rx={2} /> : null}
      </g>)}
    </svg>
    <dl><div><dt>{l("이번 / 정상 참고", "Current / normal reference", "今回 / 正常参照")}</dt><dd>{frame.value.toFixed(1)} / {frame.reference.toFixed(1)}</dd></div>
      <div><dt>{l("차이 / 참고 띠", "Difference / reference band", "差 / 基準帯")}</dt><dd>{signed(frame.difference)} / {frame.low.toFixed(1)}–{frame.high.toFixed(1)}</dd></div></dl>
  </figure>;
}

export function PhotoWorkspace({ time, language, signal, pinnedTime, overlay, onPinChange, onOverlayChange }: CommonProps & {
  signal: PhotoSignal; pinnedTime: number; overlay: boolean; onPinChange: (time: number) => void; onOverlayChange: (overlay: boolean) => void;
}) {
  const l = (ko: string, en: string, ja: string) => tr(language, ko, en, ja);
  const view = photoObservation(time, pinnedTime, signal);
  const pinId = useId();
  return <section className="po-workspace po-photo">
    <p className="et-eyebrow">PATTERN COMPARISON DESK</p>
    <h3>{l("한 장을 고정하고, 앞뒤를 비교하기", "Compare frames, not just the last one", "一枚を固定して前後を比べる")}</h3>
    <p>{signal === "position" ? l("위치 보기 · 실선 패턴과 점선 참고의 가로 위치를 비교하세요.", "Position view · compare the horizontal locations of the solid pattern and dashed reference.", "位置表示・実線パターンと破線参照の横位置を比較してください。") : l("형상 보기 · 위치 이동과 섞지 않고, 실선과 점선의 폭을 비교하세요.", "Shape view · compare solid and dashed widths separately from position shift.", "形状表示・位置移動と混同せず、実線と破線の幅を比較してください。")}</p>
    <div className="po-photo-controls">
      <label htmlFor={pinId}>{l("고정할 관측 시점 (초)", "Observed time to pin (seconds)", "固定する観測時点（秒）")}
        <input id={pinId} type="number" min={0} max={view.current.time} step={1} value={view.pinned.time} onChange={event => { const value = Number(event.target.value); if (Number.isInteger(value) && value >= 0 && value <= view.current.time) onPinChange(value); }} />
      </label>
      <button type="button" onClick={() => onPinChange(view.current.time)}>{l(`현재 ${clock(view.current.time)}를 비교용으로 고정`, `Pin current ${clock(view.current.time)} for comparison`, `現在の${clock(view.current.time)}を比較用に固定`)}</button>
      <label className="po-overlay"><input type="checkbox" checked={overlay} onChange={event => onOverlayChange(event.target.checked)} />{l("정상 참고 겹쳐 보기", "Overlay the normal reference", "正常参照を重ねて表示")}</label>
    </div>
    <div className="po-frames">
      <PatternFrame frame={view.pinned} signal={signal} overlay={overlay} title={l("고정한 비교 기록", "Pinned comparison record", "固定した比較記録")} language={language} />
      <PatternFrame frame={view.current} signal={signal} overlay={overlay} title={l("현재 선택 기록", "Currently selected record", "現在の選択記録")} language={language} />
    </div>
    <p className="po-key">{l("실선·채움: 이번 기록　점선: 같은 위치의 정상 참고", "Solid fill: current record　Dashed: same-location normal reference", "実線・塗り：今回の記録　破線：同じ位置の正常参照")}</p>
    <p>{l("차이가 보이는 기록을 고정한 뒤 재생을 이어 보세요. 위치·형상 중 어느 기록이 언제 달라졌는지, 앞선 기록과 마지막 기록이 같은지 근거를 모아 보세요.", "Pin a record where you notice a difference, then resume. Gather evidence of which record changed and when, and whether earlier and final records agree.", "差に気付いた記録を固定して再生を続けてください。位置・形状のどちらがいつ変化し、前と最後の記録が同じか、根拠を集めましょう。")}</p>
    <details><summary>{l("도식의 의미와 한계", "What the diagram means and its limits", "模式図の意味と限界")}</summary>
      <p>{l("패턴은 가상 지수의 차이를 눈으로 비교하도록 그린 기호입니다. 위치 보기는 차이×2를 가로 이동으로, 형상 보기는 그 값의 1/4을 폭 변화로 표현하며 표시량은 제한됩니다. 실제 nm·감광막 형상·칩 배치가 아니며 수치는 아래 기록표가 기준입니다. 기록이 돌아와 보여도 실제 원인 해결을 뜻하지 않습니다.", "The pattern is a symbol for comparing synthetic index differences. Position encodes difference ×2 as horizontal shift; shape encodes a quarter of that as width change, with capped display offsets. It is not nanometres, resist geometry or die layout; the numeric records are authoritative. A returning record does not establish that a real cause was resolved.", "パターンは仮想指数の差を比較する記号です。位置は差×2を横移動、形状はその1/4を幅変化として表示し、表示量には上限があります。実際のnm・感光膜形状・チップ配置ではなく、数値記録が基準です。記録が戻っても実際の原因解決を意味しません。")}</p>
    </details>
    <p className="po-scope">{l("고정 시점·겹쳐보기는 관찰용입니다. 답안·점수·계정 저장·AI 입력에는 포함되지 않습니다. 관측 전의 기록은 표시하지 않습니다.", "Pinned frames and overlays are viewing tools only. They are not included in answers, scores, account saves or AI input. Unobserved records are not displayed.", "固定時点・重ね表示は観察用です。回答・点数・保存・AI入力には含まれません。未観測の記録は表示しません。")}</p>
  </section>;
}
