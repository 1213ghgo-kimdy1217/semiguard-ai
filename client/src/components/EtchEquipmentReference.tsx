import { etchEquipmentSource } from "../../../shared/learningHub";

export default function EtchEquipmentReference() {
  return <section className="et-panel">
    <p className="et-eyebrow">REAL EQUIPMENT / VIRTUAL SCENARIO</p>
    <h2>Scenario 01은 어떤 장비를 참고하나요?</h2>
    <p>일반적인 플라즈마 식각 장비의 개념을 바탕으로 만든 가상 챔버입니다. 실제 산업 장비 사례로 Lam Research의 도체 식각 장비 Kiyo 제품군을 살펴볼 수 있습니다.</p>
    <p>이 시나리오는 Kiyo의 복제품이나 디지털 트윈이 아닙니다. 센서 배치·상대지수·변화 시점·정상 기준은 교육용으로 구성했으며 제조사 사양이나 실제 장비 로그가 아닙니다. 제조사의 제휴·검증을 의미하지 않습니다.</p>
    <a href={etchEquipmentSource} target="_blank" rel="noopener noreferrer">Lam Research 공식 장비 소개 ↗ (새 탭)</a>
  </section>;
}
