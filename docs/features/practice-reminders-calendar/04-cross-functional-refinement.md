# Cross-functional refinement

- Product: feed entries must stay useful without exposing notes or rosters.
- Engineering: extend practices and platform owners; no direct vendor or cross-module internal
  imports.
- QA: parse ICS structure and prove UID/sequence/cancel updates, revocation, scope, dedupe, quiet
  hours, and retry/dead-letter behavior.
- Security: feed URLs are bearer credentials; hash at rest, never log or return after creation.
- Operations: existing outbox metrics/replay remain the failure surface; preview/test responses are
  safe summaries.
- Support: publish token-revocation and outbox replay steps.
- Analytics: no product analytics event is added; outbox state and delivery records are sufficient
  operational evidence for this slice.
- Localization: notification copy remains i18n keys and safe scalar params.

Decision: urgent cancellation bypasses quiet hours because avoiding a missed cancellation is the
safer outcome. No provider secret is needed for the in-app channel.
