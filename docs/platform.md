# Platform — audit, domain events, outbox, idempotency, and notifications

This module is the **reliability + traceability foundation** every other bounded
context builds on. It provides five cross-cutting primitives and one user-facing
surface (the in-app notification inbox):

- **Audit log** — append-only evidence of who did what, where, and with what outcome.
- **Domain events** — versioned, past-tense envelopes describing state changes.
- **Transactional outbox** — events persisted atomically with the change, then
  dispatched by a worker with lease / backoff / dead-letter / replay.
- **Idempotency** — key + request-hash records so a retried operation returns the
  same result and a changed body conflicts.
- **Notifications** — preferences, an in-app inbox, delivery attempts, and a
  channel provider port (in-app now; email/push later).

Prompt: `105-audit-log-domain-events-transactional-outbox-idempotency-and-notification-foundation`.
Builds on 100 (DB/TypeORM), 101 (identity), 102 (RBAC + team/season scope),
103 (teams), 104 (members).

## 1. Tables

Migration `src/database/migrations/1721700000000-platform-schema.ts` (reversible;
proven from-empty in `test/database/platform.integration.spec.ts`):

- `audit_log` — **append-only**. `actor_user_id`, `action`, `resource_type`,
  `resource_id`, `team_id`/`season_id` scope, `correlation_id`, `outcome`
  (`success|failure|denied`), and a **redacted** jsonb `diff`. Actor/team/season
  refs use `ON DELETE SET NULL` so evidence survives entity removal. Never updated.
- `outbox_events` — a versioned event envelope + delivery bookkeeping
  (`status`, `attempts`, `available_at`, `leased_until`, `leased_by`,
  `last_error`, `completed_at`). Decoupled from every aggregate table (no FKs).
  A partial index `ix_outbox_due (available_at) WHERE status='pending'` serves the
  poller; `ix_outbox_lease` reclaims lease-expired rows.
- `idempotency_records` — `idempotency_key`, `request_hash`, `principal_user_id`,
  `scope_key`, `status` (`in_progress|completed`), `status_code`, `result`,
  `expires_at`. A unique `(idempotency_key, principal_user_id)` index rejects a
  concurrent first-writer at the database.
- `notifications` — the in-app inbox. i18n `title_key`/`body_key` + scalar
  `params` (no rendered PII), `category`, and a unique `dedupe_key`.
- `notification_preferences` — per `(user, category, channel)` toggle; **absence
  means enabled**.
- `notification_deliveries` — append-only per-channel attempts (`sent|failed`).

## 2. Domain-event envelope + catalog governance

Events are **past-tense facts**, versioned via `event_version`, and carry stable
event/aggregate identity, actor + team/season scope, `correlation_id` +
`causation_id` for tracing, and a redacted scalar `payload`
(`model/platform.types.ts` → `DomainEventEnvelope`).

- **Catalog** lives in `model/platform.constants.ts`: the `*_EVENT` constants are
  the canonical type strings; `NOTIFICATION_ROUTES` maps the events that fan out
  to an in-app notification. Adding an event type is a data edit here — never an
  inline literal at a call site.
- **Versioning**: a breaking payload change increments `event_version`; handlers
  branch on it. Old versions are never mutated in place.
- **Redaction** (`domain/redaction.policy.ts`): payloads/diffs are scalar-only by
  type (no file bytes, no nested PII graphs), and any key whose name matches a
  denied substring (token, password, hash, email, phone, contact, national id,
  health, injury, discipline, note, …) is masked to `[redacted]` before persistence.

## 3. Outbox operations

`RecordDomainEventService.enqueue(scope, input)` inserts the envelope **inside the
caller's transaction**, so the event and the state change commit atomically — a
rollback leaves no event (proven by the integration suite).

`ProcessOutboxBatchUseCase.execute()` drains one bounded batch:

1. `leaseBatch` claims pending (or lease-expired) rows with
   `FOR UPDATE SKIP LOCKED` — concurrent workers never double-process.
2. Each event is dispatched to the injected `OUTBOX_EVENT_HANDLER_PORT`
   (the notification projector).
3. Outcome per event: **completed**, **rescheduled** with capped exponential
   backoff (`domain/outbox-backoff.policy.ts`), or **dead-lettered** at
   `OUTBOX_MAX_ATTEMPTS`. A failing handler never aborts the batch.

