# Practices — schedules, recurrence, sessions, cancellations, and RSVP

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

## 6. RSVP, availability, deadlines, and waitlist (prompt 201)

RSVP captures **intention** (going / not going / maybe / no response) and is kept
strictly separate from attendance — it **never awards points**. Migration
`src/database/migrations/1721900000000-practice-rsvp-schema.ts` (reversible; proven
from-empty in `test/database/practice-rsvp.integration.spec.ts`) adds:

- `practice_rsvps` — the single **effective** response per member/session. A unique
  index `(session_id, membership_id)` enforces "one effective RSVP per
  member/session"; the row carries `reason_category`, a member `note` + its
  `note_visibility` (`coaches|team`), `source` (`self|coach|admin|import|system`), a
  `waitlisted` flag (a check constraint allows it only for a `going` status),
  `responded_at`, actor audit, and an optimistic `version` for mobile races.
- `practice_rsvp_revisions` — append-only history of every response change
  (self, coach override with reason, and system waitlist promotions). Never updated
  or deleted, so intent history survives even after a session is cancelled.

**Availability rules** (pure, `domain/rsvp-availability.policy.ts` +
`domain/rsvp-deadline.policy.ts`):

- Self-service RSVP requires an **answerable** session state (`published` or
  `rescheduled`) and the RSVP window to be open (`now <= rsvp_cutoff_at`, inclusive;
  a null cutoff is always open). A closed state → `409 rsvpClosed`; a passed
  deadline → `409 rsvpDeadlinePassed`.
- A `going` answer is **confirmed** while confirmed-going (excluding self) is below
  `capacity`; once capacity is reached it is **waitlisted**. An uncapped session
  never waitlists (null-not-zero).
- When a confirmed member changes away from `going`, the earliest waitlisted member
  (by `responded_at`) is **promoted** in the same transaction.

Every write appends a revision, an audit row, and enqueues a versioned outbox event
(`practice.rsvp.recorded` / `practice.rsvp.promoted`, payload addressed to the
affected member via `recipientUserId`) — the change/waitlist reminder path through
the platform transactional outbox + notification preferences. Free-text notes and
reason categories are **never** placed in audit diffs or event payloads.

**Endpoints** (team + session scoped, all authenticated + permissioned):

- `PUT|GET /practice-sessions/:id/rsvp` — a member sets/reads their **own**
  availability (`practice.rsvp.self`; requires an active membership → else `403
rsvpNotMember`). A GET before answering returns an explicit `no_response`.
- `PUT /practice-sessions/:id/rsvps/:membershipId` — coach/admin **override**
  (`practice.rsvp.override`), mandatory reason, **bypasses the deadline** but not the
  session state or team scope. A membership outside the team → `404
rsvpMembershipNotFound`.
- `GET /practice-sessions/:id/rsvps` and `.../rsvps/summary` — the privacy-safe
  participant list and planning aggregate (`practice.read`); counts are projections
  from source and `spotsRemaining` is null when uncapped. The list omits notes and
  reason categories.
- `GET /practice-sessions/:id/rsvps/:membershipId/history` — a member's revision
  history including notes and override reasons (`practice.rsvp.override`, coach-only).

Conditional updates use optimistic `version` (`expectedVersion`), and the unique
index turns a concurrent duplicate insert into a clean `409 versionConflict`, so
mobile races never produce two effective rows. A cancelled session preserves all
RSVP rows and history while refusing new responses.

## 7. Attendance, finalization, corrections, and scoring inputs (prompt 202)

Attendance is the **auditable record of who actually took part** in a session. It is
deliberately **separate from RSVP** intention (§6) and from any computed score — this
module only ever stores raw facts and exposes reproducible scoring **INPUTS**; the
versioned scoring engine is a later module. Four tables (migration
`1722000000000-attendance-schema`):

- `attendance_sheets` — one per session (unique `session_id`) holding the
  `OPEN → FINALIZED → CORRECTED` state, the finalize actor/instant, and an optimistic
  `version`. A pure `attendance.state-machine` encodes the lifecycle
  (`canRecordInto`/`canFinalize`/`canCorrect`).
- `attendance_records` — the single **effective** record per membership/session
  (partial-free unique index on `(session_id, membership_id)`): status, check-in/out,
  lateness minutes, excuse category, restricted note, evidence ref, source, recorder,
  and an optimistic `version`. `lateness_minutes` is **null when not measured, 0 only
  when measured on-time** (null-not-zero), enforced by DB check constraints
  (lateness only for `present_late`, excuse category only for `excused`/`injured`).
- `attendance_record_revisions` — append-only history of every mark, self check-in,
  and privileged correction (with its mandatory reason). Never updated or deleted.
- `attendance_scoring_rules` — versioned weights/penalties/denominator policy. Seeded
  with **one legacy CANDIDATE rule** (`legacy-candidate-v1`: Practice 3, Fitness 2,
  Game 3, Throwing 4; late/absent penalty as explicit components; excused excluded
  from the denominator) — **data in a table, not constants**, and never adopted as
  final policy without an approved version.

