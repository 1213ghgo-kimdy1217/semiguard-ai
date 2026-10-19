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

## 2026-10-18 — BAZE source / observation prompt reconciliation

### Compare first, supplement only the actual gaps

- The user clarified that the new prompt restates BAZE's prior integrated work. Compared it with the original ZIP and current integration instead of applying all four draft PRs again. Original ZIP hash remains `A24FEDDB046A8265A3A58D837D0C680F81C016F52FA018C9C57A10B82A1DA523`.
- Separate branch: `feat/eight-process-observation-studio-20261018`, based on `bc83ddc`. Freshly fetched main remains `226484d20412e2e4a236be3879cf82c67b201e3e`. Drafts #93–#96 remain open/unmerged; no source reset or duplicate application. Original dirty checkout/staging preserved.
- Per-process retained work and exact supplemental scope: [EIGHT_PROCESS_PROMPT_MERGE.md](EIGHT_PROCESS_PROMPT_MERGE.md). Keep nine-region wafer maps, oxidation matching-reference selection, photo overlay/pin, deposition evidence classification and metal interval/row navigation.
- Corrected the real independent-selection problem: etch concept/chart now share one observation signal; review has its own view-only signal, reset for account/retry and pressure-based AI review jumps. Metal perspective and deposition/packaging record selection also connect to the existing chart state. Selection pauses playback rather than silently advancing the inspected record.
- Wafer and EDS selected-record visual bands use the original exact samples. Packaging offers a separate appearance perspective while preserving explicitly labelled connection exit/return history. Fixed 80–120 teaching-index axes are shared for comparisons; tests cover every original wafer/EDS/package sample fitting that display domain. Structure geometry is not altered to imply thickness, depth, faults, repairs, yield or individual-chip outcomes.
- Central process tools now precede optional full graphs/exact tables; original controls and evidence are retained in native disclosures. Photo exposure/substrate background no longer precedes the main observation tool. Oxidation's fixed structure and reference comparison sit together. Discovery actions stay separate from view-time selection and comparison pins.
- Files: `ProcessTraining.tsx`, `EtchTraining.tsx`, the eight existing observation/concept components and `ProcessEvidenceReview.tsx`, new `RecordBand.tsx` / `process-studio.css`, new merge regression tests and the EDS SVG-count regression (now explicitly two structure concepts + two original-data bands). No test/safety guard removed.
- Original scenario/answer/scoring/generator, draft/result serializers, server routes/DB, AI contracts, package/lockfile and Vite configuration remain identical to current main. No new dependencies, DB/Secret/permission/billing/repository-setting changes.

### Executed checks

- Runtime: Node `v24.19.0`, existing installed pnpm `10.18.0`, invoked as `node node_modules/pnpm/bin/pnpm.cjs` with process-only `npm_config_manage_package_manager_versions=false`. Project's pinned package-manager field and dependencies were not changed.
- Final actual sequence after layout-neutral context wording, all exit 0: `pnpm check` → `pnpm test --maxWorkers 2 --minWorkers 2 --no-cache` (**360 files / 1,717 tests passed**, 149.41s) → `pnpm build` (production assets plus both server bundles). These are this branch's results, not PR #92's historical totals. Existing >500kB main chunk warning remains; no `manualChunks` modification.
- Additional documentation/wiring/new-merge regression run after the comparison note: **3 files / 30 tests passed**, exit 0. Logs: `work/verification-artifacts/studio-final-{check,tests,build}-20261018.log` and `studio-doc-contracts-20261018.log` (outside this repository).
- New regressions cover exact supplied record attributes, all controlled etch signals and observed horizon, metal perspective, deposition selection with retained classifier, appearance vs connection history, view-only serialization boundaries, fixed display axes and accessible/responsive/reduced-motion styles. Original horizon, rewind, callback, save and AI regression suites remain enabled.
- React review: optional controlled props retain standalone fallbacks; no derived-state effect, new provider or persisted observation selection; native buttons/disclosures, independent accessible names/pressed states, text/shape cues and keyboard focus. No dependency or broad formatting change.
- Final wording review removed direction-dependent “below” instructions from wafer/oxidation/photo context, because these concepts may now be beside a comparison or in a later disclosure. All three language renderings have an added regression assertion; the complete check/test/build sequence was repeated after this correction.

