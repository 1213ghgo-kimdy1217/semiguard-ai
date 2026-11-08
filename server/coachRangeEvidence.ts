import { etchSample, type EtchSignal } from "../shared/etchScenario";
import { getProcessScenario, processSample } from "../shared/processScenarios";

// Derive range facts from the full server-owned virtual chart, not the learner's
// selected signal, wording, answer key or a few model-context samples.
export function coachRangeEvidence(scenarioId: string) {
  const scenario = getProcessScenario(scenarioId);
  if (!scenario) throw new Error("Unknown process scenario");
  const tracks = scenario.signals.map(({ id }) => {
    let runs = 0;
    let outside = false;
    let above = false;
    let below = false;
    for (let time = 0; time <= scenario.duration; time++) {
      const sample = scenario.processId === "etch" ? etchSample(id as EtchSignal, time) : processSample(scenario, id, time);
      const aboveNow = sample.value > sample.high;
      const belowNow = sample.value < sample.low;
      if (!outside && (aboveNow || belowNow)) runs++;
      outside = aboveNow || belowNow;
      above ||= aboveNow;
      below ||= belowNow;
    }
    return {
      signal: { id, hasReferenceRangeExcursion: runs > 0, endsWithinReferenceRange: !outside },
      pattern: { id,
        excursionDirection: above ? (below ? "both" : "above") : (below ? "below" : "none"),
        pattern: runs > 1 ? "repeated-excursions" : runs === 0 ? "within-reference"
          : outside ? "outside-at-end" : "returns-to-reference",
      },
    } as const;
  });
  return {
    scope: "Computed from every one-second synthetic chart record using each record's condition-matched reference range. This is range evidence only, not an exact onset, a fault diagnosis or proof of equipment health. Values may change while remaining in range; a normal reference-stage transition is not an excursion. A final return does not erase an earlier excursion or establish a repaired fault.",
    signals: tracks.map(track => track.signal),
    patterns: tracks.map(track => track.pattern),
  };
}

const compact = (text: string) => text.normalize("NFKC").toLowerCase().replace(/[\s\-‑–]/g, "");
type Language = "ko" | "en" | "ja";
function rangeSignals(scenarioId: string, language: Language) {
  const scenario = getProcessScenario(scenarioId);
  if (!scenario) throw new Error("Unknown process scenario");
  const index = language === "ko" ? 0 : language === "en" ? 1 : 2;
  const noExcursion = new Set(coachRangeEvidence(scenarioId).signals
    .filter(signal => !signal.hasReferenceRangeExcursion).map(signal => signal.id));
  return scenario.signals.map(signal => ({ name: compact(signal.name[index]), noExcursion: noExcursion.has(signal.id) }));
}
type RangeSignals = ReturnType<typeof rangeSignals>;