Operations surface (`admin/outbox`, guarded by `jobs.manage`):

- `GET /admin/outbox/metrics` — pending/processing/completed/dead-lettered counts.
- `POST /admin/outbox/:eventId/replay` — requeue a dead-lettered event; the
  privileged replay is itself audited. Handlers are idempotent, so replay is safe.

The worker is exposed as a use case (`ProcessOutboxBatchUseCase`) and exported for
a scheduler to trigger; this slice ships the mechanism, not a timer.

## 4. Idempotency

`IdempotencyService.begin(scope, lookup)` classifies an incoming request against
any stored record for the same `(key, principal)`
(`domain/idempotency.policy.ts`):

| Stored state               | Outcome    | Effect                            |
| -------------------------- | ---------- | --------------------------------- |
| none                       | `New`      | reserve an in-progress record     |
| same hash, completed       | `Replay`   | return the stored result verbatim |
| different hash             | `Conflict` | raise 409 (`idempotencyConflict`) |
| same hash, still in-flight | `Conflict` | raise 409                         |

`complete(scope, recordId, statusCode, result, now)` records the final result.
Other modules wrap a mutation with `begin` … domain work … `complete`, all in one
transaction, so a retried match-event / attendance bulk / activity submission /
import never double-applies.

## 5. Notifications

`NotificationProjectionService` (the outbox handler) turns routed events into
notifications:

- resolves the recipient (an explicit `recipientUserId` payload scalar, else the
  actor), honors the recipient's category/channel **preference** (default enabled),
  and inserts with a stable `dedupe_key` (`eventType:aggregateId:recipient`) using
  `ON CONFLICT DO NOTHING` — a **retried event yields one notification**.
- records a delivery attempt through `NOTIFICATION_SENDER_PORT`
  (`InAppNotificationAdapter`; in-app delivery succeeds once the inbox row exists).

Self-service surface (`/notifications`):

- `GET /notifications` — bounded, newest-first inbox (`notification.read.self`).
- `POST /notifications/:id/read` — idempotent, ownership-scoped (404 if not owned).
- `GET|PUT /notifications/preferences` — per-user toggles
  (`notification.preferences.self`).

Identity always comes from the token, never the body.

## 6. Reusable primitives (public surface)

`src/modules/platform/index.ts` exports the composition points other modules use
inside their own transaction — never internal layers:

- `AuditRecorderService.record(scope, AuditInput)`
- `RecordDomainEventService.enqueue(scope, DomainEventInput)`
- `IdempotencyService.begin/complete`
- `ProcessOutboxBatchUseCase` (for a future scheduler)
- the `AuditOutcome` / `IdempotencyOutcome` / `NotificationCategory` /
  `NotificationChannel` enums and the input/decision types.

## 7. Authorization matrix (proven in `test/platform.e2e-spec.ts`)

| Surface                         | Permission                      | Scope        |
| ------------------------------- | ------------------------------- | ------------ |
| `GET/POST /notifications*`      | `notification.read.self`        | self (token) |
| `GET/PUT .../preferences`       | `notification.preferences.self` | self (token) |
| `GET /teams/:teamId/audit`      | `audit.read`                    | team         |
| `GET /admin/outbox/metrics`     | `jobs.manage`                   | global       |
| `POST /admin/outbox/:id/replay` | `jobs.manage`                   | global       |

E2E proves: allowed, forbidden-role (403 `permissionDenied`), suspended actor
(403), cross-team (403), unauthenticated (401), forged id (404), and invalid
uuid/body (400).

## 8. Tests

- **Unit** (`src/modules/platform/**/*.spec.ts`) — policies, factories, mappers,
  repositories (SQL shape), services, and use cases (mocked ports/time/ids).
- **Integration** (`test/database/platform.integration.spec.ts`, real Postgres) —
  migrate-from-empty reversibility, rollback-has-no-outbox, audit redaction,
  notification dedupe + delivery + preference suppression, worker retry →
  dead-letter, idempotency replay + hash conflict, and `SKIP LOCKED` concurrency.
- **E2E** (`test/platform.e2e-spec.ts`) — the authorization matrix above.
