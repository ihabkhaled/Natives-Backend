# 19 — Security review

- Calendar credentials use 256-bit opaque randomness and digest-only storage.
- Create is permission, membership, team, and season scoped; revoke is
  owner/team scoped.
- Public lookup requires usable credentials plus active team/membership and
  returns one generic error.
- ICS excludes notes, rosters, contacts, attendance, and cancellation reasons.
- Exports and notification audiences are hard bounded.
- Admin endpoints require `jobs.manage`; tests target only the actor.
- No provider secret is exposed by preview, test, metrics, or replay.
- Pino never receives the raw calendar-feed URL credential: the centralized
  request serializer preserves `/calendar/feeds/[Redacted].ics`, and referrer
  headers are censored.

Targeted ESLint security rules completed with zero warnings.
