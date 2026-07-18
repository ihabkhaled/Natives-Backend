# Practice reminders and calendar feeds

## Notification matrix

| Fact                            | Audience               | Preference          | Quiet hours                                                                 | Dedupe                                                |
| ------------------------------- | ---------------------- | ------------------- | --------------------------------------------------------------------------- | ----------------------------------------------------- |
| Practice published              | Active team users      | Practice / in-app   | In-app is non-intrusive; retained in inbox                                  | Event type + aggregate + occurred instant + recipient |
| Practice rescheduled            | Active team users      | Practice / in-app   | In-app is non-intrusive; retained in inbox                                  | Event type + aggregate + occurred instant + recipient |
| Practice cancelled              | Active team users      | Practice / in-app   | Urgent override is reserved for future push/email; in-app remains available | Event type + aggregate + occurred instant + recipient |
| Venue changed on a live session | Active team users      | Practice / in-app   | In-app is non-intrusive                                                     | Event type + aggregate + occurred instant + recipient |
| Upcoming / no response / cutoff | Active session members | Practice / in-app   | Test delivery reports quiet-hour suppression                                | Event type + session version + recipient              |
| Attendance corrected            | Affected member        | Attendance / in-app | In-app is non-intrusive                                                     | Event type + aggregate + occurred instant + recipient |

Team fanout and reminder candidates are keyset-paginated in pages of 100 and
capped at 1,000 active recipients per event. A larger audience requires an
explicit segmentation decision; it never triggers an unbounded query.

## Calendar-feed privacy

- Feed creation requires authentication, `practice.read`, active team
  membership, and validates optional season scope.
- The 256-bit bearer token is returned once. Only its SHA-256 digest is stored.
- HTTP request logs preserve the route as `/calendar/feeds/[Redacted].ics`;
  the raw token and request referrer are censored before pino writes the record.
- Revocation is owner/team scoped.
- Rendering returns the same generic not-found response for unknown, expired,
  revoked, inactive-team, inactive-membership, and cross-scope tokens.
- Feeds contain only bounded published, rescheduled, or cancelled team/public
  sessions.
- ICS includes session type, public field, times, status, stable UID, and version
  sequence. It excludes notes, RSVP details, player lists, attendance,
  cancellation reasons, email, and phone data.
- UTC instants use RFC `DATE-TIME`; `X-WR-TIMEZONE` records the selected IANA
  timezone.

Treat a subscription URL as a secret. Revoke it after suspected disclosure and
issue a replacement.

## Reminder operations

The `jobs.manage` endpoints provide preview, self-targeted test, and dispatch.
Test delivery reports `quiet_hours` without provider details. Dispatch writes due
facts to the transactional outbox; repeated dispatch for the same session version
is notification-deduped. Failure counts and replay remain under `/admin/outbox`.
