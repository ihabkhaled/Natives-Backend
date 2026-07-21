# Seeding — the demonstration persona cast

A fresh database must be **demonstrable**: every screen in the product needs at
least one account that can legitimately exercise it, and every picker needs
reference data behind it. The `personas` seeder provides exactly that.

It runs through the same **once-only** framework as every other seeder
(`seed_history` + checksum, see [docs/database.md](./database.md#boot-lifecycle-migrations--once-only-seeding)):
it applies on a first-time fresh database and is **skipped** on every later boot.
Re-running `npm run seed:admin` (which drives the whole registry) is a clean
no-op, proven by `test/database/team-seed.integration.spec.ts`
(_"changes nothing on a second run and never re-seeds"_).

Registration order matters: `admin` → `team-ultimate-natives` → `personas`. The
persona seeder links every account to the team the team seeder provisions.

---

## The credential

| Variable                | Default                                   | Notes                                                          |
| ----------------------- | ----------------------------------------- | -------------------------------------------------------------- |
| `SEED_PERSONA_PASSWORD` | `NativesDev!Persona2026` (non-production) | One shared password for the whole cast. Minimum 12 characters. |

The default exists **only outside production**. With `NODE_ENV=production` the
loader (`src/config/seed-personas.config.ts`) throws unless the variable is
supplied, so a real host can never come up with a guessable demonstration
account. The value is resolved lazily (only when the seeder actually runs), is
never logged, and is deliberately **not** part of the seeder's checksum — so
rotating it is not a definition change.

---

## The personas

Every persona has a user account, a password credential, an **active**
season-independent membership in team `un` (Ultimate Natives), and one scoped
RBAC role assignment. All emails use the reserved `.local` suffix and contain no
real personal data.

| Login email                                   | Display name         | `users.role` | RBAC bundle   | Assignment scope               | What they demonstrate                                         |
| --------------------------------------------- | -------------------- | ------------ | ------------- | ------------------------------ | ------------------------------------------------------------- |
| `superadmin@ultimatenatives.local`            | Nadia Super Admin    | `admin`      | `SUPER_ADMIN` | **global** (`team_id IS NULL`) | Platform administration: create teams, browse every team.     |
| `teamadmin@ultimatenatives.local`             | Tarek Team Admin     | `user`       | `TEAM_ADMIN`  | team `un`                      | Full administration of one team — but **no** platform rights. |
| `headcoach@ultimatenatives.local`             | Hana Head Coach      | `user`       | `COACH`       | team `un`                      | Practices, attendance, assessments, squads, match management. |
| `assistantcoach@ultimatenatives.local`        | Amir Assistant Coach | `user`       | `COACH`       | team `un`                      | A second coach, for reviewer/co-coach flows.                  |
| `scorekeeper@ultimatenatives.local`           | Sara Scorekeeper     | `user`       | `SCOREKEEPER` | team `un`                      | Live match scoring only.                                      |
| `analyst@ultimatenatives.local`               | Adel Analyst         | `user`       | `ANALYST`     | team `un`                      | Read-only analytics, leaderboards and reports.                |
| `player1@…` … `player6@ultimatenatives.local` | Player One … Six     | `user`       | `MEMBER`      | team `un`                      | Directories, RSVP, rosters, leaderboards with real rows.      |

Plus the pre-existing administrator from the `admin` seeder
(`SEED_ADMIN_EMAIL`, default `admin@ultimatenatives.local`), whose password comes
from `SEED_ADMIN_PASSWORD` and has **no** default.

### How to log in as any of them

```http
POST /api/v1/auth/login
Content-Type: application/json

{ "email": "headcoach@ultimatenatives.local", "password": "<SEED_PERSONA_PASSWORD>" }
```

The response carries the access/refresh tokens and the caller's memberships.
Send the access token as `Authorization: Bearer <token>` on every later request.

---

## Super admin vs team admin

This split is enforced by the permission catalog, not by a flag:

- Three permissions live in the **`platform`** area — `platform.admin`,
  `team.create`, `team.browse.all` — and are bundled **only** into
  `SUPER_ADMIN`.
- A grant only satisfies a request when every scope dimension it constrains
  matches (`grantCoversScope`). Platform routes carry **no** `teamId`, so a
  team-scoped assignment can never satisfy them.
- Therefore: `POST /teams`, `GET /teams` (browse all) and
  `POST /teams/:teamId/remove` require a **global** grant; a `TEAM_ADMIN` scoped
  to team `un` gets `403 errors.auth.permissionDenied` on all three.
- Team administrators discover their own teams through `GET /teams/mine`, which
  filters to the teams the caller holds a live assignment in.

`test/teams.e2e-spec.ts` proves both directions, including cross-team isolation.

---

## Reference data

So dashboards, pickers and rosters are never empty on a fresh database, the
persona seeder also provisions, for team `un`:

- **`reference_catalog_entries`** — `division` (open / women / mixed),
  `gender_format` (open / womens / mixed), `position` (handler / cutter / deep).
- **`venues`** — _Cairo Main Field_ and _Riverside Training Ground_.

The team seeder already provisions the **current season** (one `active` season
covering the calendar year the database is first seeded in), which
`GET /teams/:teamId/seasons/current` resolves and the leaderboard's
`period=season` depends on. At most one season per team may be `active` — a
database invariant enforced by the partial unique index
`ux_seasons_one_active_per_team`.

---

## Adding a persona

1. Add an entry to `PERSONA_DEFINITIONS` in
   `src/database/seeds/seed-personas.constants.ts`.
2. Bump the trailing version in `PERSONAS_SEED_DEFINITION`
   (`src/database/seeds/seed.constants.ts`) **only** if the seeder's ordered
   effects changed. A changed checksum on an already-seeded database is reported
   as `changed` and the seeder is **not** re-run — add a new seeder or a
   migration instead.
3. Update the table above and the assertions in
   `test/database/team-seed.integration.spec.ts`.