// A narrow backstop for known time-of-excursion premises in displayed signal
// names. It is not a general semantic/factuality validator. Conditional and
// whether-questions are not silently rewritten into prewritten coaching.
function hasTimePremise(question: string, language: Language, signals: RangeSignals) {
  const text = compact(question);
  const mentions = signals.flatMap(({ name, noExcursion }) => {
    const result: { start: number; end: number; noExcursion: boolean }[] = [];
    let start = text.indexOf(name);
    while (start !== -1) {
      result.push({ start, end: start + name.length, noExcursion });
      start = text.indexOf(name, start + name.length);
    }
    return result;
  }).sort((a, b) => a.start - b.start);
  return mentions.some((mention, position) => {
    if (!mention.noExcursion) return false;
    // Stop at the next named signal so its genuine excursion is not attributed
    // to this signal. An initial when-question can apply to both named clauses.
    const clause = text.slice(mention.end, mentions[position + 1]?.start ?? text.length);
    const prefix = text.slice(0, mentions[0].start);
    if (language === "ko") return /(?:참고|정상|기준)(?:범위|띠|대역)[^?？.!。]{0,45}(?:벗어난|벗어났던|이탈한|넘은|초과한|돌아온|복귀한)(?:시점|때|순간|시기|구간)/.test(clause)
      || /언제[^?？.!。]{0,30}(?:참고|정상|기준)(?:범위|띠|대역)[^?？.!。]{0,30}(?:벗어났|이탈했|넘었|초과했)/.test(clause);
    if (language === "ja") return /(?:正常参照|参考|正常|基準)(?:範囲|帯)[^?？.!。]{0,30}(?:外れた|逸脱した|超えた|越えた|戻った|復帰した)(?:時点|時刻|時期|とき|時|区間)/.test(clause)
      || (/いつ/.test(prefix + clause) && /(?:参考|正常|基準)(?:範囲|帯)[^?？.!。]{0,30}(?:外れた|逸脱した|超えた|越えた)/.test(clause));
    return /(?:whendid|whenwas|atwhat(?:point|time)|atwhich(?:point|time)|during(?:which|what)interval)/.test(prefix + clause)
      && /(?:leave|left|cross(?:ed)?|exceed(?:ed)?|wentoutside|movedoutside|return(?:ed)?(?:to)?)[^?!.]{0,30}(?:reference|normal|baseline)(?:range|band|bounds|limits)/.test(clause);
  });
}

export function hasUnsupportedRangeQuestion(question: string, language: Language, scenarioId: string) {
  return hasTimePremise(question, language, rangeSignals(scenarioId, language));
}

// Match only standalone, affirmative clauses beginning with the named signal.
// Negation, uncertainty, conditionals, comparative subjects and quoted claims
// are not the model affirming an excursion. This is deliberately not an NLU check.
const affirmativeRangeClaim: Record<Language, RegExp> = {
  ko: /^(?:은|는|이|가)(?:한때|일시적으로|잠시|계속)?(?:같은조건의|해당조건의|가상의)?(?:정상참고|참고|정상|기준)(?:범위|띠|대역)(?:(?:를|을|에서|밖으로)(?:벗어났|이탈했|넘었|초과했)|(?:로|으로)(?:돌아왔|복귀했)|밖에있었)(?:습니다|어요|다)$/,
  en: /^(?:briefly|temporarily)?(?:left|crossed|exceeded|wentoutside|movedoutside|stayedoutside|wasoutside|returnedto)(?:the|its)(?:matching)?(?:reference|normal(?:reference)?|baseline)(?:range|band|bounds|limits)$/,
  ja: /^(?:は|が)(?:一時的に)?(?:同じ条件の|該当条件の)?(?:正常参照|参考|正常|基準)(?:範囲|帯)(?:(?:を|から)(?:外れました|逸脱しました|超えました|越えました|外れた|逸脱した|超えた|越えた)|(?:に|へ)(?:戻りました|復帰しました|戻った|復帰した)|外に(?:ありました|あった))$/,
};

function hasAffirmativeClaim(text: string, language: Language, signals: RangeSignals) {
  const outsideQuotes = text.replace(/“[^”]*”|‘[^’]*’|「[^」]*」|『[^』]*』|"[^"]*"/g, " ");
  const sentences = outsideQuotes.match(/[^.!?。！？\r\n]+[.!?。！？]?/g) ?? [];
  return sentences.some(sentence => {
    const normalized = compact(sentence);
    if (/[?？]$/.test(normalized)) return false;
    const statement = normalized.replace(/[.!。！]$/, "");
    return signals.some(({ name, noExcursion }) => noExcursion &&
      [name, ...(language === "en" ? ["the" + name] : [])].some(subject =>
        statement.startsWith(subject) && affirmativeRangeClaim[language].test(statement.slice(subject.length))));
  });
}

export function hasUnsupportedRangePremise({ analysis, question }: { analysis: string; question: string }, language: Language, scenarioId: string) {
  const signals = rangeSignals(scenarioId, language);
  return hasTimePremise(question, language, signals) ||
    hasAffirmativeClaim(analysis, language, signals) || hasAffirmativeClaim(question, language, signals);
}
