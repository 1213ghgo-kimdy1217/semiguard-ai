# SemiGuard AI handoff — 2026-10-17

## Baseline

- Continue the existing repository and canonical site; do not build a replacement site.
- Base main: `6b01414fa417c90e11b6d15aa6c5622162f49d7c` (PR #92: deposition evidence and interconnect recurrence).
- Educational synthetic records and rules-based choice feedback are distinct from optional AI explanations. No real equipment connection, control, validated field competency or confirmed fault diagnosis.
- EDS and packaging workspace differentiation is still a separate follow-up, not implemented by this change.

## This change: optional measurement discovery and five-record pages

- `MeasurementPreferences` offers a visible first-visit dialog on introduction/sign-in/practice entry routes. The two purposes remain independent, unticked choices; refusal and closing do not gate the service. Detailed retention/withdrawal disclosures stay expandable, and a footer control reopens preferences.
- Existing valid measurement choices are respected instead of being silently switched on or repeatedly prompted. A new local preference stores only an expiry timestamp. An explicit Google refusal is retained as `enabled: false`, which never authorizes collection.
- Each existing provider reports whether its setting was saved. A partial failure stays visible with retry/close options; successful independent settings may already apply. No automatic retry loop.
- QA classification remains available and distinct from participant evidence. No analytics payload expansion, new DB table, Secret, API provider, auth requirement or billing change.
- `TrainingHistoryList` displays five records per numbered page, keeps server ordering and detail links, resets to page 1 when the review filter changes, and clamps a stale page after the supplied list shrinks. Parent account ownership gating and owner-keyed state reset remain intact.
- Scope limit: the API still returns **up to the 20 most recent attempts**. Pagination divides that existing result (at most four pages); this is not all-history server pagination. Summaries still cover the complete supplied recent list, not only the visible five.
- Answers, scores, submissions, saved checkpoints, sharing and AI contracts are unchanged.

## Verification actually completed locally

1. TypeScript: `tsc --noEmit --incremental false`, exit 0.
2. Full Vitest: `vitest run --maxWorkers 2 --minWorkers 2 --no-cache`, **346 files / 1,592 tests passed**, exit 0 (155.89 s). Tests use mocks; this is not live provider/DB verification.
3. Production build: Vite plus both server bundles passed, exit 0. Existing >500 kB bundle warning remains; no `manualChunks` change.
4. Edge local fixture with actual components/providers and an in-memory tRPC adapter, no production account, DB, AI or Google transmission:
   - First-visit independent unchecked controls; Escape closes without opting in.
   - Before consent: status only, no measurement event; no Google tag loaded.
   - Injected own-measurement save failure remains visible; retry succeeds. Choosing own measurement only leaves Google disabled.
   - Explicit refusal survives reload without automatically reopening the prompt; no collection or Google tag after reload.
   - Keyboard page 2 shows records 7–3 of synthetic IDs 12–1; page 3 shows 2–1. Onset filter resets to page 1 with two relevant records.
   - 390/320 px iframe viewport checks: no horizontal document overflow. At 320 px the dialog scrolls internally and its decline button can be activated by keyboard. These are desktop iframe checks, not physical-device validation.

## Release gate and remaining checks

- Production merge/deployment requires the user's decision for this change. Local success is not production success.
- Do not access protected Vercel previews or generate bypass/share-auth links.
- After an approved release, verify the canonical deployment's exact commit and the visible settings/history UI without changing an ordinary user's consent, submissions or saved records.
- Do not infer real participant counts or reuse rates from QA or declined/unmeasured visitors.
- On resuming work, inspect the current main and PRs first: BAZE may have separately progressed EDS/packaging. Preserve others' changes and do not overwrite them with this baseline.
- PR URL, commit and production verification should be taken from the accompanying PR/release evidence; they are not claimed completed in this pre-release document.

## 2026-10-17 — eight-process integration verification preflight

> Historical preflight below. The user subsequently supplied all three input files; the integration continuation at the end supersedes its missing-input and NOT EXECUTED statements.

### Current base and preserved work

PR #97 was subsequently approved, merged and deployed as `226484d20412e2e4a236be3879cf82c67b201e3e`. The earlier pre-release notes above are historical. The current integration branch is `integrate/eight-process-review-20261017`, created from this freshly fetched main, not reset to PR #92. Preserve the first-visit independent measurement choices and five-record history pagination.

This preflight uses the clean `work/semiguard-ga4-consent` checkout; the original dirty checkout and its staging are not modified. No application source from a draft has been applied yet. No main merge, production release, schema, Secret, permissions, repository settings or paid-service changes are authorized by this integration request.

### Source inputs actually read

- Current main handoff and PR #92 → current-main name/status comparison (PR #97: 13 changed files).
- PR #93 head `ec3d9a0ca67b93fb8340c8f9bdf28f2210a67b33`: read its handoff and EDS component/helper/context integration diff.
- PR #94 head `b8c931d77c6e36be4163b499cfbdb5f9781e4950`: read its handoff and packaging component/context integration diff.
- PR #95 head `ae4f8488514e5d8abf3ea662675363582a868f95`: read its handoff, inspection/concept records and workspace/equipment mounts.
- PR #96 head `6d5d5d7647edba0fa2838a25bd9f1040c2324254`: read its handoff and etch/metal component diffs. Its remote components are not mounted; the separate integration input remains necessary.

All four PRs are open drafts. Their handoffs explicitly report TypeScript/Vitest/build not executed. Preview or Python source checks are not substitute evidence.

### Missing input — do not substitute PRs for the integrated source

The current message names `SemiGuard_eight_process_source.zip` and `SemiGuard_Codex_checklist.md` but does not expose actual attachments or paths. Exact-name searches of the workspace/Documents Codex, remote-attachment folder and Downloads found neither file. `docs/EIGHT_PROCESS_REVIEW.md` is absent from current main and the accessible workspace. These missing files have NOT been read or verified. Requested them from the user; require the actual files or exact local paths before applying the integrated source. Do not recreate the ZIP from PRs, guess its wafer/oxidation/photo changes, overwrite the tree, or cherry-pick duplicates.

Known comparison hazards, not resolved without the ZIP:

- #93 and #94 both modify `ProcessRecordContext`: retain both mounts.
- #95 modifies `ProcessEvidenceWorkspaces`, while the integrated #96 metal mount also belongs there: retain both changes and the original recurrence board.
- Each draft adds a competing `docs/HANDOFF.md`; preserve actual history rather than overwriting current release/verification evidence.
- The user's ZIP is stated to include extra wafer/oxidation/photo and screen integration beyond these PRs. No claim of completeness from remote drafts alone.

### Actual execution evidence

- Existing Node runtime: `v24.19.0`.
- Existing installed pnpm: `10.18.0`. Initial version checks attempted pnpm's automatic switch to manifest version 10.4.1 and failed with sandbox `EPERM` during its temporary-tool rename. These are environment/version-management failures, not compiler/test failures. No project dependency installation or lockfile change was performed.
- Setting `npm_config_manage_package_manager_versions=false` **only for the command process** allowed the existing pnpm to run; repository configuration is unchanged. Existing Node's bin directory was prepended only to that process's PATH.
- Actual baseline command: `node node_modules/pnpm/bin/pnpm.cjs check` → package script `tsc --noEmit` → exit **0** on `226484d`. Not a check of the missing integrated source.
- Git fetch retrieved current main and PR heads into review refs. Git switch created the separate local integration branch. No draft was merged/applied and no new PR was created during preflight.
- Integrated `pnpm test` and `pnpm build`: **NOT EXECUTED**, because integration input is missing. Historical 345/1,571 (PR #92) and 346/1,592 (PR #97) totals are not results for the new integrated source.
- Browser eight-process/narrow-layout/keyboard/languages and account/save/resume/share/AI validation for the integrated source: **NOT EXECUTED**.

### Resume gate

After receiving files: validate archive paths without executing embedded code, compare against its exact PR #92 base and current main, read its handoff/review/checklist fully, selectively apply its delta while preserving PR #97, then run actual `pnpm check` → `pnpm test` → `pnpm build`. Fix failures without deleting tests or weakening data/ownership/future-record boundaries. Verify all eight routes and 320/390px/keyboard/ko-en-ja, with account operations limited to an approved QA environment. Report completed/unverified/issues separately. Main merge and public deployment need the user's approval after presenting those results.

## 2026-10-17 — supplied eight-process source integration

- Inputs received from the user's Downloads: `SemiGuard_eight_process_source.zip`, `SemiGuard_eight_process_review.patch`, and `SemiGuard_Codex_checklist.md`. The supplied checklist and integrated handoff/review were read; the checklist matches `docs/EIGHT_PROCESS_REVIEW.md`.
- ZIP SHA-256: `A24FEDDB046A8265A3A58D837D0C680F81C016F52FA018C9C57A10B82A1DA523`; patch SHA-256: `903C8707D50C42894B4032EA8367028066CB0D4D900CDDF9D9463755B80D48E2`.
- Validated all 716 archive entries before extraction into a separate staging directory: no traversal, absolute paths, duplicate paths, symlinks, `.git`, dependency trees or environment/Secret files. No archive was extracted over the checkout.
- Compared archive blobs against exact PR #92 base `6b01414fa417c90e11b6d15aa6c5622162f49d7c`: 32 added + 6 modified files, no deletions. Package/lock/config, original scenario/answer/scoring, server/API and DB contracts are unchanged. Current main remains PR #97 (`226484d`); no reset or blind draft-PR merge/cherry-pick.
- `git apply --check --exclude=docs/HANDOFF.md` passed on current main. Applied the reviewed source delta with targeted patches, including ZIP-only wafer/oxidation/photo context and etch/metal mounts. Preserved PR #97 runtime/tests and the current handoff. Archived the competing supplied handoff as `docs/source-handoffs/integrated-local--HANDOFF.md`.
- First actual integrated `pnpm check` passed. First full Vitest run: **357 files: 355 passed / 2 failed; 1,674 tests: 1,670 passed / 4 failed**. Three failures were the old metal-workspace test counting new independent perspective buttons as interval controls; one was a broken relative link in the supplied archived packaging note.
- Fixed the document link. Updated the existing metal regression test to require exactly one selected item in each independent group, all original 10 interval + 6 detail controls, and the 2 new perspective controls. No test or future-record/data guard was deleted or weakened.
- Re-running `pnpm check` → full `pnpm test` → `pnpm build` in that order. Final results and browser evidence will be appended below; do not treat an in-progress run as a pass.
- Browser plan: serve the actual production bundle on loopback with an **external-to-repo, memory-only synthetic QA RPC fixture**. No production account/DB/AI provider, credentials or measurements are connected. This checks UI/contract behavior, not real account persistence/provider availability. Any unverified external boundary must remain explicit.
- Main merge/public deployment remain prohibited until the user approves after seeing results. No DB, Secret, permission, repository-setting or paid-service changes.

### Final results after integration fixes

- Final actual sequence: `pnpm check` **passed** → full `pnpm test --maxWorkers 2 --minWorkers 2 --no-cache` **357 files / 1,675 tests passed** → `pnpm build` **passed**, all exit 0. Existing installed pnpm was invoked with `node node_modules/pnpm/bin/pnpm.cjs`; no dependencies/configuration changed. The existing >500 kB chunk warning remains, without changing `manualChunks`.
- Browser found one real navigation defect: photo review's next-etch link returned to the chooser. Changed only that next link to the existing `/training/etch` route, added a regression, repeated the full check/test/build sequence, then reloaded the final bundle and verified the direct etch session opens.
- Actual Edge local-bundle UI checks completed for **all eight** observation → answer selection/prose → submission → rule-based feedback → review flows, plus the retained tools and specific boundary positions. All eight rendered in Korean, English and Japanese at 320/390px, with no document-width overflow observed. Used desktop CSS viewport overrides, not real phone/tablet hardware.
- Synthetic QA fixture read-back: **8 scenario records / 8 save calls**, one explicit wafer checkpoint save/load at 54s, retry confirmations and retained completed records, original five-record pagination (5 + 3) and saved-choice detail/timeline. The fixture validates original serialization helpers but has no real identity/DB/AI/analytics connection. No real account persistence, cross-device behavior or successful provider call is claimed.
- A deliberate local unavailable-coach response preserved criteria feedback/timeline and showed an error, not a fabricated AI answer. Only one simulated coach request, zero external model calls. Share consent UI was viewed; no share link was created.
- Supplied metadata/checklist now explicitly identify their upstream historical NOT RUN statements and link to [current executed results](EIGHT_PROCESS_VALIDATION.md). After adding documentation, focused repository-link and integration-wiring checks also passed: 2 files / 10 tests.
- Full evidence, per-process matrix, local-fixture limitations, preserved contracts and remaining external checks: [EIGHT_PROCESS_VALIDATION.md](EIGHT_PROCESS_VALIDATION.md). Original `shared/processScenarios.ts`, `etchScenario.ts`, `trainingDraft.ts`, `trainingRecord.ts`, server routes/storage, app access routes and PR #97 runtime files remain identical to current main.
- Main was fetched again during validation and remains `226484d`. No main merge, production deployment, protected-preview access or DB/Secret/permission/settings changes. Commit/PR receipt will be recorded below after the review branch is published.

### Publication receipt / remaining gate

- Integration commit: [`a7aaed21f937cef8355fa1f3dde69af73fe52c94`](https://github.com/1213ghgo-kimdy1217/semiguard-ai/commit/a7aaed21f937cef8355fa1f3dde69af73fe52c94).
- Pushed successfully to the existing repository's [separate integration branch](https://github.com/1213ghgo-kimdy1217/semiguard-ai/tree/integrate/eight-process-review-20261017). No main merge or production release.
- Draft PR creation was **NOT executed**: the GitHub connector's automatic approval review returned a usage-limit error. This was a review-availability failure, not an unsafe-action determination. Do not bypass it through another client or create a PR from an assumed success. No PR URL/number exists from this attempt.
- After the review path is available, create a draft PR from this branch to main, attach it to the chat, record the actual URL, and present completed/unverified results before requesting the user's explicit merge/deployment approval.
- The separate local QA server and temporary browser viewport are cleaned up after verification. The original user's site/account tab is not changed. Local artifacts remain under `work/verification-artifacts/`.

## 2026-10-17 — peer-feedback follow-up: quieter UI and chosen-moment comparison

### Scope and implementation

- Continue the integration branch above; freshly fetched main remains `226484d`. Preserve the original dirty checkout and staged work. Anonymous feedback concerned excessive text, confusing terminology, narrow-screen proportions, and difficulty comparing numeric observations.
- Explain “8대 공정” as eight key semiconductor-manufacturing processes. Keep the original manufacturing-order qualification in a closed, keyboard-operable disclosure; do not delete it or imply that all exercises contain faults.
- Keep existing process-specific diagrams/tools visible. Move the repeated exact numeric snapshot table into a closed disclosure with its original caption, values, reference rule and focusable horizontal-scroll region intact.
- Add an optional, initially collapsed **chosen-moment comparison** in observation/review for all eight processes. Users select at most three already-observed integer seconds, remove a pin explicitly before replacing it, and see a discrete plot before the numeric cards. Equal spacing is categorical; no line or physical trajectory is inferred between chosen records.
- Reuse the original scenario engines for every value/reference/band, including the separate 180-second etch engine. Make phase/group/region context explicit; wafer comparison is the existing A3 reference trace, not a reconstruction of a different selected map region. A/B normal-reference changes are not labelled faults.
- Pins live only in parent memory, scoped by account/scenario/retry. They survive observation → decision → review but clear on retry, restored checkpoint, account scope transition or reload. Clear every scope transition, including A → B → A without adding a B pin. No persistence/network/effect is added by the comparison component.
- Discovery marker, answer, scoring, account save, checkpoint, share and AI serializers are unchanged. All original scenario and server/DB contracts remain identical to main. No DB/Secret/permission/settings/provider/billing changes or production deployment.
- React review: native disclosure/input/button semantics, unique accessible names, visible keyboard focus, 44px comparison controls, scoped CSS, no new dependencies, and no cross-account shared state. Browser verification is of the full local UI flow with a synthetic identity and memory-only RPC, not live account/provider behavior.

### Issues found and corrected during this follow-up

- Initial TypeScript check found an impossible review-stage branch inside etch's observe/decision block, and Set iteration unsupported by the existing target. Mounted the review comparison within the actual review block and used `Array.from`; did not change compiler configuration.
- Corrected the SVG title to one string child, removing the React SSR warning.
- Actual 320px English inspection found the existing long discovery-marker button protruding about 1.6px beyond the document edge. Constrain that button to its parent and allow automatic height/wrapping, with a regression check. Do not hide document overflow to mask the issue.
- The first local layout showed the new comparison expanded by default and numeric cards above its plot. Changed it to an optional native disclosure with plot first, so a new tool does not add another full panel to the default view.
- A three-pin mobile screenshot exposed wrapped `00:05` labels. Keep each pin label on one line and let entire buttons wrap to the next row; do not shrink or truncate the timestamp.

### Verification status

- Actual sequence after the marker-button fix: `pnpm check` passed → `pnpm test --maxWorkers 2 --minWorkers 2 --no-cache` **359 files / 1,697 tests passed**, exit 0 (153.68 s) → `pnpm build` passed. Existing >500 kB main-chunk warning remains; no chunk configuration was changed.
- After a final wording-only clarification removing a direction-dependent instruction, repeated TypeScript, the two new test files (**22 tests passed**) and production build, all exit 0. Reloaded this final bundle in Edge. Earlier 359/1,696 totals preceded the marker-button regression and are not the final follow-up total.
- After the final pin-label CSS adjustment, repeated both new test files and repository-documentation checks (**3 files / 28 tests passed**) and production build, all exit 0; no behavior/contract code changed. This additional focused run is distinct from the complete 359-file run above.
- Helper tests compare every signal in all eight processes against its original engine, plus duplicate/future/invalid inputs, three-pin cap, phase/group/region contexts and immutable source data. UI tests cover all three languages, disclosure/plot semantics, original serializers and narrow-screen controls. No existing test was deleted or weakened.
- Actual local Edge: native disclosure opens by keyboard, Tab reaches Add with visible focus, exact numeric disclosure opens/closes without losing its original table. Three pins disable adding a fourth; explicit removal allows replacement; a future second is rejected. Pin interaction pauses actual playback without changing the discovery marker or filling answer fields.
- Photo: compared 5/32/45s (including the temporary 32s deviation and 45s reference-band return), observation → decision → observation → submission → review retained pins and written choices, discovery marker remained absent. Confirmed retry clears comparison pins while its saved memory-only completed record remains. No AI call was made.
- Repeated photo observation completion, three-pin cap, blank onset before explicit answering, choices/prose submission and review with retained pins on the final disclosure-first bundle; did not rely only on the initial expanded prototype.
- Oxidation: 29s A and 30s B both render inside their own reference bands despite a raw-index change; changing the selected signal retains pin times. Refresh retains the original observed progress but clears pins. Etch: 39s A/40s B render in their own normal bands; completed the actual 180s observation → written choices → submission → review, retaining the comparison pins. Reloaded final etch review and repeated pin selection successfully.
- Final 320px English marker button is **246px wide / 56px high**, ending at x=280 within a 314px document. Document `scrollWidth == clientWidth == 314` (6px browser scrollbar within the requested 320px viewport). The exact English table has 703px content, contained by its own scroll region; opening it does not expand the document. Korean 390px and Japanese 320px comparison also fit without document overflow. All comparison controls measured at least 44px high, with visible focus; language changes preserve pin times.
- Final browser error log for the exercised local flows: empty. Fixture read-back currently confirms photo and etch records using the original `attemptKey` / `attempt` save fields and no unsupported RPC operations. This is memory-only serialization/UI evidence, not production persistence.
- Reloaded the final pin-label build: 390px photo pins measure about 103×53px and retain one-line timestamps; whole buttons wrap to the next row. Final English/Japanese photo at 320px also has document `scrollWidth == clientWidth == 314`; pin timestamps remain `nowrap`. Restored the original browser viewport, closed only the temporary local QA tab, and stopped the local server after evidence collection.
- Local logs/screenshots are under `work/verification-artifacts/feedback-comparison-*`, `comparison-graph-390-20261017.png` and `comparison-photo-390-20261017.png`. They contain only synthetic QA content. These are desktop CSS viewport overrides, not physical devices. The previous integration's all-eight full-flow matrix remains historical; this follow-up specifically rechecks the common tool in photo/oxidation/etch and unit-tests every engine, not a fresh exhaustive full-flow/device/account matrix.

### Release and external gate

- Main merge/public deployment require the user's approval after results. Do not access protected Vercel previews or change settings to obtain access.
- The previous connector approval-review usage-limit gate for creating a draft PR remains in effect; no alternate client is used to bypass it. No PR number is claimed.
- Real OAuth/account switch, production save/read-back, cross-device checkpoints, shared-link access, provider AI output and physical phone/tablet behavior remain separately unverified by the local fixture. No user private messages or answers are sent to an external model.

### Follow-up receipt

- Implementation and executed-verification commit: [`571643e5ed2ef3ecbab7760b2a86a8d0de28abd4`](https://github.com/1213ghgo-kimdy1217/semiguard-ai/commit/571643e5ed2ef3ecbab7760b2a86a8d0de28abd4).
- Successfully pushed to the [existing integration branch](https://github.com/1213ghgo-kimdy1217/semiguard-ai/tree/integrate/eight-process-review-20261017). No main merge, public deployment or new PR. Original scenario/answer/storage/server contracts remain unchanged relative to main.
- PR-creation approval-review availability is still pending, as recorded above; no alternative bypass path was attempted. Present these results to the user before any main merge or public release.
