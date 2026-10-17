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