### Release and remaining external boundary

- Browser evidence is collected from the actual final production bundle on loopback, synthetic QA identity `990001`, memory-only RPC and original serializers. It is not a separate UI mockup or a production account. No live DB, telemetry, OGQ download or external AI request.
- Main merge/public deployment are **not performed** and still require the user's explicit approval after results. Protected Vercel previews are not accessed or bypassed.
- Real social login/account switch, production save/read-back, cross-device checkpoint, share recipient access and provider AI output remain externally unverified by this local fixture. Physical iPhone/tablet and OS reduced-motion preference emulation are not claimed; CSS media-query support is checked.
- Browser matrix, screenshots, commit and publication receipt follow below after completion.

### Actual local browser results

- All eight Korean observation → answer selection/prose → submit → rule-based feedback → review flows completed against the actual bundle. Etch retained a genuinely observed 180-second session; the seven other original records were actually replayed to 90 seconds (using the existing 3× control). No clock/state injection or fabricated values.
- Wafer: A3 selection at 54s showed the exact surface/thickness samples. Surface/thickness remain independent of answer selection. After a confirmed QA retry, the final top-level signal selector paused real playback; the new attempt began at 0. A 48s checkpoint saved/restored paused in memory-only RPC. Same-tab load retains valid view choices, while reload resets view-only choices to B2/surface and retains the original 48s progress. The eight completed memory-only records were not deleted by retry.
- Oxidation: 30s group B with observed group A reference shows the original mismatch warning; rewind to 29s disables that comparison. Matching reference restored; submitted the explicit no-deviation answer and entered review.
- Photo: pinned 32s and selected 45s showed original 112.5/99.9 vs 99.5/100.3 position values; overlay toggled off/on, shape/position changed without altering answers. Submitted and reviewed on the final rebuilt bundle.
- Etch: RF/temperature concept selection matched the original chart signal and selected evidence, both observation and review. Review remains separate from the pressure-based submitted criteria; no altered engine or fault diagram.
- Deposition/implantation: selecting the separate electrical card selected its existing chart signal, with one highlighted card. The retained film-source classification at 48s gave the original rule-based feedback (film 86.4 vs its 96–104 band), not AI feedback or a new score.
- Metal: original 42–47 / 48–53 / 54–59 interval buttons and the 54s row navigated correctly; appearance perspective selected the same chart/evidence signal. The new discrete strip showed only observed records. Tab reached the next original interval button with visible focus.
- EDS: selected C, rewound to 59s → C disabled, selected evidence fell back to B/59s; rewound to 29s → A/29s. Returning to observed 60s allowed C selection by Enter and showed the exact C die/comparison markers. No future C value survived rewind.
- Packaging: at 55s no exit; at 56s first connection exit; at 82s first return. Appearance selection changed the chart and original marker records while the separately labelled connection exit history remained. Native range keyboard controls pinned 5s; rewind to 3s clamped both displayed records and pin maximum to 3. Native keyboard input, not a programmatically filled range, was used for this verification.
- Narrow rendering: **48 measured cases** = 8 processes × 320/390 CSS px × ko/en/ja, `scrollWidth === clientWidth` in every case. Six processes were inspected in observation; wafer/etch in review for this matrix. All eight final review workspaces also rendered at the normal desktop viewport (~1699px), with no document-width overflow. This is not an exhaustive every-control/every-language audit or a physical-device test.
- Keyboard samples: native disclosure activation, EDS Enter, metal Tab and packaging range arrows; visible solid focus. All browser error-log checks were empty. OS-level reduced-motion emulation was not available; the scoped media query and non-animated record/structure rendering are covered by source/regression review.
- Fixture read-back: **8 distinct original scenario records / 8 save calls**, original `attemptKey` + `attempt` fields; **1 wafer checkpoint**, original fields `version, scenarioId, elapsed, marker, stage, signal, onset, comparison, certainty`; no prose or new viewing state added. Zero coach requests; no unsupported fixture operation. These are synthetic QA records, not user-adoption evidence or production persistence.
- Actual screenshot artifacts (outside the repo, no image generation): `studio-etch-desktop-20261018.png`, `studio-photo-390-20261018.png`, `studio-eds-desktop-20261018.png`, `studio-eds-records-desktop-20261018.png`, `studio-packaging-desktop-20261018.png`, under `work/verification-artifacts/`. Dimensions/language/title matrix: `studio-browser-layout-20261018.json`.

