# SemiGuard AI handoff

## 2026-10-17 — EDS small draft change

Base: main 6b01414fa417c90e11b6d15aa6c5622162f49d7c (PR #92). Main was checked before work and was unchanged.
Branch: `feat/eds-observed-region-comparison`.
Implementation commit: [77bae0e](https://github.com/1213ghgo-kimdy1217/semiguard-ai/commit/77bae0e8daad20aa3c92b791f26e82e9815cd746).
Draft PR: [#93](https://github.com/1213ghgo-kimdy1217/semiguard-ai/pull/93). GitHub branch creation, file commit and draft PR creation actually succeeded. No merge performed.

### Changes
- `shared/edsObservation.ts`: latest observed synthetic record per unfolded region; caps every record at the selected replay position and observation boundary. No die counts, invented map, yield or equipment diagnoses.
- `client/src/components/EdsObservationWorkspace.tsx`: separate region disclosure cards with original die/comparison values, normal reference, band and band-position text in ko/en/ja. Native details/summary controls; existing responsive evidence-card CSS reused.
- `client/src/components/ProcessEvidenceReview.tsx`: mount this view only in EDS ProcessRecordContext, already rendered by ProcessSnapshot in observation/review. Uses the selected time as a conservative observation cap, so rewinding hides later regions. Existing context and full review remain.
- `server/eds-observation-workspace.test.ts`: exact-sample, bounds, invalid-input, region/band, language and integration assertions added but NOT RUN.
- No changes to ProcessTraining.tsx, processScenarios.ts, answers, grading, persistence payloads, checkpoint/share/AI contracts, dependencies, DB, secrets or repository settings.

### Actual verification
- `pnpm check`, then `pnpm test`, then `pnpm build` attempted after edits: each failed to start (`pnpm: command not found`; shell exit 127). TypeScript, tests and production build NOT EXECUTED. This is not a compiler/test failure or success.
- Earlier repository check: no .github/workflows in main snapshot; PR #92 reported only Vercel Preview Comments. No replacement CI or paid execution environment added.
- Source inspection only: control is native details/summary and existing CSS stacks cards below 760px. No actual browser/320px/390px/keyboard or physical-device verification; no claim of accessibility completion.
- PR #92's 345 files / 1,571 tests is historical, not a rerun for this branch.
- User-requested expected-screen illustration is a static design preview, NOT an actual React/Vercel/browser screenshot or execution evidence.

### Release and pending work
Draft only; no merge or production deployment requested/performed. Existing hosting integration may automatically attempt a branch preview; this has not been checked and is not production validation. Protected preview access is not bypassed.
No ordinary-account submission, account save/resume/share or live AI call has been tested. These contracts are unchanged in source, not proven end-to-end.

Next: review this draft in an approved existing execution environment; run pnpm check -> pnpm test -> pnpm build. Check observation/rewind and native disclosure interaction at 320/390px with keyboard. Then independently implement packaging observation (trend onset vs band exit vs return) as a small follow-up without changing existing scoring. Packaging code is not implemented in PR #93.

## Remaining release checklist
- Core flow: login, each process observation/rewind/submit, rule feedback, account save/retry, checkpoint/resume, history, expiring share and cross-account ownership.
- AI: explicit consent, bounded context, evidence attribution, unsupported-cause handling, failure state without fabricated generated responses, language handling. Real provider calls and privacy boundaries need scoped verification.
- User validation: repeat with representative learners; compare whether distinct tasks improve understanding, without claiming validated learning outcomes from tests.
- Submission: reconcile README/AI_USAGE/HANDOFF, attribution/licensing and demo script with implemented and actually verified features. Document known limitations.
- Merge and production deployment require user approval after verification results; production flow must be checked separately.
