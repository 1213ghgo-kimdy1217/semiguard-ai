# Google Analytics: optional, separate measurement

GA4 property and web stream were created on 2026-10-16 with the owner's explicit approval, including the displayed terms. The public measurement ID is `G-QRC8S79SK3`; it is not an API secret. Enhanced Measurement is OFF in the stream. No measurement protocol password, paid integration, database migration or role change is needed.

## Consent and data boundary

- OFF by default. Existing first-party `practice_activity_events` consent does **not** enable Google Analytics.
- A separate footer explains Google LLC processing, cookie/technical information, the purpose, withdrawal and optional access. All choices are unticked. The service works identically when declined.
- Consent is stored locally for at most 30 days. Only the canonical production origin loads the tag, after opt-in. Local and Vercel preview origins do not transmit.
- On 2026-10-16 the owner separately approved reducing user-level retention to two months and disabling renewal on new activity. The GA4 settings were saved with event and user retention both at two months; aggregate reports are not governed by that retention setting.
- The app sets safe fixed titles/URLs and an empty referrer. Only exact public route names are accepted. History IDs, shared tokens, admin pages, unknown paths and auth callbacks are excluded. On those routes the Google disable flag is set.
- No names, email, account IDs, answers, AI conversations, sensor/CSV contents or record/share identifiers are sent by the application.
- Google also processes standard session events, pseudonymous browser cookies and connection metadata. This is **not fully anonymous** measurement and does not identify unique people.
- Advertising storage/data/personalization are denied. Google Signals and advertising personalization are disabled in tag configuration. No advertising accounts or connected-site tags are added.
- Withdrawing disables the tag immediately, discards pending app commands and clears host-only `_ga` cookies. Other tabs observe storage changes; tracking also rechecks consent before each app event. Previously transmitted events are not retroactively deleted. The current request already in flight cannot be recalled.
- The dedicated `semiguardGaLayer` avoids collecting unrelated application data. Google’s external code remains a third-party dependency; content blockers/network errors can prevent reception. No retries or synthetic fallback successes are generated.

## Events and metrics

- `page_view`: one per distinct accepted SPA page, only after consent; automatic page views are disabled to avoid double counting.
- `sg_practice_start`: actual new observation playback in 8-process practice.
- `sg_practice_complete`: review after a fresh start and new submission. Restored old results do not count. This is not AI-coaching success or proof of account-save success.
- Return use is derived from later observed practice events, not fabricated/backfilled. Existing own-log counts and GA4 active/returning-user definitions must be reported separately.
- Only published campaign constants are retained (`school`, `instagram`, `youtube`, `naver_blog`; campaign `pilot_20261016`). Arbitrary UTM values are replaced, not forwarded.

QA/team opt-in adds `debug_mode: true` and `traffic_type: internal`. Before reporting participant metrics, exclude these records using a verified active developer/internal data filter or an explicit report filter. Merely setting a parameter does not prove a filter is active. QA events and actual recruited users must never be combined.

## Verification and release

Run TypeScript, full Vitest and the production build in that order. Then verify on the canonical site: default/decline, explicit QA opt-in, actual GA DebugView reception, fresh practice start and completion, no new events after withdrawal. The owner declined access to protected Vercel previews; do not bypass their protection. Keep local checks, deployment readiness, actual receiving and user results as distinct statuses. No historic users/retention should be invented from this setup.

Official references: [configuration](https://developers.google.com/analytics/devguides/collection/ga4/reference/config), [disable/privacy controls](https://developers.google.com/tag-platform/security/guides/privacy), [SPA measurement](https://developers.google.com/analytics/devguides/collection/ga4/single-page-applications), [Google processing information](https://policies.google.com/technologies/partner-sites).