### Completed / not verified / remaining

- Implemented and executed: the reconciliation delta above, TypeScript/full tests/build, all-eight local submit/review, sample-specific horizon/selection callbacks, mobile/language rendering and one synthetic checkpoint/retry path.
- Code written but unexecuted: **none in this delta**. This does not imply every account/provider/device path was live-tested.
- Not implemented or changed: new scores, new physical-process models, new AI/provider behavior, persistence of view-only selections, DB/Secret/access changes, main merge or public release. Live OAuth/DB/cross-device/share/AI and physical-device checks remain the external gate; they were deliberately not simulated as successes.
- No PR creation retry before the previously reported approval-review reset (01:18 KST). No alternate API/client used to bypass that gate. Commit/branch publication receipt will be appended after committing this verified delta. Main/public release still need a new explicit approval.
- After the final context-copy-only correction and full check/test/build repeat, reopened the actual final bundle and inspected wafer/oxidation/photo context in all three languages (**9 actual DOM renderings**, no stale directional instructions, empty error log). Evidence: `studio-final-context-copy-20261018.json` and `studio-oxidation-final-desktop-20261018.png`. The earlier eight-flow/matrix evidence above concerns identical behavior/layout code; this final pass changed only those explanatory strings and their regression assertion.
- Restored the normal viewport, closed only the temporary local QA tabs and stopped both own QA server sessions. Original user tabs/accounts were not logged out or modified.

### Publication receipt

