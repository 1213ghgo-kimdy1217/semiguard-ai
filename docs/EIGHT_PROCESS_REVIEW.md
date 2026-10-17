# Eight-process source review / Codex acceptance checklist

> This is the supplied upstream acceptance checklist. Its original NOT EXECUTED statements describe that source handoff, not the later integration run. Current executed results and remaining external checks are in [EIGHT_PROCESS_VALIDATION.md](EIGHT_PROCESS_VALIDATION.md).

This is a local integration based on main 6b01414. Existing source read for all eight exercises. NOT an executed software validation, not a physical-process simulation and not an eight-process completion certificate.

| Process | Retained task | Implemented visual/context | Codex checks required |
|---|---|---|---|
| Wafer | Nine-region surface/thickness maps and A3 trace | Substrate-inspection concept, explicit limited scope | Region buttons, surface/thickness selection, onset/rewind, no future map, answer save |
| Oxidation | Matching-group reference selector | Silicon-surface oxide concept, not deposition or measured thickness | A/B reference changes, wrong-reference exploration, no false abnormality, callback pause |
| Photo | Pattern overlay, position/shape and pinned frame | Mask/exposure/resist concept separate from inspection frames | Pin cap, overlay, position/shape, before/during/after, 32/45 boundaries |
| Etch | Full 180s multi-sensor engine and phase baselines | Chamber/observation-location selector in observation/review | 39/40/69/70 boundaries, same-phase baseline, 180s cap, sensor labels, no new answer state |
| Deposition/implantation | Separate inspection evidence sorter | Separate process concepts + selected sample gauges; numeric disclosures | 47/48 boundary, classifier exact claims/feedback, pause, separate-purpose records, no physical thickness inference |
| Metal | Six-second recurrence board and exact interval records | Path/via/dielectric vs surface perspective | 42/48/54 recurrence, interval/row callbacks, original board retained, not physical defect locating |
| EDS | Region-specific die and separate comparison records | Conceptual wafer grid/probe pads, observed-only A/B/C selection | 29/30/59/60, selection fallback on rewind, no chip-pass/fail map or yield inference |
| Packaging | Original connection/appearance and post-submit review | Conceptual package plus observed pinned/current comparison | 50/56/70/82 distinctions, pin horizon/rewind, no cause-resolution claim, appearance remains separate |

Wafer/oxidation/photo originally already had distinct functional observation tools; preserved rather than rebuilt. New explanatory diagrams do NOT imply dynamic process outcomes or replace those tools. Etch/metal diagram controls are local viewing-only and do not control existing playback/chart selection. ALL stateful behavior above is pending actual tests, not reported as passing.

## Codex steps
1. Apply to specified pinned base or inspect current-main diff first; do not reset newer work. Create an integration branch. No main merge or production release without user approval.
2. Review changed files and all archived branch handoffs. Run pnpm check -> pnpm test -> pnpm build. Record actual command outputs/counts; earlier 345 files/1571 tests is historical, not an expected forced count.
3. Existing tests may make markup assumptions; inspect actual failures before changes, do not delete safeguards to force pass. Verify React SSR tests and real stateful interactions separately.
4. Real browser at 320/390px and desktop: keyboard/focus, selected/pinned horizons, native disclosures, disabled unobserved region, language changes, time-reset behavior. Static previews are NOT test evidence.
5. All eight submit/rule-feedback/login/account-save/retry/checkpoint/resume/history/share/ownership paths; optional AI consent, bounded context, unsupported-cause wording, evidence references, language/privacy/failure behavior. Local viewing choices not added to AI payloads.
6. Learner feedback, honest limits, README/AI_USAGE/HANDOFF/demo/attribution/license consistency. No actual fab/learning-performance claims from synthetic tests.

No dependencies, DB/schema/credentials/settings modified. TypeScript, Vitest, build, browser, live provider and account flows NOT EXECUTED in this environment. Earlier pnpm was unavailable. No new CI or paid execution environment. Remote PRs #93–#96 remain separate; THIS combined local revision has no commit/PR until pushed through the connected account. No merge/deployment performed.
