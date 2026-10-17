# SemiGuard AI handoff — packaging draft

## Links and base
Base main: [6b01414](https://github.com/1213ghgo-kimdy1217/semiguard-ai/commit/6b01414fa417c90e11b6d15aa6c5622162f49d7c). Branch creation returned this exact base; not reverted.
Branch: `feat/packaging-observed-return`.
Implementation: [7d828d1](https://github.com/1213ghgo-kimdy1217/semiguard-ai/commit/7d828d1c9469047b8aa8e9146eb81e7ce1c5d15d).
Draft PR: [#94](https://github.com/1213ghgo-kimdy1217/semiguard-ai/pull/94).
EDS independent draft: [#93](https://github.com/1213ghgo-kimdy1217/semiguard-ai/pull/93), last known implementation [ec3d9a0](https://github.com/1213ghgo-kimdy1217/semiguard-ai/commit/ec3d9a0ca67b93fb8340c8f9bdf28f2210a67b33). Not included in this branch; neither draft merged.

## Completed source scaffolding
- `client/src/components/PackagingObservationWorkspace.tsx`: conceptual wire-bonded package (die, wires, substrate), original connection samples through selected replay position, view-only pinned earlier record, current/reference/band SVGs and on-demand observed first band exit/return. Does not depict physical broken wires, repair or confirmed causes. Distinguishes trend onset, band exit, return toward reference and inside-band return in explanatory copy. Appearance remains a separate original evidence-table record.
- `client/src/components/packaging-observation.css`: scoped responsive layout, native slider/disclosure and visible focus rules.
- `server/packaging-observation.test.ts`: original-sample consistency and no-future exit/return tests; ko/en/ja static markup tests. Authored only, NOT RUN.
- `docs/PACKAGING_DRAFT.md`: initial WIP boundaries.

## Important incomplete items / known defect
Component is NOT YET MOUNTED in application. No visible application change is claimed. Integrate into packaging observation/review ProcessRecordContext without copying EDS branch changes or modifying answers/scoring/storage/AI contracts. Read existing tests first.
Known localization issue: short synthetic-record label replaces Japanese text with Korean even in Japanese; fix before completion. Existing explanation is long; user requested primarily process-relevant imagery, so evaluate concise presentation after integration.
Pinned time is clamped after rewind, but interactions require actual browser tests. No statement of a completed packaging feature.

## Actual verification
Prior pnpm check -> pnpm test -> pnpm build attempts elsewhere in this session all failed to start (pnpm: command not found, exit 127). For this packaging source, commands have NOT been executed. TypeScript, tests and production build NOT RUN. No historical test count reused as a new result.
Main snapshot has no .github/workflows and prior PR #92 had only Vercel Preview Comments, not full type/test verification. No CI, dependencies, paid execution environment or runtime installed.
Source review only. No rendered React screen, 320/390px browser, keyboard, physical device, ordinary-account submit/save/retry/resume/share or live AI call validated. CSS/native controls alone do not prove accessibility.

## Deployment boundary
No main merge, production deployment, DB/schema/secret/permission/settings changes. Branch/commit/draft PR creation succeeded. Hosting may auto-create preview; status not checked, no protected-preview bypass. Deployment is not approved by drafting source.

## Next work
1. Fix Japanese label, integrate component in packaging-only observation/review context, preserve existing timeline and numeric table.
2. In approved existing runtime: pnpm check -> pnpm test -> pnpm build. Resolve actual failures and record real counts/results.
3. Browser: pin/rewind/no future rows, 50/56/70/82 source distinctions, keyboard/native controls and 320/390px layouts; verify package drawing is conceptual, not diagnostic.
4. Core regression: login, observation, submit, rule feedback, save/retry/checkpoint/resume/history/share/ownership.
5. AI quality: consent, bounded context, evidence attribution, uncertainty, failure states, languages and scoped live-provider/privacy checks. No claim AI saw new viewing selections.
6. Representative-user validation for distinct EDS/packaging tasks; no learning-outcome or equipment-performance claim from software tests.
7. Submission: reconcile README/AI_USAGE/HANDOFF, attribution/licensing, demo and known limitations. Merge/production release only after user approves verification; then verify production separately.
