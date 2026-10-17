# Etch / metal concept draft — incomplete integration

Branch: feat/etch-metal-process-concepts, created from main 6b01414fa417c90e11b6d15aa6c5622162f49d7c. Latest main workspace read and branch creation both confirm that base. No reset/revert. Separate from EDS #93, packaging #94 and deposition #95.

## Remote source implemented
EtchChamberConcept.tsx: observed-cap etchEvidence, same-phase baseline, four native observation-location buttons, conceptual chamber. No fault-location/depth inference. MetalLayerConcept.tsx: local connection/surface perspective, original selected metal sample, path/via/dielectric concept. Highlights are perspectives not defects. process-concepts.css: responsive/focus rules. server/process-concepts-regression.test.ts authored, NOT RUN.

IMPORTANT: these components are NOT mounted in the remote application yet. Existing EtchTraining.tsx / ProcessEvidenceWorkspaces.tsx are unchanged on this branch. Local integration patch from prior turn contains those mounts; do not describe remote screen as integrated. Apply/review integration next, retaining original etch engine and full recurrence board. Local patch source-preservation assertions previously passed, not compilation proof.

## Actual checks
Existing etchSignalName(language, signal) signature and etchEvidence(time, observedUntil) observed-time clamp read from original source. Main workspace retrieved again. Earlier Python formula mirrors/source reversal assertions passed for local integration. Those are NOT actual TypeScript/Vitest/browser tests.
Earlier pnpm check -> pnpm test -> pnpm build attempts failed to start (pnpm missing); these component tests/build NOT EXECUTED. No runtime/CI/paid service installed. No browser/stateful/keyboard/320/390px checks. No account submit/save/resume/share/AI calls validated. No historical test totals reused.

## Preserved and release
No original engine/scenario/answers/scoring/account/save/resume/share/AI/API/dependencies/DB/secrets/settings changed. No merge or production deployment. Hosting may automatically create previews; status unverified, protected access not bypassed.
Commit/PR links to be recorded after GitHub returns identifiers. Current file travels with source commit; GitHub commit history records it.

## Next
Mount etch with shownTime/attempt.elapsed in observation and reviewTime/attempt.elapsed in review. Mount metal with existing bounded view.selectedTime before original recurrence board. Preserve both deposition and metal additions when combining #95; preserve both EDS and packaging context mounts when combining #93/#94. Run check -> full tests -> production build in approved existing runtime, then keyboard/narrow/no-future/rewind/phase checks. Core regression, AI consent/evidence/uncertainty/failure/privacy, representative learner feedback, README/AI_USAGE/licenses/demo reconciliation remain. User approval after verification required before merge/deploy.
