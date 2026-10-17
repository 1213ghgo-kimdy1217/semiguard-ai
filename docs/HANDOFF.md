# SemiGuard AI handoff

## Base and links
Base main: [6b01414](https://github.com/1213ghgo-kimdy1217/semiguard-ai/commit/6b01414fa417c90e11b6d15aa6c5622162f49d7c), PR #92.
Branch: `feat/eds-observed-region-comparison`.
Implementation: [77bae0e](https://github.com/1213ghgo-kimdy1217/semiguard-ai/commit/77bae0e8daad20aa3c92b791f26e82e9815cd746).
Previous handoff update: [957fb03](https://github.com/1213ghgo-kimdy1217/semiguard-ai/commit/957fb0305b6412f6223f0562b0cedde528f2b22f).
Draft PR: [#93](https://github.com/1213ghgo-kimdy1217/semiguard-ai/pull/93). Actual branch creation, file commit and draft PR creation succeeded. No merge performed.

## 2026-10-17 — EDS small change and visual follow-up
### Completed source changes
- `shared/edsObservation.ts`: latest observed original synthetic sample per unfolded A/B/C region; caps all rows at selected replay position and observation boundary. Rewinding hides later regions. No individual-die map/counts, yield or equipment diagnoses.
- `client/src/components/EdsObservationWorkspace.tsx`: region cards with two separate evidence diagrams (die / separate comparison), moving current-value circle, dashed reference and reference band on common 80–120 relative-index axis. Positions come directly from existing processSample values. SVG positions recompute when selected time changes, without forecasting. Numeric values remain behind native details/summary. ko/en/ja descriptions and SVG image labels; meaning does not rely on color alone.
- `client/src/components/eds-observation.css`: scoped responsive SVG rules, no new dependencies.
- `client/src/components/ProcessEvidenceReview.tsx`: mount only in EDS ProcessRecordContext already used by ProcessSnapshot. Existing context and full review retained.
- `server/eds-observation-workspace.test.ts`: sample/bounds/region/band/language/integration assertions added in original implementation, NOT RUN.
- `server/eds-visual-records.test.ts`: separate-diagram count, image-label, language and observed-only rendering assertions added in visual follow-up, NOT RUN.
- Visual follow-up commit: this handoff travels in the same commit; actual identifier is available in PR #93 commit history. Original implementation links above remain valid.
- No changes to ProcessTraining.tsx, processScenarios.ts, answers, grading, persistence payloads, checkpoint/share/AI contracts, dependencies, DB, secrets or repository settings.

### Actual verification and limits
- Original change: pnpm check -> pnpm test -> pnpm build attempted, each failed to start (pnpm: command not found, exit 127).
- Visual follow-up: same three commands attempted again in order, each failed to start for the same reason. TypeScript, full tests and production build NOT EXECUTED; this is not a test/compiler failure or success.
- Main snapshot has no .github/workflows; PR #92 reported only Vercel Preview Comments. No replacement CI or paid runtime added.
- Source inspection only: native disclosure controls, scoped responsive SVG rules and existing card stacking. No actual browser/320px/390px/keyboard/physical-device verification or accessibility-completion claim.
- Historical PR #92's 345 files / 1,571 tests is not a rerun for this branch.
- User-facing static expected-screen renders are design illustrations, NOT React/Vercel/browser screenshots or execution evidence. Diagrams depict summary indices, not physical die layouts or real equipment output.

### Release and pending work
Draft only. No main merge or production deployment requested/performed. Existing hosting integration may create automatic branch previews; their status is unverified and not production validation. Protected-preview access is not bypassed.
No ordinary-account submission, account save/retry/resume/share or live AI call tested. Unchanged source contracts are not end-to-end proof.
Next: run pnpm check -> pnpm test -> pnpm build in an approved existing execution environment. Check rewind bounds, diagram positions, native disclosures and narrow/keyboard layouts. Review whether index diagrams sufficiently differentiate the learning task with users. Then implement packaging as an independent small change: observed-only trend onset / band exit / returning toward reference / return inside band; no cause-resolution claim. Packaging is NOT implemented in #93.

## Remaining release checklist
- Core: login, all process observation/rewind/submit, rule feedback, account save/retry, checkpoint/resume, history, expiring share, cross-account ownership.
- AI: consent, bounded context, evidence attribution, unsupported-cause handling, failure state without fabricated generated responses, language handling. Scoped provider-call and privacy verification remains.
- User validation: representative learners, distinctive reasoning tasks, no validated-learning or equipment-performance claims from software tests.
- Submission: reconcile README/AI_USAGE/HANDOFF, attribution/licensing, demo script, actually verified features and limitations.
- Merge/production deployment require user approval after verification; production flows checked separately.
