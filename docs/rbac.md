# RBAC — permission-based authorization with team/season scoping

Ultimate Natives authorizes every protected operation with **canonical permissions**
grouped into **role bundles** and resolved **per request** against the database with
**team/season scope**. Roles are configurable bundles of permissions, never
authorization conditionals. This document is the source of truth for how the system
is wired and how to extend it without scattering logic.

Prompt: `102-permission-based-rbac-and-team-season-scoping`. Builds on prompt 101
(identity/session) and the 100 DB/TypeORM foundation.

## 1. The permission catalog

- Every permission is a stable dotted string: `<area>.<resource>.<action>[.<qualifier>]`
  (e.g. `team.read`, `member.profile.read.coach`, `attendance.finalize`, `match.score`).
- The typed catalog is the enum `Permission` in `src/shared/enums/permission.enum.ts`
  (+ `PERMISSION_VALUES`). Never type a raw permission literal at a call site —
  reference an enum member.
- The catalog with areas + descriptions is data in
  `src/shared/constants/permission-catalog.constants.ts` (`PERMISSION_CATALOG`,
  `PERMISSION_CATALOG_KEYS`). It is the single source seeded into the `permissions`
  table by the RBAC migration.
- The canonical set is 88 permissions from
  `11-SCHEMAS/rbac.permissions.yaml`. The enum additionally retains two
  template-only `article:*` permissions used by the reference module; these are NOT
  part of the catalog or any seeded bundle.

### Adding a permission (no scattered logic)

1. Add one member to the `Permission` enum (value = the canonical string).
2. Add one `{ key, area, description }` entry to `PERMISSION_CATALOG`.
3. If it belongs in a default bundle, add one line to the relevant bundle in
   `role-bundles.constants.ts`.
4. Add a **new** migration that seeds the new permission (and any bundle rows) with
   `INSERT ... ON CONFLICT DO NOTHING`. Never edit a shipped migration — migrations
   are immutable snapshots.
5. Reference it in a controller via `@RequirePermissions(Permission.X)`.

The catalog/bundle unit tests (`permission-catalog.spec.ts`, `role-bundles.spec.ts`)
assert completeness and bundle composition; the RBAC integration test asserts the
seed matches (88 permissions, 5 roles).

## 2. Roles are bundles (data, not conditionals)

Default system bundles live in `src/shared/constants/role-bundles.constants.ts`
(`ROLE_BUNDLES`, keyed by `RbacRole`) and compose by extension:

| Bundle        | Composition                                                                                |
| ------------- | ------------------------------------------------------------------------------------------ |
| `MEMBER`      | baseline participating member (read-own, RSVP, leaderboards)                               |
| `COACH`       | extends `MEMBER` + practice/attendance/assessment/roster/match management                  |
| `TEAM_ADMIN`  | extends `COACH` + settings/season/member-lifecycle/roles/finalize/governance/imports/audit |
| `SCOREKEEPER` | standalone: read + `match.score`                                                           |
| `ANALYST`     | standalone: read + team analytics + reports                                                |

Bundles are seeded into `roles` + `role_permissions`. `match.score` is granted only by
`SCOREKEEPER` — `TEAM_ADMIN` does not hold it, which is what makes the anti-escalation
test meaningful.

The coarse account role (`users.role`: `admin` / `user`, carried in the JWT) maps to a
global **baseline** bundle in `role-permissions.constants.ts` (`ROLE_PERMISSIONS`),
resolved with no database round-trip so the app authorizes even before the scoped
layer is reachable. `admin` → the full catalog (still audited); `user` → `MEMBER`
plus the template article permissions.

## 3. Effective-permission resolution

Port: `EffectivePermissionResolverPort` + `EFFECTIVE_PERMISSION_RESOLVER_PORT`
(`src/core/auth/effective-permission-resolver.port.ts`). Implemented by
`RbacPermissionResolverService` (`src/modules/rbac/application`). Given
`(principal, scope)` it returns the granted permission-key set.

Algorithm (deterministic, order-independent):

1. **Lifecycle gate.** If the principal's account is not `active` (unknown / invited /
   inactive / suspended / left / soft-deleted), resolve to the empty set — every
   permission-gated route is denied.
2. **Baseline.** Union of the account-role bundle permissions (in-code, no DB).
3. **Scoped grants.** Load the user's active role assignments expanded to one grant
   per permission, then keep grants that are (a) _in effect_ at `now`
   (`effectiveFrom <= now < effectiveTo`, open-ended when `effectiveTo` is null) and
   (b) _cover the request scope_:
   - a null grant dimension (team or season) is global and matches anything;
   - a non-null dimension requires an exactly-equal request dimension.
     Union the covering **allow** grants; subtract any covering **deny** grant (deny
     wins). The pure algorithm lives in `domain/effective-permissions.policy.ts` and
     `domain/permission-scope.policy.ts`.
4. Effective = baseline ∪ scoped.

Precedence rules: deny overrides win over allow within the same covering scope; a
global assignment applies everywhere; a team-scoped assignment never applies to a
different team or to a global (no-team) request. Multiple roles union.

If the policy store is unreachable, resolution degrades safely to the account-role
baseline (scoped grants are purely additive; there are no DB-backed deny grants yet).

### Caching + explicit invalidation

The resolver caches the **raw per-user grants** keyed by `userId`, tagged with the
current `rbac_policy_version`. Every resolve reads the (indexed, single-row) policy
version; a mismatch evicts and reloads. Scope + effective-window filtering runs fresh
on every call, so time-window expiry and scope changes are always honored without an
explicit event. Any assignment/role change **bumps `rbac_policy_version`** inside the
same transaction (assign/revoke use cases), which invalidates every cache entry on the
next read. This is proven by `rbac-permission-resolver.service.spec.ts` (unit) and the
RBAC integration + e2e stale-cache tests.

