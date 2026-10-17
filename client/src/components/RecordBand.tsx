import React, { useId } from "react";
import { tr, type ProductLanguage } from "../lib/productLanguage";
import "./process-studio.css";

type Sample = { time: number; value: number; reference: number; low: number; high: number };
/** A supplied record, never a reconstruction of physical geometry. */
export default function RecordBand({ sample, title, language }: { sample: Sample; title: string; language: ProductLanguage }) {
  const id = useId();
  const l = (ko: string, en: string, ja: string) => tr(language, ko, en, ja);
  const inside = sample.value >= sample.low && sample.value <= sample.high;
  const state = inside ? l("참고 띠 안", "Inside reference band", "基準帯内") : sample.value < sample.low ? l("참고 띠 아래", "Below reference band", "基準帯より下") : l("참고 띠 위", "Above reference band", "基準帯より上");
  // Fixed teaching-index scale keeps two records visually comparable.
  const min = 80;
  const max = 120;
  const x = (value: number) => 20 + (value - min) / (max - min) * 240;
  return <figure className="sr-record" data-time={sample.time} data-value={sample.value} data-reference={sample.reference} data-low={sample.low} data-high={sample.high}>
    <figcaption><strong>{title}</strong><span>{sample.time}s · {state}</span></figcaption>
    <svg viewBox="0 0 280 100" role="img" aria-labelledby={id}>
      <title id={id}>{`${title}: ${sample.time}s; ${sample.value.toFixed(1)} / ${sample.reference.toFixed(1)}; ${sample.low.toFixed(1)}–${sample.high.toFixed(1)}; ${state}`}</title>
      <path d="M20 48H260" stroke="#6d8879" />
      <rect x={x(sample.low)} y={27} width={x(sample.high) - x(sample.low)} height={42} rx={5} fill="#315d50" stroke="#98c3b0" />
      <path d={`M${x(sample.reference)} 15V78`} stroke="#e8efe7" strokeDasharray="4 3" strokeWidth={2} />
      <circle cx={x(sample.value)} cy={48} r={8} fill={inside ? "#9bd9c3" : "#efb96b"} stroke="#14231c" strokeWidth={2} />
      <text x={20} y={94}>{min.toFixed(1)}</text><text x={260} y={94} textAnchor="end">{max.toFixed(1)}</text>
    </svg>
    <p className="sr-record-key">{l("● 이번 기록　┆ 정상 참고　▰ 참고 띠", "● Current　┆ Normal reference　▰ Reference band", "● 今回　┆ 正常参照　▰ 基準帯")}</p>
    <p className="sr-reading"><b>{sample.value.toFixed(1)}</b><span>{l("정상 참고", "Normal reference", "正常参照")} {sample.reference.toFixed(1)}</span></p>
  </figure>;
}
