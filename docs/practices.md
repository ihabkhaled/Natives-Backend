# Practices — schedules, recurrence, sessions, venues, and cancellations

Ultimate Natives plans practices as **recurring (or one-off) schedule templates** from
which **stable, concrete session instances** are generated. A template is _not_ a
session: it captures the cadence, defaults, and a bounded generation horizon; the
sessions it produces are historical facts that survive template edits, timezone
changes, and cancellations. This module owns the practice planning surface so
downstream modules (RSVP, attendance, drills, reminders) can reference **stable session
IDs** and their persisted **UTC instants**.

Prompt: `200-practice-schedules-recurrence-sessions-venues-and-cancellations`. Builds on
103 (teams/seasons/venues), 104 (members), and 105 (platform audit + outbox).

## 1. Aggregates and tables

Migration `src/database/migrations/1721800000000-practices-schema.ts` (reversible;
proven from-empty in `test/database/practices.integration.spec.ts`):

- `practice_schedules` — the recurring/one-off template. Recurrence
  (`frequency` = `weekly|one_off`, `interval_weeks`, `weekdays int[]` where
  `0=Sunday … 6=Saturday`), a **local** `start_time_local` (`HH:MM`) + `duration_minutes`
  interpreted in an explicit `timezone` (default `Africa/Cairo`), optional
  `meet_offset_minutes` / `rsvp_cutoff_minutes` (**null-not-zero**: absent stays null),
  defaults (`default_venue_id`, `default_field`, `default_capacity`, `visibility`,
  `organizer_user_id`, `notes`), a bounded horizon (`generation_start`/`generation_until`
  date-only, `CHECK (until >= start)`), `exceptions text[]` (excluded local dates),
  `status` (`active|archived`), actor audit, optimistic `version`.
- `practice_sessions` — a concrete occurrence. UTC `meet_at`/`starts_at`/`ends_at`/
  `rsvp_cutoff_at` timestamptz (`CHECK (ends_at >= starts_at)`), venue/field/capacity,
  visibility, organizer, `status`
  (`draft|published|rescheduled|cancelled|completed|archived`), `cancellation_reason`,
  actor audit, optimistic `version`. A **generated** occurrence carries its
  `schedule_id` + local `occurrence_date`; a **one-off** carries neither. A partial
  unique index `(schedule_id, occurrence_date) WHERE schedule_id IS NOT NULL` makes
  generation idempotent.
- `practice_session_status_events` — append-only publish/reschedule/cancel/reopen
  history (never updated or deleted).

## 2. Recurrence ownership (Cairo-time → UTC)

Recurrence is authored in **local wall-clock time** in the schedule timezone (Cairo by
default) and persisted as **unambiguous UTC instants**. The conversion
(`src/modules/practices/lib/cairo-time.ts`) uses the platform ICU database via
`Intl.DateTimeFormat`, with a two-pass offset correction so instants near a DST change
resolve to the offset that actually applies — Egypt observes DST (last Friday of April →
last Thursday of October).

Cairo examples (golden, `cairo-time.spec.ts` / `practices.helpers.spec.ts`):

| Local (Africa/Cairo)      | Offset | Stored UTC instant         |
| ------------------------- | ------ | -------------------------- |
| `2026-01-15 18:00` (win.) | +02:00 | `2026-01-15T16:00:00.000Z` |
| `2026-07-15 18:00` (sum.) | +03:00 | `2026-07-15T15:00:00.000Z` |

A calendar date's **weekday** is timezone-independent, so weekly expansion
(`domain/recurrence.policy.ts`) stays pure; only the per-occurrence _instant_ depends on
the timezone.

## 3. Generation (idempotent, stable instances)

`POST /teams/:teamId/practice-schedules/:scheduleId/generate` expands the recurrence
over the horizon (bounded by `MAX_HORIZON_DAYS` and `MAX_GENERATED_OCCURRENCES`) and
inserts **only the occurrences that do not yet exist** (by `occurrence_date`), via
`INSERT … ON CONFLICT DO NOTHING`. It never updates an existing session. Consequences:

- **Idempotent** — re-running generates nothing new (`created: 0`).
- **Template edits do not rewrite past sessions** — editing a schedule and regenerating
  only adds new future occurrences; existing instances keep their originally computed
  instants.
- **Timezone / exception edits** — apply to newly generated occurrences only.
- **Duplicate retries** — the partial unique index makes a concurrent/duplicate insert a
  no-op (counted as `skipped`).

Generated sessions are created **published**; one-off sessions are created **draft** and
published explicitly.

## 4. Lifecycle and cancellation semantics

Status transitions are governed by the pure state machine
(`domain/practice-session.state-machine.ts`):

```
draft      → published | cancelled | archived
published  → rescheduled | cancelled | completed | archived
rescheduled→ cancelled | completed | archived
cancelled  → published (re-open) | archived
completed  → archived
archived   → (terminal)
```

- **Reschedule** moves a published/rescheduled session's times and/or venue and marks it
  `rescheduled` (a re-affirming self-status, so it is allowed even from `rescheduled`).
- **Cancellation never deletes RSVP or attendance history** — it is a status change that
  records a reason. Rows that later reference this session (RSVP, attendance) remain
  intact; re-opening clears the cancellation reason.
- A **completed** session is locked; corrections happen through the audited attendance
  workflow (module 202), not by editing the session.

Every transition appends an immutable status-history row and an audit row; **publish**,
**cancel**, and **reschedule** additionally enqueue a versioned domain event
(`practice.published` / `practice.cancelled` / `practice.rescheduled`, the last also
carrying a venue change) to the platform transactional outbox.

## 5. Endpoints and authorization

All routes are team-scoped under `/api/v1/teams/:teamId/…` and enforce
authentication + permission + team-scope + optimistic version. Reads require
`practice.read`; writes require `practice.manage` (Coach/Team-Admin bundles).

- Schedules: `POST|GET /practice-schedules`, `GET|PATCH|DELETE /practice-schedules/:id`,
  `POST /practice-schedules/:id/generate`.
- Sessions: `POST|GET /practice-sessions`, `GET /practice-sessions/:id`,
  `GET /practice-sessions/:id/history`, `PATCH /practice-sessions/:id`,
  `POST /practice-sessions/:id/{publish,reschedule,cancel,reopen}`.

The calendar/list is bounded, paginated, and deterministically ordered by start instant,
with allowlisted filters (`from`, `to`, `status`, `sessionType`, `seasonId`).

## 6. Session types

Session type is a free-form catalog string (`practice`, `fitness`, `scrimmage`/`game`,
`throwing`, `running`, `gym`, `rules`, or custom) — **no points are hard-coded** here;
scoring inputs are the concern of later modules.

## 7. Tests

- Unit: state machine + recurrence expansion (100% branches), Cairo-time golden
  conversions (DST boundaries), helpers, and every use-case/service with mocked ports.
- Integration (`test/database/practices.integration.spec.ts`, real PostgreSQL):
  migrate-from-empty + reversible down, array/calendar column round-trips, idempotent
  generation, UTC round-trips, calendar filters, status history, and scope probes.
- E2E (`test/practices.e2e-spec.ts`): the authorization matrix — allowed, forbidden
  (403), cross-team scope (403), suspended actor (403), invalid recurrence (400),
  venue-not-in-scope (404), idempotent generation, the full publish/reschedule/cancel/
  reopen flow, invalid transition (409), version conflict (409), wrong-team 404, and a
  malformed id (400).
