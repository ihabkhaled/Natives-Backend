# Product requirements

## User stories

- As a member, I can create and revoke my team-scoped calendar feed.
- As a calendar subscriber, I receive stable updates for rescheduled/cancelled visible practices.
- As a member, I receive one notification for relevant participation changes.
- As a user, I can configure quiet hours in my timezone.
- As an administrator, I can preview reminder eligibility and enqueue a safe test notification.
- As an operator, I can inspect delivery/outbox failures without provider credentials or PII.

## Acceptance criteria

- Published, upcoming, no-response, cutoff, reschedule, cancellation, venue-change, and attendance-
  correction policies have named, tested outcomes.
- Feed tokens are opaque, high-entropy, stored only as hashes, scoped to owner/team/optional season,
  expiring, and revocable.
- Feed access rechecks active membership; invalid/revoked/cross-scope credentials reveal no token
  detail.
- ICS uses CRLF, escaped/folded content, UTC instants, stable UID, version-based `SEQUENCE`, and
  cancellation status.
- Feed content excludes practice notes, RSVP/attendance lists, contact fields, and private reasons.
- Notification creation is deduplicated and routed through the transactional outbox.
- Quiet hours suppress non-urgent test/reminder delivery; cancellations explicitly override quiet
  hours.
- Admin preview/test routes require `jobs.manage` and remain team scoped.
- User-visible failures use stable message keys; English/Arabic clients localize those keys.

## Scope boundaries

In scope: backend APIs, database migration, policies, in-app notifications, calendar output,
operational documentation, tests. Out of scope: third-party email/SMS/push vendor onboarding,
mobile OS calendar write APIs, UI implementation, and a production cron platform.
