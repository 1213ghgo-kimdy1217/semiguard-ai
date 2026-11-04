import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { CheckCircle2, Download, RotateCcw, Save } from "lucide-react";
import { BOOTH_SIGNALS } from "@shared/boothExperience";
import {
  BOOTH_REFLECTION_FIELD_LIMIT, createBoothReflectionRecord, emptyBoothReflectionFields,
  loadBoothReflections, saveBoothReflection, validateBoothReflection,
  type BoothAttempt, type BoothReflectionFields, type BoothReflectionRecord,
} from "@shared/boothReflection";
import { tr, type ProductLanguage } from "../lib/productLanguage";
import "./booth-reflection.css";

type Field = keyof BoothReflectionFields;
export type BoothReflectionProps = {
  attempt: BoothAttempt | null;
  language: ProductLanguage;
  onRetry?: () => void;
  registerLeaveGuard?: (guard: (() => boolean) | null) => void;
};
const FIELD_KEYS: Field[] = ["observation", "reasoning", "debrief"];
const clock = (ms: number) => Math.floor(ms / 60_000).toString().padStart(2, "0") + ":" + Math.floor(ms % 60_000 / 1000).toString().padStart(2, "0");
function browserStorage(): Storage | null {
  try { return typeof window === "undefined" ? null : window.localStorage; } catch { return null; }
}

