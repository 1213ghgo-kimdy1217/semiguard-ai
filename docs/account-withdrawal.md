# Account withdrawal

Entry: signed-in header **Account → Delete account**, or the legacy dashboard's account link. `/account` is authenticated and excluded from GA4's page allowlist.

Flow: scope disclosure → acknowledgment + `DELETE` + current password → final cancel-first confirmation → one non-retrying server mutation → sign-out/closed screen only on confirmed success. A passwordless legacy OAuth account needs a newly issued, server-verified sign-in within five minutes. Administrator accounts require operator handover; automatic deletion is blocked.

## Data handling

One transaction inserts a keyed HMAC of the old authentication subject and deletes this account's rows in users, training_attempts, training_drafts, anomaly_logs, product_activity_events, user_onboarding_progress, first_use_feedback, user_stats, social_account_links, chat_feedback, chat_sessions, manual_documents; owned chat_messages/manual_chunks are deleted through parent IDs. Incoming and outgoing data_sharing edges are removed. No caller-supplied user ID is accepted. Any failed statement rolls the whole transaction back.

The separately approved `account_revocations` table contains only `subject_hash` (primary key) and `revoked_at`. The fixed additive DDL in `drizzle/account_revocations.sql` is prepared once per DB handle at first authenticated revocation check; no schema-wide migration runs. Errors fail authentication closed and do not get treated as an empty revocation list. No new credentials or services. Do not rotate JWT_SECRET without planning migration of these digests: they are keyed with that existing secret and a separate domain.

Every non-cron authenticated request checks revocation. Explicit Manus OAuth upserts also check it. Missing local subjects never auto-create from cookies. New local registrations receive a random opaque openId, so reusing a badge cannot restore an old local session. Existing non-revoked sign-ins keep working. Concurrent or already dispatched requests may finish; this does not recall responses already delivered to other tabs/devices.

External file objects cannot be verified deleted with the existing storage API; accounts with a file_key or upload source are blocked for operator cleanup before any account data is removed. Do not bypass by deleting only the document metadata.

Existing self-contained anonymous choice-share links expire at most seven days after issue and cannot be individually revoked by this flow. Copies/downloads, infrastructure logs/backups, already-transmitted external-AI content and account-unlinked browser/GA4 metrics are not claimed erased. Social providers' own accounts/grants are not deleted; only SemiGuard link rows are removed. These limits are disclosed before final acknowledgment.

Only this tab's per-account process/etch drafts are removed. Other devices' local copies must be removed separately. Confirmed deletion clears local auth/cache and sends an identifier-free logout signal to same-browser tabs. All devices' old sessions are refused by the server on their next request.

## Verification limits

Use synthetic in-memory fixtures for transaction/ownership/rollback/session tests. Never delete a real account (including a QA account) without separate action-time approval. Production verification in this change is limited to signed-in availability/status, UI/confirmation cancellation and guest access boundaries. Local tests are not a claim of production end-to-end account deletion.

The signed-in status probe exercises a read-only transaction across all sixteen required stores using `LIMIT 0`; no stored records or database identity are returned by the probes. If any required store is unavailable, submission is disabled rather than silently skipping data.

Before the first real withdrawal, a failed rollout can be reverted while retaining the additive empty table. After real withdrawals, do not roll back to an authentication implementation that ignores revocations; carry the revocation checks forward in any repair release.
