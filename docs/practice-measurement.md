# Optional practice measurement

This is product-use measurement, not model accuracy, educational-effectiveness or fab-performance evidence. Account practice records and their privacy boundary remain separate.

## Consent and collected fields

- Default OFF. Declining does not prevent preview, sign-in or authenticated practice.
- Consent is offered on the introduction, sample and practice screens. It is never prechecked.
- A signed, HTTP-only, SameSite=Lax cookie holds a random browser identifier for 30 days. No identifier is chosen by the client.
- The approved `practice_activity_events` table stores only an auto-increment row ID, random participant ID, one of three event types, and the server timestamp. It contains no account ID, name, contact information or written answers.
- Withdrawal clears the cookie and stops new/queued collection. Existing events remain for aggregation. Other tabs receive a minimal versioned localStorage consent-change signal; the cookie remains the server authority. No identity or answer is written to localStorage by this feature.
- These are **consenting browser identifiers**, not unique people. Shared browsers can undercount; other devices, cleared cookies and renewed consent can overcount. Actual participants must be verified separately.

## Event definitions

1. `visit`: a consenting browser enters an introduction, preview, login or practice screen. History, sharing and dashboard views do not generate this practice visit event.
2. `practice_started`: authenticated practice actually begins playing while consent is enabled, including resuming an unfinished practice. No briefing-card click is treated as a start.
3. `practice_completed`: a fresh start in this mounted practice session is followed by submission and display of the review. Merely restoring an already-submitted result is not a completion. AI response and account-save success are separate outcomes, not implied by this event.

Insertion is best-effort deduplicated per browser/event/KST day; concurrent requests may create duplicate rows. All reports count DISTINCT browser IDs, not requests or row totals. Completion writes require a recent start (within six hours). The existing schema has no new uniqueness constraint and is not changed by this application.

## Report definitions

`/training/metrics` is an administrator report, enforced by the server, with aggregate numbers only. Team/test consent creates an identifier with a separate prefix. It is excluded from participant metrics and shown separately for QA checks. This exclusion is self-declared, not anti-fraud verification.

- Date selection is 1–31 inclusive days in Asia/Seoul.
- Visit, start and completion counts are distinct browsers in the selected period. Completion requires a preceding start in the same selected period, so it does not exceed the start count. Events need not belong to the same particular exercise; the approved table intentionally has no exercise or attempt ID.
- Start-to-completion ratio is completions divided by starts; no denominator means unmeasured, not 0%.
- Week-one cohort: first-ever measured practice start in the seven days beginning on the selected start date. Week-two return: another measured practice start in the following seven days. This is a fixed 14-day window anchored to the start date, independent of the selected end date. The final return percentage remains unmeasured until week two has ended.
- No historical backfill from account answers or estimated/fabricated visitors is performed.

## Deployment safety

The additive DDL is recorded in `drizzle/0019_practice_activity_events.sql`. The operator reported applying it on 2026-10-09. No migration is automatically executed during application startup or deployment. The runtime checks its own DB connection's exact columns, defaults and indexes before consent activation, writes or reports. An absent/incompatible table fails closed without blocking core practice or exposing connection details.

Verify production readiness and QA events after deployment; local mocks and the operator's report do not prove the Vercel production DB is ready. Use team/test mode for verification and withdraw after testing. Do not report QA browser counts as recruited users or the W5 target of actual users.
