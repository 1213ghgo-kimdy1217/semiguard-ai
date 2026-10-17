# BAZE source and observation-workspace prompt reconciliation

## Source of truth and scope

- Work branch: `feat/eight-process-observation-studio-20261018`, starting at `bc83ddc` on the already-reviewed integration branch. Current main checked at `226484d` (PR #97); no reset to the older PR #92 base.
- Rechecked original ZIP SHA-256: `A24FEDDB046A8265A3A58D837D0C680F81C016F52FA018C9C57A10B82A1DA523`. The user's later prompt describes overlapping BAZE work, not another patch to blindly apply.
- Draft PRs #93–#96 remain unmerged. Their source was already included in the prior integration; no second application, cherry-pick, ZIP overwrite or replacement site.
- Reuse original scenario engines, authored spatial records, answer forms, rule-based evaluation and save/checkpoint/share/AI contracts. New selection state is UI-only. No physical geometry is inferred from teaching indices.

## Comparison and actual delta

| Process | Existing BAZE work kept | Missing connection/layout supplemented |
| --- | --- | --- |
| Wafer | Nine-region maps, surface/thickness, A3 submission trace | Selected-region record bands; exact numeric table and substrate background remain accessible disclosures |
| Oxidation | Group A/B matching-reference tool and original gauges | Fixed oxide concept beside comparison; selectors remain before evidence and warn on mismatched reference |
| Photo | Original pattern frames, pin, overlay, position/shape | Keep pattern comparison central; exposure background moves into its limits disclosure |
| Etch | Original 180-second engine, phases, four sensors | One controlled signal for concept and chart, including a separate view-only review signal; selection pauses playback |
| Deposition/implantation | Two separate inspection concepts and original evidence classifier | Card selection/highlight follows chart signal; no additional score or classifier state in AI/save payloads |
| Metal | Original six-second windows, row navigation, connection/appearance | Concept perspective and chart share signal; observed discrete band symbols make recurrence visible without physical defect animation |
| EDS | Original observed-only A/B/C map, probe concept, rewind fallback | Selected region's exact original die/comparison markers beside close-up; map interaction pauses playback; replay region distinguished from map selection |
| Packaging | Fixed wire-bond concept, observed pin, connection exits/returns | Connection/appearance perspective linked to chart; both records share a fixed 80–120 teaching-index scale; connection history remains separately labelled |

Common layout: playback and time selection precede the process tool; optional full graph, chosen-moment comparison and exact numeric evidence remain available below. Discovery-marker actions remain a native disclosure, separate from observation-time selection and comparison pins. Existing green/teal palette, focus and non-color cues are preserved. No new dependencies.

## Verification and release

Final executed checks, screenshots, browser coverage and remaining limits are recorded in [HANDOFF.md](HANDOFF.md). Historical upstream NOT RUN statements in [EIGHT_PROCESS_REVIEW.md](EIGHT_PROCESS_REVIEW.md) refer to its original source environment, not this branch.

No main merge or public deployment. No production DB, Secrets, permission, billing or repository settings changes. Local browser checks use the actual bundle with a synthetic identity and memory-only RPC; they do not establish production persistence, live OAuth, cross-device resume or provider AI quality.
