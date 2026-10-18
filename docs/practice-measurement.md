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

`/training/metrics` is a read-only aggregate report, enforced by the server. Administrators retain access; one separately approved account can be configured for aggregate reads without becoming an administrator. Team/test consent creates an identifier with a separate prefix. It is excluded from participant metrics and shown separately for QA checks. This exclusion is self-declared, not anti-fraud verification.

- Date selection is 1–31 inclusive days in Asia/Seoul.
- Visit, start and completion counts are distinct browsers in the selected period. Completion requires a preceding start in the same selected period, so it does not exceed the start count. Events need not belong to the same particular exercise; the approved table intentionally has no exercise or attempt ID.
- Start-to-completion ratio is completions divided by starts; no denominator means unmeasured, not 0%.
- Week-one cohort: first-ever measured practice start in the seven days beginning on the selected start date. Week-two return: another measured practice start in the following seven days. This is a fixed 14-day window anchored to the start date, independent of the selected end date. The final return percentage remains unmeasured until week two has ended.
- No historical backfill from account answers or estimated/fabricated visitors is performed.

## Deployment safety

Signed-in QA users can manually read only their own signed QA browser's three event-presence flags for the current KST day. This is not a report of other browsers; server-side filtering uses the cookie's ID and accepts no caller-chosen ID. Global aggregate reports require administrator or separately approved aggregate-reader access. No administrator role is granted for verification.

The additive DDL is recorded in `drizzle/0019_practice_activity_events.sql`. The operator reported applying it on 2026-10-09. No migration is automatically executed during application startup or deployment. The runtime checks its own DB connection's exact columns, defaults and indexes before consent activation, writes or reports. An absent/incompatible table fails closed without blocking core practice or exposing connection details.

Verify production readiness and QA events after deployment; local mocks and the operator's report do not prove the Vercel production DB is ready. Use team/test mode for verification and withdraw after testing. Do not report QA browser counts as recruited users or the W5 target of actual users.

## Optional single-account aggregate reader

- Server-only `PRACTICE_METRICS_READER_USER_ID` defaults to empty: **no additional account is authorized**. Do not add a `VITE_` prefix, ship it in the browser, log its value, or put a real account identifier in Git.
- It accepts one exact canonical positive MySQL `users.id` (up to 2147483647). Lists, wildcards, whitespace, leading zeroes and malformed values fail closed. Names, emails, client input, URL parameters and request headers do not determine access.
- `practiceMeasurement.access` reveals only `authenticated` / `canRead` booleans, never the configured identifier. The frontend waits for a successful permission check before querying storage/report data. Loading, denial and lookup errors hide cached figures. `practiceMeasurement.report` independently rechecks permission on **every request**, including direct API calls.
- This capability grants only the existing aggregate response: counts, QA counts, cohort maturity and reporting dates. It does not expose names, answers, browser identifiers or individual records, and it does not permit global threshold changes, other administrator reports or account administration. Existing account-scoped record permissions and `users.role` are unchanged.
- Activation is a separate, approval-gated operation: first verify the intended existing account's server-authenticated numeric ID (do not infer it from a name or GitHub ownership), obtain approval for that account and the deployment, then configure the single server-side value only in the approved environment. Do not repurpose `OWNER_OPEN_ID` or update `users.role`.
- Changing a deployment environment value requires a new deployment to take effect. Revocation: clear this setting and deploy the approved removal, then confirm the former reader gets `canRead: false` and report `FORBIDDEN`. Administrators remain authorized by their existing role. Until removal is actually deployed, existing deployments retain their configuration; cached local results are not proof of revocation.
- Verify an allowed reader, a different ordinary account and a guest in the approved environment. Local synthetic tests do not activate access, prove a real identity, or verify production data. This change does not backfill events or convert consenting-browser counts into people or self-reported reuse into measured retention.