/** This form receives a finished run, never a changing live-engine snapshot. */
export default function BoothReflection({ attempt, language, onRetry, registerLeaveGuard }: BoothReflectionProps) {
  const l = (ko: string, en: string, ja: string) => tr(language, ko, en, ja);
  const heading = useId();
  const [fields, setFields] = useState<BoothReflectionFields>(emptyBoothReflectionFields);
  const [hydratedId, setHydratedId] = useState<string | null>(null);
  const [saved, setSaved] = useState<"checking" | "draft" | "submitted" | "unavailable">("checking");
  const [invalid, setInvalid] = useState<Field[]>([]);
  const [storageMessage, setStorageMessage] = useState("");
  const [exportRequested, setExportRequested] = useState(false);
  const fieldsRef = useRef(fields);
  const attemptRef = useRef(attempt);
  const recordRef = useRef<BoothReflectionRecord | null>(null);
  const backupConfirmed = useRef(false);
  attemptRef.current = attempt;

  function persist(status: "draft" | "submitted"): boolean {
    const current = attemptRef.current;
    if (!current) return true;
    const record = createBoothReflectionRecord(current, fieldsRef.current, status);
    recordRef.current = record;
    const storage = browserStorage();
    const result = storage ? saveBoothReflection(storage, record) : { ok: false as const, issue: "unavailable" as const };
    if (result.ok) {
      recordRef.current = result.record;
      setSaved(status); setStorageMessage("");
      return true;
    }
    setSaved("unavailable");
    setStorageMessage(l("브라우저에 저장하지 못했어요. 작성 내용은 화면에 남아 있어요. 기록 파일로 보관해주세요.", "Browser storage failed. Your writing remains on this screen; download a record file.", "ブラウザーに保存できませんでした。入力は画面に残っています。記録ファイルを保存してください。"));
    return false;
  }
  function canLeave(): boolean {
    if (backupConfirmed.current) return true;
    return persist(recordRef.current?.status === "submitted" ? "submitted" : "draft");
  }

  useEffect(() => {
    backupConfirmed.current = false; setExportRequested(false); setInvalid([]);
    if (!attempt) { recordRef.current = null; setHydratedId(null); return; }
    const storage = browserStorage();
    const result = storage ? loadBoothReflections(storage) : { records: [], issue: "unavailable" as const };
    const previous = result.records.find(item => item.attempt.id === attempt.id);
    const next = previous ? { ...previous.fields } : emptyBoothReflectionFields();
    fieldsRef.current = next; setFields(next); setHydratedId(attempt.id);
    recordRef.current = previous ?? createBoothReflectionRecord(attempt, next, "draft");
    if (previous && !result.issue) { setSaved(previous.status); setStorageMessage(""); }
    else persist("draft");
  }, [attempt?.id]);
  useEffect(() => {
    if (!registerLeaveGuard) return;
    registerLeaveGuard(attempt ? canLeave : null);
    return () => registerLeaveGuard(null);
  }, [attempt?.id, registerLeaveGuard, language]);

  if (!attempt) return null;
  const ready = hydratedId === attempt.id;
  const shown = ready ? fields : emptyBoothReflectionFields();
  const shownSaved = ready ? saved : "checking";
  const labels: Record<Field, [string, string, string]> = {
    observation: ["관찰한 변화", "Observed changes", "観察した変化"],
    reasoning: ["조치와 판단 이유", "Actions and reasoning", "操作と判断理由"],
    debrief: ["복기 · 다음 확인", "Review and next checks", "振り返り・次の確認"],
  };
  const prompts: Record<Field, [string, string, string]> = {
    observation: ["어떤 값이 먼저, 어느 방향으로 변했나요? 정상 기준과 비교해 적어보세요.", "What changed first, and in which direction? Compare it with the normal reference.", "どの値が先に、どちらへ変化しましたか。正常基準と比べて書いてください。"],
    reasoning: ["무엇을 조절했고, 어떤 변화가 판단의 근거가 되었나요?", "What did you adjust, and which observations informed your decision?", "何を調整し、どの変化を判断の根拠にしましたか。"],
    debrief: ["조치 후 무엇이 달라졌나요? 다시 한다면 무엇을 먼저 확인할 건가요?", "What changed after your actions? What would you check first next time?", "操作後に何が変わりましたか。次は何から確認しますか。"],
  };
  const outcome = attempt.outcome === "won" ? l("복구 성공", "Recovered", "復旧成功")
    : attempt.outcome === "failed" ? l("시간 종료", "Time expired", "時間終了")
      : attempt.outcome === "cancelled" ? l("체험 중단", "Cancelled", "体験中断") : l("자유 체험 종료", "Free play ended", "自由体験終了");
  function change(key: Field, value: string) {
    if (!ready) return;
    const next = { ...fieldsRef.current, [key]: value.slice(0, BOOTH_REFLECTION_FIELD_LIMIT) };
    fieldsRef.current = next; setFields(next); setInvalid(previous => previous.filter(item => item !== key));
    backupConfirmed.current = false; setExportRequested(false);
    // Synchronous persistence keeps the final keystroke when the parent starts another run.
    persist("draft");
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    const errors = validateBoothReflection(fieldsRef.current);
    setInvalid(errors);
    if (errors.length) { document.getElementById(heading + "-" + errors[0])?.focus(); return; }
    persist("submitted");
  }
  function download() {
    const current = attemptRef.current;
    if (!current) return;
    const record = recordRef.current ?? createBoothReflectionRecord(current, fieldsRef.current, "draft");
    const blob = new Blob([JSON.stringify({ kind: "semiguard-booth-reflection", ...record }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = "semiguard-observation-review.json";
    document.body.appendChild(anchor); anchor.click(); anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setExportRequested(true);
  }
  const retry = () => { if (canLeave()) onRetry?.(); };

  return <section id="booth-reflection" className="br-reflection" aria-labelledby={heading} tabIndex={-1} data-attempt-id={attempt.id}>
    <header className="br-heading"><div><p>{l("체험 후 기록", "Post-experience record", "体験後の記録")}</p><h2 id={heading}>{l("관찰과 복기", "Observation and review", "観察と振り返り")}</h2></div><span className={"br-outcome " + (attempt.outcome === "won" ? "is-won" : "")}>{outcome}</span></header>
    <div className="br-run-summary"><strong>{attempt.scenarioTitle}</strong><span>{l("체험 시간", "Duration", "体験時間")} {clock(attempt.durationMs)}</span>{attempt.score !== null && <span>{l("체험 점수", "Experience score", "体験得点")} {attempt.score}</span>}</div>
    <p className="br-intro">{l("방금 체험한 기록을 보며 짧게 정리해보세요. 아래 자료는 종료 시점에 고정된 기록입니다.", "Write a short review using the run you just completed. The evidence below is fixed at the end of that run.", "終了した体験の記録を見ながら短く振り返りましょう。下の資料は終了時点に固定されています。")}</p>
    <details className="br-evidence"><summary>{l("종료 시 수치 · 조작 기록 보기", "View final values and actions", "終了時の数値・操作記録を見る")}</summary><div className="br-evidence-body"><dl>{BOOTH_SIGNALS.map(signal => <div key={signal.key}><dt>{signal.number} · {signal.label}</dt><dd>{attempt.values[signal.key].toFixed(signal.key === "rfPower" ? 0 : 1)} <small>{signal.unit}</small></dd></div>)}</dl>{attempt.events.length ? <ol>{attempt.events.slice(-12).map(item => <li key={item.id}><time>{clock(item.atMs)}</time><span>{item.message}</span></li>)}</ol> : <p>{l("이 체험에는 조작 기록이 없어요.", "No actions were recorded in this run.", "この体験には操作記録がありません。")}</p>}</div></details>
    <form onSubmit={submit} noValidate>
      <div className="br-fields">{FIELD_KEYS.map((key, index) => <div key={key} className="br-field"><label htmlFor={heading + "-" + key}><span>{index + 1}</span>{l(...labels[key])}</label><p id={heading + "-" + key + "-hint"}>{l(...prompts[key])}</p><textarea id={heading + "-" + key} name={key} value={shown[key]} disabled={!ready} required minLength={3} maxLength={BOOTH_REFLECTION_FIELD_LIMIT} rows={5} onChange={event => change(key, event.target.value)} aria-invalid={invalid.includes(key)} aria-describedby={heading + "-" + key + "-hint"} />{invalid.includes(key) && <p className="br-field-error">{l("내용을 3자 이상 짧게 적어주세요.", "Write at least three meaningful characters.", "内容を3文字以上で書いてください。")}</p>}</div>)}</div>
      {invalid.length > 0 && <p className="br-error" role="alert">{l("표시된 칸을 채운 뒤 제출해주세요.", "Complete the indicated fields before submitting.", "表示された欄を記入して提出してください。")}</p>}
      <div className="br-form-footer"><p className={"br-save-status " + (shownSaved === "unavailable" ? "is-error" : "")} role="status">{shownSaved === "submitted" ? <><CheckCircle2 size={16} aria-hidden="true" />{l("복기 기록을 이 브라우저에 저장했어요.", "Review saved in this browser.", "振り返りをこのブラウザーに保存しました。")}</> : shownSaved === "draft" ? l("작성 중 내용이 이 브라우저에 임시 저장됐어요.", "Draft saved in this browser.", "入力内容をこのブラウザーに下書き保存しました。") : shownSaved === "unavailable" ? l("브라우저 저장 불가 · 기록 파일을 내려받아 보관하세요.", "Browser storage unavailable · download your record.", "ブラウザーに保存不可・記録ファイルを保存してください。") : l("기록을 준비하고 있어요.", "Preparing the record.", "記録を準備しています。")}</p><button type="submit" className="br-primary" disabled={!ready}><Save size={16} aria-hidden="true" />{shownSaved === "submitted" ? l("복기 다시 제출", "Resubmit review", "振り返りを再提出") : l("복기 제출", "Submit review", "振り返りを提出")}</button></div>
    </form>
    {ready && storageMessage && <p className="br-error" role="alert">{storageMessage}</p>}
    <div className="br-bottom-actions"><button type="button" onClick={download} disabled={!ready}><Download size={15} aria-hidden="true" />{l("기록 파일 내려받기", "Download record", "記録ファイルを保存")}</button>{onRetry && <button type="button" onClick={retry} disabled={!ready}><RotateCcw size={15} aria-hidden="true" />{l("다른 체험 시작", "Start another experience", "別の体験を開始")}</button>}{shownSaved === "unavailable" && exportRequested && onRetry && <button type="button" onClick={() => { backupConfirmed.current = true; onRetry(); }}>{l("파일을 확인했어요 · 새 체험", "File checked · new experience", "ファイルを確認・新しい体験")}</button>}</div>
    <p className="br-storage-note">{l("이 기록은 현재 브라우저에 최근 10개까지 보관됩니다. 다른 PC에서도 필요하면 파일로 내려받아주세요.", "This browser keeps up to ten recent records. Download a file to use it on another PC.", "最近10件を現在のブラウザーに保存します。別のPCで使う場合はファイルを保存してください。")}</p>
  </section>;
}