**Statuses** (`AttendanceStatus`): `present_on_time`, `present_late`, `excused`,
`injured`, `absent`, `remote_approved`, `other_approved`. Legacy P/L/E/A maps onto
`present_on_time` / `present_late` / `excused`(or `injured`) / `absent`.

**Workflow.** An OPEN sheet accepts coach marks (single + **atomic bulk**), optional
member **self check-in** (status derived from the clock, never trusted from the
client), late conversion, and excuse approval — all as status changes on the mark
endpoint. **Finalize** locks the sheet (`OPEN → FINALIZED`, optimistic on the sheet
version) and emits `attendance.finalized`. After finalization, changes require the
privileged **correction** endpoint (`FINALIZED → CORRECTED`), which appends a revision
with a mandatory reason and emits `attendance.corrected` (addressed to the affected
member). Both events flow through the platform transactional outbox; free-text notes,
evidence, and excuse categories are **never** placed in audit diffs or event payloads.

**Endpoints** (team + session scoped, all authenticated + permissioned):

- `GET /practice-sessions/:id/attendance` — the roster + sheet state (`attendance.read.team`).
  Every active member appears; unmarked members carry a **null** status (prefill source
  - zero-contribution completeness). Notes and reasons are omitted.
- `GET|POST /practice-sessions/:id/attendance/me` and `.../check-in` — a member reads
  or self-records their own attendance (`attendance.read.self`; requires an active
  membership → else `403 attendanceNotMember`).
- `PUT /practice-sessions/:id/attendance/:membershipId` — coach records one participant
  (`attendance.record`); `POST .../attendance/bulk` — atomic bulk mark. Recording into a
  finalized sheet → `409 attendanceLocked`.
- `POST /practice-sessions/:id/attendance/finalize` — `attendance.finalize`; re-finalize
  → `409 invalidAttendanceTransition`.
- `PUT /practice-sessions/:id/attendance/:membershipId/correction` — audited privileged
  correction (`attendance.correct`, mandatory reason).
- `GET /practice-sessions/:id/attendance/:membershipId/history` — correction history
  (`attendance.read.team`).
- `GET /attendance/participation/:membershipId` and `/attendance/me/participation` —
  the scoring **INPUTS** projection (`attendance.read.team` / `.self`): eligible /
  present / late / excused / absent counts, the **unrounded** rate + points contribution,
  and the **cited rule version**. Projected from **finalized** facts against the cited
  rule — never a stored editable total.

**Golden rules.** `attendanceRate = attended / (eligible − excused)` with excused/injured
excluded from the denominator only through the rule; **no eligible sessions → null**
("not enough data"), never divide-by-zero or a misleading 0%. A member who had eligible
sessions but attended none gets a **measured** `0` rate (distinct from missing). Points
contribution is `Σ present[type]·weight[type] − late·latePenalty − absent·absentPenalty`,
null only when there is no data at all. Rounding to a display percentage happens **only**
in the response mapper.

## 8. Session types

Session type is a free-form catalog string (`practice`, `fitness`, `scrimmage`/`game`,
`throwing`, `running`, `gym`, `rules`, or custom) — **no points are hard-coded** here;
attendance scoring **inputs** cite a versioned rule (§7), and further scoring is the
concern of later modules.

## 9. Tests

- Unit: state machines + recurrence expansion, Cairo-time golden conversions (DST
  boundaries), helpers, the RSVP availability/deadline/waitlist policies, the
  attendance state machine + status policy, the **participation golden tests**
  (every status contributes per the cited version; excused denominator; null vs
  measured zero), the mappers, and every use-case/service with mocked ports.
- Integration (`test/database/practices.integration.spec.ts`,
  `.../practice-rsvp.integration.spec.ts`, `.../attendance.integration.spec.ts`, real
  PostgreSQL): migrate-from-empty + reversible down, array/calendar column
  round-trips, idempotent generation, UTC round-trips, status history, scope probes,
  RSVP + attendance insert/version-guard/duplicate-null, sheet finalize/correct
  guards, the roster LEFT JOIN (unmarked ⇒ null), participation facts filtered to
  finalized sheets, the seeded default rule, and revision history.
- E2E (`test/practices.e2e-spec.ts`, `.../practice-rsvp.e2e-spec.ts`,
  `.../attendance.e2e-spec.ts`): the authorization matrix — allowed, forbidden (403),
  cross-team scope (403), suspended actor (403), invalid recurrence (400),
  venue-not-in-scope (404), the full publish/reschedule/cancel/reopen flow, invalid
  transition (409), version conflict (409), wrong-team 404, malformed id (400), plus
  RSVP self/override + waitlist, and attendance record/self-check-in/finalize →
  correct (audited) / re-finalize rejected / locked-after-finalize / participation
  inputs.
