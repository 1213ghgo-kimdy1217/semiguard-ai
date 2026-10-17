# Eight-process integration verification — 2026-10-17

## Scope and base

Existing SemiGuard application, not a new site. Branch `integrate/eight-process-review-20261017` is based on freshly fetched main `226484d20412e2e4a236be3879cf82c67b201e3e` (PR #97), preserving the measurement-choice and five-record history work.

Compared the user-supplied ZIP against its exact PR #92 base `6b01414fa417c90e11b6d15aa6c5622162f49d7c`, then applied its 38-file delta selectively. No blind ZIP overwrite or draft-PR cherry-pick. Drafts #93–96 remain unmerged. The supplied competing handoff is [archived](source-handoffs/integrated-local--HANDOFF.md); the supplied [checklist](EIGHT_PROCESS_REVIEW.md) and [original static validation metadata](LOCAL_VALIDATION.json) are historical inputs.

## Actual execution

Existing Node v24.19.0 and pnpm 10.18.0; no dependency installation, lockfile or project configuration change. The process-only setting `npm_config_manage_package_manager_versions=false` avoids pnpm's failed automatic tool-version installation. Node's existing bin directory was prepended only to the command process's PATH.

Executed, in order:

1. `node node_modules/pnpm/bin/pnpm.cjs check` — `tsc --noEmit`, **exit 0**.
2. `node node_modules/pnpm/bin/pnpm.cjs test --maxWorkers 2 --minWorkers 2 --no-cache` — **357 files, 1,675 tests passed**, exit 0 (final run, 126.14 seconds).
3. `node node_modules/pnpm/bin/pnpm.cjs build` — Vite production client + both esbuild server bundles, **exit 0** (Vite 18.05 seconds).

Build still reports the existing >500 kB chunk warning. No Vite `manualChunks` or warning threshold change. Test stderr includes deliberate provider/auth failure cases and absent local OAuth configuration; this does not verify live OAuth, DB or provider availability.

Initial integrated run exposed four failures: three whole-document button-count assertions became invalid after adding an independent metal perspective group, and an archived packaging handoff link was broken. Fixed the link; retained all original interval/detail button checks and added separate single-selection assertions for both groups. No tests or guards deleted. First successful run before the navigation fix was 357 files / 1,674 tests; the final added regression makes **1,675**, not historical PR #92/#97 totals.

Browser-discovered navigation defect: photo review's “Next process · Etch” returned to the generic chooser. Its next link now uses the existing `/training/etch` route; other links still use `scenarioHref`. Added a regression requiring the existing direct briefing route and unchanged submission contract.

Logs and screenshots are local verification artifacts outside the repository under `work/verification-artifacts/`, including `eight-process-integration-final-vitest-20261017.log` and `eight-process-integration-final-build-20261017.log`. They are not production evidence.

## Browser verification boundary

Edge renders the actual production bundle at loopback port 5198. An external-to-repository synthetic QA fixture supplies `auth.me` and memory-only RPCs, validating submissions/checkpoints with the original `toTrainingRecord` / `trainingDraftSchema`. It does not connect a production account, DB, AI provider or analytics service. No auth bypass or fixture is included in application source/deployment. Selected model-failure responses are intentionally simulated, never represented as generated coaching.

The fixture deliberately has no external OGQ service. The generic chooser initially produced a fixture-only `learning.guide` unsupported-operation error; it is not a production error or evidence about OGQ availability. Full device verification means desktop Edge CSS viewport overrides, **not physical iPhone/tablet verification**.

### Actual route checks

| Process | Executed local UI checks | Status |
|---|---|---|
| Wafer | 9-region map, A3 selection, rewind to 35s, temporary pause; save/load 54s checkpoint; incomplete 87s submission blocked; complete submission and 25s review jump; keyboard visible focus; ko/en/ja; 320/390px | Passed in local fixture |
| Oxidation | A/B reference, wrong earlier-A reference warning; rewind 29/30s disables unavailable comparison; correct matching reference; no-deviation answer submission/review; ko/en/ja; 320/390px | Passed in local fixture |
| Photo | Mask/resist explanation; 32s pin, overlay off/on, 45s return comparison; complete submission/review; ko/en/ja; 320/390px; final-build next link `/training/etch` enters the existing etch session rather than the chooser | Passed in local fixture |
| Etch | Original 180s real-time observation cap and four sensors, independent conceptual location selection; submission/review; keyboard review positions 39/40/69/70s show phase A/B and appropriate 76–84 / 96–104 references; ko/en/ja; 320/390px, visible keyboard focus | Passed in local fixture |
| Deposition/implantation | Keyboard concept selector; separate inspection cards; 47s in-band / 48s film deviation; exact-value disclosure; evidence classifier and actual playback pause at 1s; complete submission/review; retry confirmation preserves completed record; ko/en/ja; 320/390px | Passed in local fixture |
| Metal | Independent perspective and interval single-selection groups; original interval/detail tools retained; 42/48/54s connection recurrence versus separate appearance; record callbacks; fresh-retry interval selection pauses at 0s with only the observed interval; complete submission/review; ko/en/ja; 320/390px | Passed in local fixture |
| EDS | Initially B/C disabled; 29/30 and 59/60s row horizons; choose C then rewind to 59s falls back to B, rewind to 29s falls back to A with no C result; keyboard B selection; complete submission/review; ko/en/ja; 320/390px | Passed in local fixture |
| Packaging | Initial future exit/return results hidden; 50s trend still inside, first exit 56s, 70s toward reference but still outside, first return 82s; pin then rewind clamps both pin/max to 50s; complete submission/review; ko/en/ja; 320/390px | Passed in local fixture |

The selected-time and perspective controls remain view-only. The etch observation slider selects a **discovery marker position**, not the displayed chamber record; exact rewind checks were therefore performed with its existing decision/review controls. No new answer or score state was added for diagrams.

RPC fixture read-back confirmed **eight distinct completed scenarios / eight save calls**, one wafer checkpoint save, and one deliberately simulated unavailable-coach response. Retries did not remove saved attempts. The original history UI displayed page 1 with five records, page 2 with three, and a saved wafer detail page with its original choices, timeline and consent-gated share button. **No share link was created.** This validates the client flow and original serialization helpers, not production persistence or real identity separation.

The checkpoint request contains only `version`, `scenarioId`, `elapsed`, `marker`, `stage`, `signal`, `onset`, `comparison`, `certainty`; no prose. All eight save requests passed the unchanged `toTrainingRecord` helper in the fixture. The coach's unavailable state showed the explicit failure message and retained criteria/review rather than inventing a generated answer. No external model request was sent.

No horizontal document overflow was observed at either tested CSS viewport width for any process. The existing metal numeric table overflows **inside its focusable scroll region** (about 480px content within 213px at 320px), not the document. Native buttons/range inputs and visible focus were exercised; this is not an exhaustive screen-reader audit. Saved screenshots include wafer map (390px), etch chamber, deposition cards, EDS controls and packaging (320px). Temporary browser viewport override is reset after checks.

Language content was sampled in all three languages for each exercise, and each exercise was inspected at both widths. This was not an exhaustive Cartesian matrix of every language, viewport and interaction state.

Final browser checks after rebuilding used a reloaded page; the earlier observation/rewind runs for unchanged components were also made on a real production bundle. No local success is represented as a deployed production success.

## External checks not claimed

- Real fresh login/social-provider callback, production save/read-back, cross-device checkpoint persistence, production retry/share and actual NVIDIA coaching: **not verified by the local fixture**.
- Protected Vercel preview: **not accessed**, no bypass/token links generated.
- Main merge / public deployment: **not performed and requires user approval after results**.
- No DB/schema, Secrets, permissions, paid services or repository settings changed; no user data sent to external AI.
- Synthetic education and choice-based rule matching remain distinct from optional AI explanation. No real equipment control, fault confirmation, fab-performance or learning-effect validation is claimed.