- Verified implementation commit: [`7a6a2573e76582dd6ab934e6a424cf51ac5bcc53`](https://github.com/1213ghgo-kimdy1217/semiguard-ai/commit/7a6a2573e76582dd6ab934e6a424cf51ac5bcc53), 19 files, +289/−62 relative to the previous integration head.
- Successfully pushed only the [separate work branch](https://github.com/1213ghgo-kimdy1217/semiguard-ai/tree/feat/eight-process-observation-studio-20261018). No main merge/public release. Any automatic branch CI/preview is not counted as an executed test or inspected deployment; protected previews were not accessed.
- No new PR URL/number: the previously reported approval-review availability gate has not yet reset, so PR creation was not retried through this or another client. After that normal review path is available, create/attach a draft PR from this branch; present these results and obtain explicit permission before main merge/public deployment.

## 2026-10-18 — Verified feedback-to-record navigation correction

### Reproduced boundary and minimal correction

- Actual local final-bundle reproduction: submit the metal exercise, select the appearance view, then activate `42초의 구성상 시작 보기`. Before this correction the displayed time became 42s, but appearance remained selected and the actual time-series disclosure stayed closed. Focus landed on the appearance monitor heading. This made the teaching-onset action point at the wrong inspection and hide its original graph.
- Choice feedback now passes a view-only signal hint: the learner's onset follows the learner's selected inspection; the teaching onset follows the scenario's original expected inspection; the overview uses the primary inspection. The existing two-argument AI review callback is unchanged and uses the trusted submitted answer, not model prose, for view selection.
- Authored timeline follow-ups for wafer thickness, deposition's separate electrical inspection and metal appearance select those existing records. Other event targets keep their original primary record. No samples/events, answer criteria or scenario payload fields were added or changed.
- These valid submitted-review actions open the existing native graph disclosure before focusing its labelled signal/time heading. Existing return-to-feedback/timeline/question behavior and sticky-header alignment are retained. Invalid/unsubmitted/out-of-range navigation remains guarded. Navigation does not save, score, submit or call an AI provider.
- Files: `ProcessTraining.tsx`, `ProcessCriteriaFeedback.tsx`, new view-only `processReviewNavigation.ts`; original criteria tests updated for the additional optional view hint, plus 12 new navigation regressions. No test removed or safety assertion weakened. React/verification guidance kept the change at this first broken view-state boundary instead of expanding server/API scope.

### Actual checks and browser evidence

- Actual final sequence, all exit 0: `pnpm check` → `pnpm test --maxWorkers 2 --minWorkers 2 --no-cache` (**361 files / 1,729 tests passed**, 181.19s) → `pnpm build` (Vite 24.45s, production assets and both server bundles). Same existing Node/pnpm process-only invocation as above. Logs: `work/verification-artifacts/review-navigation-{check,tests,build}-20261018.log`. Existing large-chunk warning remains; no Vite/package/lockfile change.
- Actual final-bundle metal flow: appearance selection → teaching onset by Enter selected connection at 42s, opened its graph and focused `연결 검사 지수 · 00:42`, at about 101px below an 81px sticky header. Choice-feedback return focused its heading. The 90s appearance timeline event selected appearance at 90s; timeline return focused its heading. The 54s evidence button selected connection at 54s. These are real keyboard interactions against synthetic QA data, not injected application state.
- Six additional browser cases: metal review at 320/390 CSS px × Korean/English/Japanese. In each case close the real graph disclosure, select appearance, then activate the localized teaching-onset button by Enter. All selected connection/42s, reopened the graph, focused the visible localized heading and had `scrollWidth === clientWidth`. No browser error logs. This focused matrix supplements, rather than reclaims, the earlier all-eight observation/submission matrix.
- Additional actual wafer run: replayed to 90s using the original 3× control, submitted a deliberately different synthetic answer (thickness/48s), then verified three distinct targets by Enter: own onset → A3 thickness/48s, teaching onset → A3 surface/25s, timeline thickness follow-up → A3 thickness/90s. All opened/focused the original graph; the submitted thickness/48s answer and its two mismatched criterion results stayed unchanged. Evidence: `review-navigation-wafer-20261018.json` and `review-navigation-wafer-after-20261018.png`; empty browser error log. No state/clock injection.
- Screenshots: `review-navigation-before-20261018.png`, `review-navigation-metal-after-20261018.png`, `review-navigation-metal-390-20261018.png`. Before/after DOM and six measurements: `review-navigation-browser-20261018.json`, all outside the repository under `work/verification-artifacts/`.
- Fresh `git fetch origin main` still reports `226484d20412e2e4a236be3879cf82c67b201e3e` (#97). Original scenario/generator/answer/scoring, draft/result serializers, `judgmentCoach`/`coachReview`, server DB, package/lockfile and Vite configuration remain identical to that main. Original dirty checkout/staging remains untouched.
- Still not verified by this local fixture: production OAuth/DB, cross-device persistence, recipient sharing, provider AI output and physical-device behavior. No external AI request, protected-preview access, main merge or public deployment. Any branch Vercel status is not whole-test or production-flow evidence.
- Publication/remaining receipt follows after recording this verified correction; main merge and public deployment still require fresh user approval after these results.
- Final post-documentation regression: **4 files / 55 tests passed**, exit 0 (`review-navigation-doc-tests-20261018.log`). This is additional to, not a replacement for, the full 361-file run above. Local fixture read-back contained two synthetic completed records (metal/wafer), zero coach calls and no unsupported operation. Restored the normal viewport, closed the own QA tab and stopped the own loopback server; no production account/session or user tab changed.

### Publication receipt and approval boundary

- Verified navigation implementation commit: [`57a94640f2b298e164d8fa44627b603b696bca73`](https://github.com/1213ghgo-kimdy1217/semiguard-ai/commit/57a94640f2b298e164d8fa44627b603b696bca73). Pushed only the existing integration branch; no main mutation.
- At 01:19 KST, after the previously reported 01:18 availability reset, the normal GitHub connector successfully created **[draft PR #98](https://github.com/1213ghgo-kimdy1217/semiguard-ai/pull/98)** against main #97. Attached it to this chat. The old no-PR/availability notes above describe the earlier checkpoint and are superseded by this receipt. No alternate-client bypass, preview access or permission change.
- Creation response: `draft: true`, `state: open`, `merged: false`, 58 changed files including the prior verified integration. Drafts #93–#96 were not merged or separately reapplied. Automatic branch checks/previews are separate from the executed local checks; no public-site success is claimed.
- Remaining: user reviews results and explicitly approves any main merge/public release; then verify the approved release in its actual environment. Until then, production account/provider/device checks remain unverified, and no further release action is authorized by this receipt.

## 2026-10-18 — Read-only practice aggregate reader, approval pending

- Existing main `9818428` (#98) is the direct parent of capability commit `f8e9a40`, on local branch `feat/practice-metrics-reader-review-20261018`. Only the nine-file capability change was transferred from `f612f70`; #98 and drafts #93–#96 were not replayed. The earlier checkout's three unstaged documentation changes remain preserved and are not included here.
- Human approved implementation/verification, not actual account activation or production release. New server-only `PRACTICE_METRICS_READER_USER_ID` defaults to empty. No real account identifier has been configured, and neither `users.role` nor `OWNER_OPEN_ID`, DB schema/data, Secrets or permissions were changed. No push, PR, main merge or deployment yet.
- Separate report authorization accepts existing administrators or one exact configured positive account ID, never names/emails/client input. A boolean-only capability query gates UI/data queries; pending/error/denied permission states hide cached results. The server independently authorizes every report before DB access. No individual records or additional administrator mutations are exposed. Existing aggregate calculations, optional consent, QA separation, maturity and browser-not-person caveats are preserved.
- The source-equivalent earlier checkout passed ordered check / all 363 files, 1,755 tests / build (including three unrelated pre-existing documentation assertions). The clean-main-based branch was then checked independently: `pnpm check` exit 0 → `pnpm test --maxWorkers 2 --minWorkers 2 --no-cache --reporter=dot` exit 0, **363 files / 1,755 tests**, 144.75s → `pnpm build` exit 0 (Vite 17.34s and both server bundles). Same test count is not a reused run; the three earlier additions were assertions inside existing tests. Logs: `practice-metrics-reader-clean-{check,tests,build}-20261018.log` outside Git. The initial clean checkout lacked node_modules; dependencies were reused via an approved local junction, with no installation or service change.
- Local real-bundle browser fixture: guest/ordinary denial, configured reader, lookup-error/retry and removed configuration verified using synthetic users/counts only. Report/storage requests occurred only in reader mode; no unexpected fixture RPC. Requested 320/390 layouts had equal client/scroll widths (314/314 and 384/384); viewport restored. Browser Enter actions exercised; stable focus retention and native-calendar range editing not certified. Actual production identity/data/revocation and physical iPhone remain unverified.
- Outside-Git evidence is under `work/verification-artifacts/`: `practice-metrics-reader-local-20261018.png`, `practice-metrics-reader-browser-20261018.json`, synthetic loopback fixture and execution logs. Fixture server and its agent-created tab were stopped/closed. No external AI request, private-answer transmission or adoption claim.
- Carry-forward audit boundary from the preserved earlier checkout: one production synthetic coaching request returned `invalid-response`; it remains unresolved and was not retried here. User-reported additional use by three friends is self-report, not a measured weekly-retention denominator. No operating aggregate report, first-20-user claim, physical phone test or competition submission is certified by this change.
- Final source comparison found no runtime/client/shared/server/schema/API/config differences between the tested capability commits; SHA-256 comparison of all **39 final public build files** matched the earlier browser-verified bundle byte for byte. No server-only reader configuration name/property occurs in those browser assets. `git diff --check` passed. The existing >500 kB chunk warning remains; manualChunks was not changed. Only this receipt was added after the clean full run, with no further runtime change. No PR link exists because nothing was pushed or published.
- Next gated action: verify the intended existing account's authenticated numeric ID; obtain explicit approval for that account's aggregate-only capability and production release; configure only that server environment and deploy via the normal reviewed PR flow; then check actual allowed/denied/guest results and aggregate readiness. Clearing the configuration requires a new approved deployment to revoke existing deployment access. No missing events are backfilled.

## 2026-10-18 — First-use clarity from qualitative feedback (local, not released)

### Scope and preserved contracts

- Fresh GitHub branch read confirmed main at `fbb1eb4e2e097c6946f3ccca8dde114319155cbe` (#99). Created separate local branch `fix/first-use-guidance-20261018` from that main. The earlier local production receipt remains preserved on `feat/practice-metrics-reader-review-20261018`; nothing was reset or overwritten. Shell fetch initially failed at DNS, so the connector branch response was used to verify the existing local origin/main SHA.
- Login/signup now say **로그인 아이디 / Sign-in ID / ログインID**. New-account guidance explains that this is a chosen SemiGuard ID, not an actual employee/student number. Existing users are explicitly told to keep their former badge-number value. OAuth hints, required/failed/duplicate messages follow the same vocabulary in all three languages.
- Hint text is linked to each credential field alongside existing inline errors. `badgeNumber` DOM IDs, autocomplete, payload keys, routes, validation, server conflict code, database schema and existing account values are unchanged. No credential migration or new account was performed.
- Added a pure, view-only `PracticeFirstStep` component: select one observation, compare the same item with a same-condition normal reference, then check persistence/recurrence. It appears only during observation in the seven-process screen and the existing etch engine, not in answers or reviews. It cannot read/change clocks, expected answers, markers, submissions, scores, saves or AI inputs. It explicitly permits records without deviation and does not equate change with confirmed fault.
- Free observation now states its purpose: separate observed facts from possible explanations, with no fixed answer submission. Long data/run-ID/storage text remains available in a native disclosure with a visible synthetic-data/tab-only-storage summary. Reset confirmations, unavailable-storage warnings, notes and CSV mode are preserved. The disclosure was not added to CSV mode.
- React review kept this to static copy/native semantics: no new state, effects, request, dependency or global refactor. Browser visual review found list markers suppressed by the base reset; scoped decimal numbering was restored. No shared scenarios/criteria, server/API/schema, DB, Secret, permission, build config or lockfile was changed.

### Executed checks and actual browser evidence

- TypeScript `pnpm check` exit 0; final full `pnpm test --maxWorkers 4 --minWorkers 2 --no-cache --reporter=dot` exit 0: **365 files / 1,767 tests**, 89.28s. Twelve new tests cover localized guidance, unchanged credential contracts, accessibility hints and view-only boundaries; existing copy assertions were updated without removing error/focus/safety assertions. Production `pnpm build` exit 0: Vite 27.33s plus both server bundles. Existing >500 kB chunk warning remains; no manualChunks change. `git diff --check` passed.
- The first restricted full-test attempt encountered loopback `connect EACCES 127.0.0.1` in existing HTTP integration tests and was interrupted. Re-running with local-network access passed all 1,767 tests (112.09s), then passed again after the marker-only CSS fix (89.28s). No tests were skipped or weakened to bypass the environment error. Initial sandboxed QA server startup was similarly unreachable from Edge; the same loopback-only fixture worked with the permitted local-network execution.
- Verification story: real final browser build → unchanged login request fields → synthetic loopback auth response → training; real observation UI → static first-action guidance; real disclosure → original storage text and keyboard continuation. No operating DB, provider, real credentials or external telemetry was involved. Fixture auth requests retained only `badgeNumber,password` keys; no values were logged, no signup or coach request reached the fixture, and no unimplemented operation occurred in the inspected fixture read-back.
- Actual Edge checks: login/signup/wafer observation/etch observation/free observation at requested 320/390 widths × ko/en/ja (**30 cases**). After the CSS marker correction, repeated the three observation screens × both widths × all languages (**18 final-build cases**): visible three-step decimal lists and no document-width overflow. Across all **48 measurements**, client/scroll widths matched (314/314 and 384/384); these are browser overrides, not physical-phone tests. Normal viewport was restored.
- Synthetic login success reached `/training`; synthetic rejected credentials and empty-field cases rendered the new vocabulary with the expected hint/error ID links. Free disclosure opened/closed by Enter; Tab moved to the original observation-start button with a solid focus outline. Existing sensor selection and one tab-local evidence note succeeded; the wafer observation draft restored on revisiting its route. No new submission, account save, share or AI call was made.
- Outside-Git artifacts under `work/verification-artifacts/`: `first-use-browser-20261018.json`, `first-use-free-desktop-20261018.png`, `first-use-judgment-390-20261018.png`, `first-use-local-qa-20261018.mts`, `first-use-check-20261018.log`, `first-use-tests-{local-network,final}-20261018.log`, `first-use-build-final-20261018.log`. Screenshots are real rendered product screens, not generated mockups.

### Not verified / release gate

- Actual signup and duplicate-signup browser response were not completed: native date fill did not set the date and existing client validation correctly stopped submission. Duplicate-response localization remains covered by automated tests. Automatic requestAnimationFrame error-focus restoration was not certified in the browser; the existing focus code and regression assertions are unchanged. Native disclosure/Tab focus was directly verified.
- No live DB/account creation/OAuth/provider/AI, physical-device run, all-eight submit/review repeat, learning-effect measurement or new adoption count is claimed. This supplied qualitative feedback is not a completion or retention metric. A separate previously observed coaching `invalid-response` issue is not resolved by these copy changes.
- Local implementation and verification only. No GitHub push, PR creation, main merge, public deployment, operating configuration or competition submission in this change. Show the result and obtain new explicit approval before releasing this change to the existing public site.
- Verified implementation is preserved in local commit `f99806c30829cdd7d5d4cf98d9f23646878605f6` on the separate branch above. This commit has not been published, so no remote commit/PR URL is claimed. The local QA server and agent-created tab were closed after saving the final screenshots; original user tabs/accounts were left untouched.

## 2026-10-19 — Repository review and environment-independent coach test

- Current GitHub main was freshly compared with `2b46a735aa8f847fa45391158ba02600998a3184` and was identical. Used the separate clean audit worktree and local branch `fix/review-test-portability-20261019`; preserved older dirty checkouts. No history/date rewriting or timestamp-only source changes.
- Reproduced 1 failure / 103 tests in `server/judgment-coach.test.ts` with an empty provider key: an `it.each` case captured `ENV.nvidiaApiKey` before `beforeEach` supplied its mock key. Reused one explicit synthetic key at both stages. No application behavior, validation guard or test expectation was weakened.
- Actual ordered checks: TypeScript exit 0; full Vitest with local HTTP permitted **365 files / 1,767 tests passed**, exit 0, 71.16s; production build exit 0 (Vite 31.85s and both server bundles). The initial restricted full run had 21 local-loopback `EACCES` failures across 3 files; all 33 tests in those files passed with local HTTP permitted before the full rerun. No tests skipped. Provider/DB keys were blank, with mocked services rather than production calls.
- Additional actual checks: 103 coach tests passed with a different synthetic process key; `node scripts/verify-vercel.mjs` passed against the actual built API on loopback, without account configuration. Existing 654.69 kB main-chunk warning remains. Existing live coaching `invalid-response` issue is not claimed resolved.
- Scope, commands, manual source paths, failure causes and remaining live account/provider/device limits are in [the detailed review](CODE_HEALTH_REVIEW_2026-10-19.md). The README links to this record. This is not a full security audit or a fresh all-eight production submit/review run.
- After reviewing the results, the user explicitly approved publishing exactly these four files to GitHub main. Fresh main still matched the review base immediately before publication. Use one ordinary fast-forward commit, without changing prior history/dates, unrelated source, DB/Secrets/permissions/paid services or repository settings. Unchanged code folders keep their existing last-modified dates. Automatic GitHub-linked builds/deployments are not independent production-flow verification; no manual deployment/promotion is included.
- Final documentation/coach regression: **2 files / 109 tests passed**, exit 0. Fresh GitHub main comparison still matched the original review base. Only the test fixture, README and two review/handoff documents are local changes.
