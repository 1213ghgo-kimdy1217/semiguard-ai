import { etchSample, type EtchSignal } from "../shared/etchScenario";
import { getProcessScenario, processSample } from "../shared/processScenarios";

// Derive range facts from the full server-owned virtual chart, not the learner's
// selected signal, wording, answer key or a few model-context samples.
export function coachRangeEvidence(scenarioId: string) {
  const scenario = getProcessScenario(scenarioId);
  if (!scenario) throw new Error("Unknown process scenario");
  return {
    scope: "Computed from every one-second synthetic chart record using each record's condition-matched reference range. This is range evidence only, not an exact onset, a fault diagnosis or proof of equipment health. Values may change while remaining in range; a normal reference-stage transition is not an excursion. A final return does not erase an earlier excursion or establish a repaired fault.",
    signals: scenario.signals.map(({ id }) => {
      const inside = Array.from({ length: scenario.duration + 1 }, (_, time) => {
        const sample = scenario.processId === "etch" ? etchSample(id as EtchSignal, time) : processSample(scenario, id, time);
        return sample.value >= sample.low && sample.value <= sample.high;
      });
      return { id, hasReferenceRangeExcursion: inside.some(value => !value), endsWithinReferenceRange: inside.at(-1) === true };
    }),
  };
}

const compact = (text: string) => text.normalize("NFKC").toLowerCase().replace(/[\s\-‑–]/g, "");
// A narrow backstop for known time-of-excursion premises in displayed signal
// names. It is not a general semantic/factuality validator. Conditional and
// whether-questions are not silently rewritten into prewritten coaching.
export function hasUnsupportedRangeQuestion(question: string, language: "ko" | "en" | "ja", scenarioId: string) {
  const scenario = getProcessScenario(scenarioId);
  if (!scenario) throw new Error("Unknown process scenario");
  const index = language === "ko" ? 0 : language === "en" ? 1 : 2;
  const text = compact(question);
  const range = coachRangeEvidence(scenarioId).signals;
  const mentions = scenario.signals.flatMap(signal => {
    const name = compact(signal.name[index]); const result: { start: number; end: number; id: string }[] = [];
    let start = text.indexOf(name);
    while (start !== -1) {
      result.push({ start, end: start + name.length, id: signal.id });
      start = text.indexOf(name, start + name.length);
    }
    return result;
  }).sort((a, b) => a.start - b.start);
  return mentions.some((mention, position) => {
    if (range.find(signal => signal.id === mention.id)?.hasReferenceRangeExcursion !== false) return false;
    // Stop at the next named signal so its genuine excursion is not attributed
    // to this signal. An initial when-question can apply to both named clauses.
    const clause = text.slice(mention.end, mentions[position + 1]?.start ?? text.length);
    const prefix = text.slice(0, mentions[0].start);
    if (language === "ko") return /(?:참고|정상|기준)(?:범위|띠|대역)[^?？.!。]{0,45}(?:벗어난|벗어났던|이탈한|넘은|초과한|돌아온|복귀한)(?:시점|때|순간|시기)/.test(clause)
      || /언제[^?？.!。]{0,30}(?:참고|정상|기준)(?:범위|띠|대역)[^?？.!。]{0,30}(?:벗어났|이탈했|넘었|초과했)/.test(clause);
    if (language === "ja") return /(?:参考|正常|基準)(?:範囲|帯)[^?？.!。]{0,30}(?:外れた|逸脱した|超えた|越えた|戻った|復帰した)(?:時点|時刻|時期|とき|時)/.test(clause)
      || (/いつ/.test(prefix + clause) && /(?:参考|正常|基準)(?:範囲|帯)[^?？.!。]{0,30}(?:外れた|逸脱した|超えた|越えた)/.test(clause));
    return /(?:whendid|whenwas|atwhat(?:point|time)|atwhich(?:point|time))/.test(prefix + clause)
      && /(?:leave|left|cross(?:ed)?|exceed(?:ed)?|wentoutside|movedoutside|return(?:ed)?(?:to)?)[^?!.]{0,30}(?:reference|normal|baseline)(?:range|band|bounds|limits)/.test(clause);
  });
}
