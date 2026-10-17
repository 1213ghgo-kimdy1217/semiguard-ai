# SemiGuard AI handoff

## Base and links
Base main: [6b01414](https://github.com/1213ghgo-kimdy1217/semiguard-ai/commit/6b01414fa417c90e11b6d15aa6c5622162f49d7c), PR #92.
Branch: `feat/eds-observed-region-comparison`.
Initial implementation: [77bae0e](https://github.com/1213ghgo-kimdy1217/semiguard-ai/commit/77bae0e8daad20aa3c92b791f26e82e9815cd746).
Handoff links: [957fb03](https://github.com/1213ghgo-kimdy1217/semiguard-ai/commit/957fb0305b6412f6223f0562b0cedde528f2b22f).
Superseded generic index diagrams: [17ae802](https://github.com/1213ghgo-kimdy1217/semiguard-ai/commit/17ae802ad5439c5397f9d4b321cd6b1387c4a9e6).
Draft PR: [#93](https://github.com/1213ghgo-kimdy1217/semiguard-ai/pull/93). Branch creation, commit and draft PR creation actually succeeded. No merge.
Latest wafer/probe revision travels with this file; its exact commit is in PR #93 commit history.

## 2026-10-17 — EDS source changes
- `shared/edsObservation.ts`: original latest observed A/B/C region samples, capped at selected replay time and observation bound. Rewind hides later results. No per-die counts/yield or diagnoses.
- `client/src/components/EdsObservationWorkspace.tsx`: user requested EDS-specific imagery rather than generic gauges. Replaced generic index diagrams with conceptual wafer grid and native A/B/C buttons plus die/contact-pad/probe-card close-up. Grid positions and number of drawn cells are illustrative only, NOT actual wafer layout or measured dies. Every selected-region cell shares the selection highlight, never a pass/fail color. Unobserved buttons disabled; no unobserved results. Local view selection falls back to an observed row after rewind and is not persisted/transmitted. Probe illustration explains contact structure only; does not simulate real measurements or equipment condition. Selected-region status and exact per-region evidence link pictures to original data. ko/en/ja, image labels, native controls and scoped mobile CSS.
- `client/src/components/eds-observation.css`: responsive conceptual-diagram layout and visible selection/focus styling.
- `client/src/components/ProcessEvidenceReview.tsx`: existing EDS-only ProcessRecordContext integration retained.
- `server/eds-observation-workspace.test.ts`: initial exact-sample/bounds/region/band/language/integration tests retained, NOT RUN.
- `server/eds-visual-records.test.ts`: revised for two conceptual diagrams, native buttons, disabled unobserved regions, details count and language labels, NOT RUN. Superseded SVG gauge-count expectations removed.
- Existing scenario numbers, answers, grading, account/checkpoint/share/AI payloads unchanged in source. No ProcessTraining.tsx, processScenarios.ts, DB, dependency, secret or repository setting changes.

## Verification and limits
- Prior edits attempted pnpm check -> pnpm test -> pnpm build; all failed to start because pnpm is unavailable (exit 127). TypeScript/full tests/build remain NOT EXECUTED. This is not a test/compiler failure or success. No installed replacement runtime or new CI.
- Earlier main snapshot has no .github/workflows; PR #92 only reported Vercel Preview Comments. Its historical 345 files / 1,571 tests is not a rerun here.
- No actual React browser/320px/390px/keyboard/physical-device validation; native controls/responsive rules in source do not prove accessibility or runtime success. Stateful button selection/rewind needs actual interaction tests.
- Static expected-screen illustrations are NOT app/browser/Vercel screenshots. Source positions of wafer sectors/grid are conceptual, not new fabricated measurements. Original sampler remains sole result source.
- No ordinary-account submission, save/retry/resume/share or live AI call tested. Unchanged source contracts are not end-to-end proof.

## Release and next steps
Draft only, no main merge or production deployment requested/performed. Existing hosting integration may auto-create branch previews; their status is unverified and not production validation. No protected-preview bypass.
Run pnpm check -> pnpm test -> pnpm build in an approved existing environment. Check region controls, selection fallback on rewind, exact evidence, keyboard/narrow layouts. Review with learners whether EDS context is now clear; no validated learning claim.
Packaging is NOT implemented in #93. Next separate small change: observed-only trend onset / band exit / returning toward reference / return inside band, in a packaging-specific concept view, without claiming cause resolution.

## Remaining release checklist
- Core: login, all process observation/rewind/submit, rule feedback, account save/retry, checkpoint/resume, history, expiring share, cross-account ownership.
- AI: consent, bounded context, evidence attribution, unsupported-cause handling, failure state without fabricated generated responses, languages, scoped provider/privacy validation.
- User validation: representative learners and distinct reasoning tasks; no equipment-performance/learning-outcome claims based on code tests.
- Submission: reconcile README/AI_USAGE/HANDOFF, attribution/licensing, demo script, verified features and limitations.
- Merge/production deployment require user approval after results; production flows checked separately.
