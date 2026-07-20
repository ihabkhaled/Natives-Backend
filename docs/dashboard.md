# Dashboard — the permission-aware summary projection

`GET /dashboard/summary` answers one question: _what should this person see first?_ It is
a **projection**, computed on every request from the contexts that own the data. The
dashboard module owns no tables, performs no writes, and stores no totals.

## 1. Contract

Permission: `team.read`. Optional query parameter `teamId` (uuid).

```jsonc
{
  "persona": "member", // member | coach | administrator
  "generatedAt": "2026-07-20T12:00:00.000Z",
  "widgets": [
    {
      "kind": "member-attendance",
      "presentation": "breakdown", // metric | breakdown | tasks
      "status": "ready", // ready | empty | partial | unavailable
      "asOf": "2026-07-18T19:00:00.000Z",
      "rows": [
        {
          "key": "present",
          "labelKey": "dashboard.attendancePresent",
          "value": 8,
          "displayValue": "8",
        },
        {
          "key": "late",
          "labelKey": "dashboard.attendanceLate",
          "value": null,
          "displayValue": null,
        },
      ],
    },
  ],
}
```

`presentation` discriminates the payload:

| `presentation` | Payload field | Shape                                                               |
| -------------- | ------------- | ------------------------------------------------------------------- |
| `metric`       | `metric`      | `{ value, displayValue, unit, tone }`, `unit ∈ percent/points/rank` |
| `breakdown`    | `rows`        | `{ key, labelKey, value, displayValue }[]`                          |
| `tasks`        | `tasks`       | `{ id, labelKey, count, tone, occurredAt }[]`                       |

`tone ∈ positive | neutral | attention | critical`.

## 2. Rules the contract guarantees

- **Null, never zero.** A numeric field is `null` whenever nothing was measured. A count
  of `0` from an aggregate over an empty set is reported as `null`, and the widget's
  `status` becomes `empty`. A real zero (a status a member has genuinely been marked
  with) is still `0`. The client must never coerce `null` to `0`.
- **Server-owned display strings.** `displayValue` is the rounded string the client
  renders verbatim (`"38%"`, `"15"`, `"2/11"`). No screen recomputes a score.
- **Per-widget freshness.** Each widget carries its own `asOf`, taken from the instant its
  own source last changed — not the request time. `generatedAt` is the single clock
  reading for the document.
- **i18n keys only.** `labelKey` values are keys (`dashboard.taskPlanSession`), never
  server copy. Unknown widget kinds are safe for a client to drop.
- **Permission-aware.** A widget only appears when the caller's effective permissions in
  the resolved team scope reveal it. Personas are a headline, not an authorization
  mechanism: two callers with the same persona can receive different widget sets.

## 3. Widget catalogue

| Kind                | Presentation  | Reveals on                       | Source module |
| ------------------- | ------------- | -------------------------------- | ------------- |
| `member-schedule`   | tasks         | `practice.read`                  | practices     |
| `member-attendance` | breakdown     | `attendance.read.self`           | practices     |
| `member-standing`   | metric/rank   | `leaderboard.read`               | points        |
| `member-activity`   | metric/points | `points.read.self`               | points        |
| `member-feedback`   | tasks         | `assessment.read.self.published` | assessments   |
| `member-profile`    | metric/%      | `member.profile.update.self`     | members       |
| `coach-sessions`    | tasks         | `practice.manage`                | practices     |
| `coach-attention`   | tasks         | `attendance.finalize`            | practices     |
| `coach-assessments` | tasks         | `assessment.review`              | assessments   |
| `coach-roster`      | tasks         | `member.list`                    | members       |
| `admin-lifecycle`   | tasks         | `member.lifecycle.manage`        | members       |

The permission map is data in `src/modules/dashboard/domain/widget-visibility.policy.ts`.

## 4. Persona classification

Pure, from the caller's real effective permissions in the resolved scope
(`domain/dashboard-persona.policy.ts`):

1. `team.settings.manage` **or** `member.roles.manage` → `administrator`
2. `practice.manage` **or** `assessment.review` → `coach`
3. otherwise → `member`

Administration markers win over coaching markers. Every permission set maps to exactly
one persona.

## 5. Scope and ownership

The team is resolved **from the caller's own memberships**, never from a client-supplied
identity (`application/dashboard-scope.service.ts`):

- no `teamId` → the caller's first **active** membership;
- explicit `teamId` → the caller must hold an active membership in it, otherwise
  `403 errors.dashboard.teamForbidden`. This ownership check also stops a globally
  privileged principal from reading a team dashboard they are not part of;
- no memberships at all → `200` with the caller's persona and `widgets: []`. A person
  without a team gets an honest empty board, not an error.

The permissions guard independently resolves the request scope from the `teamId` query
value, so a scoped grant for another team is denied before the handler runs.

## 6. Cross-module boundaries

The dashboard reads **only** through other modules' public barrels. Each source module
exports one focused signals service:

| Module        | Public surface                      | Reads                                                                                                       |
| ------------- | ----------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `practices`   | `PracticeDashboardSignalsService`   | upcoming published sessions + viewer RSVP, viewer attendance counts, draft sessions, open attendance sheets |
| `assessments` | `AssessmentDashboardSignalsService` | published assessments for the viewer, submitted assessments awaiting review                                 |
| `points`      | `PointsDashboardSignalsService`     | the viewer's net ledger total and database-computed rank                                                    |
| `members`     | `MemberDashboardSignalsService`     | viewer profile completeness, invited memberships                                                            |

Every query is explicitly bounded (`LIMIT`, single-row aggregate, or database-side
`RANK()`), and collection is sequential — one bounded transaction per source, no N+1 and
no per-widget follow-up query. Signals are gathered once per request into a
`DashboardSignalBundle` and the widgets are then built purely.

## 7. Where the code lives

| Concern                | File                                                             |
| ---------------------- | ---------------------------------------------------------------- |
| Transport              | `src/modules/dashboard/api/dashboard.controller.ts`              |
| Orchestration          | `src/modules/dashboard/application/dashboard-summary.service.ts` |
| Team scope + ownership | `src/modules/dashboard/application/dashboard-scope.service.ts`   |
| Signal collection      | `src/modules/dashboard/application/dashboard-signals.service.ts` |
| Persona (pure)         | `src/modules/dashboard/domain/dashboard-persona.policy.ts`       |
| Tone thresholds (pure) | `src/modules/dashboard/domain/dashboard-tone.policy.ts`          |
| Widget permissions     | `src/modules/dashboard/domain/widget-visibility.policy.ts`       |
| Widget assembly (pure) | `src/modules/dashboard/lib/dashboard-summary.assembler.ts`       |
| Authorization matrix   | `test/dashboard.e2e-spec.ts`                                     |
| Real-Postgres signals  | `test/database/dashboard-signals.integration.spec.ts`            |

## 8. Extending it

1. Add the kind to `DashboardWidgetKind` (`model/dashboard.enums.ts`).
2. Map its permission in `widget-visibility.policy.ts` — omit the entry only if every
   team member may see it.
3. Add the bounded read to the **owning** module's signals repository/service and export
   it from that module's barrel. Never query another context's tables from here.
4. Build the widget purely in `lib/`, and register it in `dashboard-summary.assembler.ts`.
5. Add unit tests for the pure builder and extend the e2e persona-shaping assertions.
