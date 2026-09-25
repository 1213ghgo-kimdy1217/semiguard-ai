import { etchEquipmentSource } from "../../../shared/learningHub";
import { tr, type ProductLanguage } from "../lib/productLanguage";

export default function EtchEquipmentReference({ language = "ko" }: { language?: ProductLanguage }) {
  return <section className="et-panel">
    <p className="et-eyebrow">REAL EQUIPMENT / VIRTUAL SCENARIO</p>
    <h2>{tr(language, "Scenario 01은 어떤 장비를 참고하나요?", "What equipment inspired Scenario 01?", "Scenario 01はどの装置を参考にしていますか？")}</h2>
    <p>{tr(language, "일반적인 플라즈마 식각 장비의 개념을 바탕으로 만든 가상 챔버입니다. 실제 산업 장비 사례로 Lam Research의 도체 식각 장비 Kiyo 제품군을 살펴볼 수 있습니다.", "This is a synthetic chamber based on general plasma etch concepts. Lam Research's Kiyo conductor etch family is one example of industrial equipment.", "一般的なプラズマエッチング装置の概念に基づく仮想チャンバーです。実際の産業用装置の例として、Lam Researchの導体エッチング装置Kiyoシリーズを参照できます。")}</p>
    <p>{tr(language, "이 시나리오는 Kiyo의 복제품이나 디지털 트윈이 아닙니다. 센서 배치·상대지수·변화 시점·정상 기준은 교육용으로 구성했으며 제조사 사양이나 실제 장비 로그가 아닙니다. 제조사의 제휴·검증을 의미하지 않습니다.", "This scenario is neither a Kiyo replica nor a digital twin. Sensor positions, relative indices, change timing, and baselines are designed for teaching, not taken from manufacturer specifications or real equipment logs. No manufacturer affiliation or validation is implied.", "このシナリオはKiyoの複製やデジタルツインではありません。センサー配置、相対指数、変化時点、正常基準は教育用に構成したもので、メーカー仕様や実際の装置ログではありません。メーカーとの提携や検証を意味しません。")}</p>
    <a href={etchEquipmentSource} target="_blank" rel="noopener noreferrer">{tr(language, "Lam Research 공식 장비 소개 ↗ (새 탭)", "Lam Research official product information ↗ (new tab)", "Lam Researchの公式装置紹介 ↗（新しいタブ）")}</a>
  </section>;
}
