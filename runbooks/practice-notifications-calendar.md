# Practice notification and calendar operations

## Inspect

1. Check `GET /admin/outbox/metrics` with `jobs.manage`.
2. Preview one session's reminders before dispatching.
3. Confirm the session is published/rescheduled and active membership is within
   the 1,000-recipient safety bound.
4. Use the self-targeted test endpoint. `quiet_hours` is policy behavior, not a
   provider failure.

Never place provider credentials, feed bearer tokens, RSVP notes, player lists,
or contact data in tickets or logs.

## Replay

Replay only a dead-lettered event after fixing its cause. The worker uses bounded
batches, capped retry backoff, and failure records without provider secrets.
Notification insertion is dedupe-safe, including repeated reminder dispatch for
an unchanged session version.

## Calendar incident

1. Revoke the affected feed by owner/team/feed id.
2. Verify the old URL returns the generic unavailable response.
3. Issue a replacement through an approved private channel.
4. Do not try to recover the raw token from storage; only digests exist.

## Rollback

Application rollback can leave the additive tables. Reverting migration
`1722200000000-practice-reminders-calendar-schema` drops new quiet-hour settings
and calendar credentials, so schema rollback is destructive to those new values.