## 4. Guards and scope enforcement

Global guards (wired in `bootstrap/create-app.ts`): `JwtAuthGuard` then
`PermissionsGuard`.

- `PermissionsGuard` (`src/core/auth/permissions.guard.ts`) reads
  `@RequirePermissions(...)` metadata (AND-semantics), extracts the request scope, and
  resolves the principal's effective permissions for that scope via the port. Missing
  permission → `403 errors.auth.permissionDenied`.
- **Scope extraction** (`request-scope.extractor.ts`) reads `teamId` / `seasonId` from
  **path params or validated query only** — never the request body. Cross-team /
  cross-season requests are denied because a team-scoped grant does not cover a
  different team's scope.
- **System vs team admin.** A global capability (e.g. `security.admin`,
  `member.roles.manage` used on a global route) requires a global grant; a team-scoped
  `TEAM_ADMIN` holds `member.roles.manage` only within its team.

Identity is always taken from the verified token (`@CurrentUser()`); client-supplied
user/team/role IDs never replace the resolved principal scope.

## 5. Admin assignment / inspection endpoints

Controller: `src/modules/rbac/api/rbac.controller.ts` (base `rbac`), all under the
`member.roles.manage` permission except the self-read:

| Method | Route                                 | Permission            | Purpose                                            |
| ------ | ------------------------------------- | --------------------- | -------------------------------------------------- |
| POST   | `rbac/assignments?teamId&seasonId`    | `member.roles.manage` | Assign a role bundle in a scope                    |
| DELETE | `rbac/assignments/:assignmentId`      | `member.roles.manage` | Revoke an assignment (soft-revoke)                 |
| GET    | `rbac/users/:userId/assignments`      | `member.roles.manage` | List a user's active assignments                   |
| GET    | `rbac/me/permissions?teamId&seasonId` | authenticated         | The caller's own effective permissions (self-only) |

The assignment scope is taken from the **query** (so the guard resolves the manage
permission within that team/season); the body carries only the target user, role key,
and optional expiry.

### Privilege ceiling / anti-escalation

`PrivilegeCeilingService` + `domain/privilege-ceiling.policy.ts`: before assigning or
revoking a role, the actor's effective permissions **in the target scope** are resolved
authoritatively (a fresh DB read, never the resolver cache), and the target role's
permission set must be a subset. Otherwise `403 errors.rbac.escalationDenied`. An actor
can never grant or revoke a capability they do not themselves hold in that scope. Proven
by the e2e escalation test (a `TEAM_ADMIN` cannot grant `SCOREKEEPER` because it lacks
`match.score`).

### Audit

Every assignment and revocation appends a privacy-safe row to the shared
`security_events` audit log (`rbac.roleAssigned` / `rbac.roleRevoked`) inside the same
transaction — ids and scope only, never PII.

## 6. Data model

Migration `1721400000000-rbac-schema.ts` (self-contained, reversible, idempotent seeds):

| Table                   | Purpose                                                                                                                                                                                                                  |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `permissions`           | canonical catalog: `key` (unique), `area`, `description`                                                                                                                                                                 |
| `roles`                 | bundles: `key` (unique), `display_name`, `description`, `is_system`                                                                                                                                                      |
| `role_permissions`      | role ↔ permission join (PK `role_id, permission_id`)                                                                                                                                                                     |
| `user_role_assignments` | `user_id`, `role_id`, nullable `team_id` + `season_id`, `effective_from`, nullable `effective_to`, `granted_by`, `revoked_at`, `version`; partial unique index for one active assignment per user+role+team+season scope |
| `rbac_policy_version`   | singleton row bumped on any assignment change for cache invalidation                                                                                                                                                     |

UUID PKs, `timestamptz` UTC, snake_case, soft-revoke via `revoked_at`, optimistic
`version`. TypeORM is confined to `src/database` and `src/modules/**/infrastructure`;
the app/domain layers are vendor-free and use the `UnitOfWorkPort` + `TransactionScope`
with parameterized SQL and static column lists.

## 7. Deferred (documented)

- **Per-user grant/deny overrides table.** The resolution algorithm already supports
  `deny` grants (deny wins), and the deny path is unit-tested, but the DB overrides
  table + admin endpoint are deferred. Until then all DB-backed grants are `allow`.
- **Team/season foreign keys.** `team_id` / `season_id` are currently plain nullable
  UUID scope columns; membership linkage (FKs to teams/seasons) is refined in prompt 104.

## 8. Testing

- **Unit** — catalog completeness, bundle composition, effective-permission resolution
  (union, scope filtering, effective-date windows, deny precedence, determinism), cache
  invalidation, privilege-ceiling rejection, scope extraction, guard behavior. Time is
  frozen via the clock port.
- **Integration** (real PostgreSQL, `docker-compose.test.yml`, `:55432`) —
  migrate-from-empty + seed present, resolution across teams/seasons, stale-cache
  invalidation after an assignment change, inactive-user denial.
- **E2E** (`test/rbac.e2e-spec.ts`) — the authorization matrix: allowed, forbidden
  (403 `permissionDenied`), wrong team/season (403), inactive/suspended (403), forged
  assignment id (404), escalation rejected (403 `escalationDenied`), self-only, and
  stale-cache invalidation. Backend denial is proven end-to-end, never by hiding UI.
