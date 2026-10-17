import React, { useId, useState } from "react";
import { tr, type ProductLanguage } from "../lib/productLanguage";
import "./deposition-implantation-concept.css";

/** Authored process explanation only. Never encodes sampled thickness, depth or defects. */
export default function DepositionImplantationConcept({ language }: { language: ProductLanguage }) {
  const l = (ko: string, en: string, ja: string) => tr(language, ko, en, ja);
  const [mode, setMode] = useState<"film" | "implant">("film");
  const id = useId();
  const film = mode === "film";
  const title = film ? l("증착 · 표면에 막 형성", "Deposition · form a surface film", "成膜・表面に膜を形成") : l("이온 주입 · 기판 내부에 이온 주입", "Implantation · introduce ions into the substrate", "イオン注入・基板内部へイオンを導入");
  return <section className="di-concept" aria-labelledby={id}>
    <h3 id={id}>{l("막을 쌓는 것과, 내부에 주입하는 것은 다릅니다.", "Adding a film differs from introducing ions.", "膜の形成と内部への注入は異なります。")}</h3>
    <div className="di-controls" role="group" aria-label={l("공정 개념 선택", "Choose process concept", "工程概念を選択")}>
      <button type="button" aria-pressed={film} onClick={() => setMode("film")}>{l("증착 보기", "View deposition", "成膜を見る")}</button>
      <button type="button" aria-pressed={!film} onClick={() => setMode("implant")}>{l("이온 주입 보기", "View implantation", "イオン注入を見る")}</button>
    </div>
    <div className="di-layout"><figure>
      <svg viewBox="0 0 440 265" role="img" aria-label={title}>
        <rect x="40" y="157" width="360" height="85" rx="6" fill="#355768" stroke="#a5d5dc" strokeWidth="2" />
        <text x="183" y="225" fill="#fff" fontSize="16">{l("기판", "Substrate", "基板")}</text>
        {film ? <g>
          <rect x="40" y="133" width="360" height="24" fill="#e8c985" stroke="#fff0ca" />
          {[90, 155, 220, 285, 350].map(x => <g key={x}><circle cx={x} cy="55" r="7" fill="#e8c985" /><path d={`M${x} 73V112l-6 -8m6 8l6 -8`} fill="none" stroke="#e8c985" strokeWidth="2" /></g>)}
          <text x="178" y="35" fill="#e8c985" fontSize="15">{l("막 형성", "Film formation", "膜の形成")}</text>
        </g> : <g>
          {[90, 155, 220, 285, 350].map((x, index) => <g key={x}>
            <path d={`M${x} 50V${172 + index % 2 * 20}l-6 -8m6 8l6 -8`} fill="none" stroke="#a7d9cd" strokeWidth="2" />
            <circle cx={x} cy={184 + index % 2 * 20} r="6" fill="#a7d9cd" />
          </g>)}
          <text x="174" y="35" fill="#a7d9cd" fontSize="15">{l("이온 빔", "Ion beam", "イオンビーム")}</text>
        </g>}
      </svg>
      <figcaption>{l("설명용 단면 · 길이·두께·깊이·입자 수는 측정값이 아닙니다.", "Conceptual cross-section; lengths, thickness, depth and particle counts are not measurements.", "説明用断面。長さ・膜厚・深さ・粒子数は測定値ではありません。")}</figcaption>
    </figure><div aria-live="polite">
      <h4>{title}</h4>
      <p>{film ? l("기판 표면에 재료의 막을 형성하는 개념입니다. 그림의 막 두께는 현재 검사 지수에 따라 변하지 않습니다.", "This illustrates forming a material film on the substrate surface. Drawn thickness does not change with the inspection index.", "基板表面に材料の膜を形成する概念です。図の膜厚は検査指数によって変化しません。") : l("이온을 기판 내부에 도입하는 개념입니다. 점의 수와 위치는 주입량·깊이 분포나 전기적 특성의 측정 결과가 아닙니다.", "This illustrates introducing ions into the substrate. Dot counts and positions are not dose, depth profiles or measured electrical characteristics.", "基板内部にイオンを導入する概念です。点の数や位置は注入量・深さ分布・電気特性の測定結果ではありません。")}</p>
      <p className="di-evidence">{film ? l("연습에서 연결할 근거: 막 검사 기록을 자신의 정상 참고와 비교합니다.", "Exercise evidence: compare the film inspection record with its own normal reference.", "練習の根拠：膜検査記録を自身の正常参照と比較します。") : l("연습에서 연결할 근거: 별도 전기적 검사 기록을 자신의 정상 참고와 비교합니다. 막 검사를 대신하지 않습니다.", "Exercise evidence: compare the separate electrical record with its own reference; it does not replace film inspection.", "練習の根拠：別の電気的記録を自身の正常参照と比較します。膜検査の代わりにはなりません。")}</p>
    </div></div>
    <p className="di-limit">{l("두 자료는 별도 목적의 가상 검사 예시이며 같은 웨이퍼의 연속 결과를 뜻하지 않습니다. 그림 선택은 답안·채점·계정 저장·이어하기·공유·AI 입력을 바꾸지 않습니다. 실제 장비·레시피·고장 원인을 재현하지 않습니다.", "The two records are separate-purpose synthetic examples, not consecutive results from the same wafer. Diagram selection changes no answer, score, account save, checkpoint, sharing or AI input. It does not reproduce equipment, recipes or fault causes.", "二つは異なる目的の仮想検査例で、同じウェーハの連続結果ではありません。図の選択は回答・採点・保存・再開・共有・AI入力を変更しません。実装置・レシピ・故障原因を再現しません。")}</p>
  </section>;
}
