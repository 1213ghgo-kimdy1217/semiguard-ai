import type { EtchSignal } from "../../../shared/etchScenario";
import type { ProductLanguage } from "./productLanguage";

const signalCopy: Record<ProductLanguage, Record<EtchSignal, { name: string; location: string }>> = {
  ko: {
    pressure: { name: "챔버 압력", location: "챔버 내부 · 교육용 관측 위치" },
    flow: { name: "가스 유량", location: "공급 계통 · 교육용 관측 위치" },
    rf: { name: "RF 전력", location: "전력 계통 · 교육용 관측 위치" },
    temperature: { name: "온도", location: "챔버 주변 · 웨이퍼 실측 온도 아님" },
  },
  en: {
    pressure: { name: "Chamber pressure", location: "Chamber interior · training observation point" },
    flow: { name: "Gas flow", location: "Supply system · training observation point" },
    rf: { name: "RF power", location: "Power system · training observation point" },
    temperature: { name: "Temperature", location: "Chamber vicinity · not measured wafer temperature" },
  },
  ja: {
    pressure: { name: "チャンバー圧力", location: "チャンバー内部 · 教育用の観測位置" },
    flow: { name: "ガス流量", location: "供給系統 · 教育用の観測位置" },
    rf: { name: "RF電力", location: "電力系統 · 教育用の観測位置" },
    temperature: { name: "温度", location: "チャンバー周辺 · ウェーハの実測温度ではありません" },
  },
};

export function etchSignalName(language: ProductLanguage, signal: EtchSignal) { return signalCopy[language][signal].name; }
export function etchSignalLocation(language: ProductLanguage, signal: EtchSignal) { return signalCopy[language][signal].location; }
