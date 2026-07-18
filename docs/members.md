# Members — lifecycle, player profiles, media, aliases, and privacy

This module owns the **person-in-a-team** records every sports feature hangs off:
membership lifecycle, the player profile, avatar media, import aliases, and the
**field-level privacy** that decides who sees which profile field. It deliberately
separates three concepts so historical players and tryout candidates need **no login**:

- **User account** (`users`, owned by identity) — the optional login credential.
- **Membership** (`memberships`) — a person's participation in a team; `user_id` is
  **nullable**.
- **Player profile** (`member_profiles`) — the descriptive, privacy-classified fields,
  1:1 with a membership.

Prompt: `104-member-lifecycle-player-profiles-media-aliases-and-privacy`. Builds on 100
(DB/TypeORM), 101 (identity), 102 (RBAC + team/season scope), and 103 (teams).

## 1. Aggregates and tables

Migration `src/database/migrations/1721600000000-members-schema.ts` (reversible; proven
from-empty in `test/database/members.integration.spec.ts`):

- `memberships` — team-scoped lifecycle record. `user_id` nullable (no login),
  `status` state (`invited|active|inactive|suspended|left|archived|anonymized`),
  `status_reason`, `status_effective_at`, `joined_at`/`left_at`/`anonymized_at`,
  actor audit, **soft delete** (`deleted_at`) and optimistic `version`. A partial
  unique index enforces **one non-terminal membership per user/team/season**
  (`ux_memberships_user_team_season`, excluding archived/left/anonymized/deleted).
- `member_profiles` — 1:1 with a membership. EN/AR/preferred names, nickname,
  contacts (email/phone), `jersey_number`/`jersey_size`, `gender`/`division`,
  `positions text[]`, `height_cm`/`weight_kg` (`numeric`, **null-not-zero**),
  `date_of_birth` (date-only), `avatar_media_id`, actor audit, optimistic `version`.
- `membership_status_events` — **append-only** lifecycle history (from/to status,
  reason, actor, effective + occurred instants). Never updated or deleted.
- `media_assets` — avatar **metadata only**; bytes live in object storage. Content
  type/size/dimension, `scan_status` (`pending|clean|infected|failed`), owner,
  isolated `storage_key` (unique), soft delete. **No DB blobs.**
- `member_aliases` — normalized import aliases. Partial unique index enforces scoped
  active-alias uniqueness (`ux_aliases_team_normalized`, where `deleted_at IS NULL`).

## 2. Lifecycle state machine

`domain/membership-lifecycle.state-machine.ts` (pure, exhaustively unit-tested):

```
invited   -> active | left | archived | anonymized
active    -> inactive | suspended | left | archived | anonymized
inactive  -> active | suspended | left | archived | anonymized
suspended -> active | left | archived | anonymized
left      -> archived | anonymized
archived  -> active | anonymized        (activate = restore)
anonymized-> (terminal)
```

Every transition records an immutable `membership_status_events` row plus a redacted
`security_events` audit row, in one transaction, guarded by optimistic concurrency and
an actor + effective time. `activate` doubles as **restore** (it is valid from
inactive/suspended/archived). `canMutateTeamData(status)` is `true` only for `active`
— downstream modules call it before accepting a member-initiated write, so
**inactive/suspended/left members keep their history but cannot act**. `anonymize` is a
privileged retention end-state, not deletion (see §5).

Endpoints (`POST teams/:teamId/members/:id/{activate|deactivate|suspend|leave|archive|
anonymize}`) require `member.lifecycle.manage`, scoped to the team.

## 3. Field-level privacy (five distinct views)

`domain/member-privacy.policy.ts` maps a resolved viewer to one of five shapes; a field
the audience may not see is returned as `null`. The viewer's **tier** is resolved from
their effective permissions and team relationship (`application/member-access.service.ts`,
backed by the core RBAC resolver), and `isSelf` is tracked separately so a member always
sees their own personal fields:

| Field group                                                              | public | teammate | self | coach | admin |
| ------------------------------------------------------------------------ | :----: | :------: | :--: | :---: | :---: |
| name / nickname / positions / jersey number / division / avatar-presence |   ✓    |    ✓     |  ✓   |   ✓   |   ✓   |
| preferred name / AR name / gender                                        |        |    ✓     |  ✓   |   ✓   |   ✓   |
| full name / jersey size / email / phone / height / weight / age band     |        |          |  ✓   |   ✓   |   ✓   |
| raw date of birth                                                        |        |          |  ✓   |       |   ✓   |
| status reason / audit actors / version                                   |        |          |      |       |   ✓   |

`self` and `coach` are genuinely distinct: a member sees their **own raw date of birth**,
a coach sees only the derived **age classification** (`domain/member-age.policy.ts`;
`null` when DOB is unknown — never a fabricated age). The response carries an `audience`
label naming the shape rendered. Profile writes return the view shaped for the **actual
actor**, so a coach never over-reads by editing.

Profile updates (`PATCH …/profile`) enforce the **ownership-or-elevated** invariant: the
member editing their own **active** profile, or a holder of `member.lifecycle.manage`.
Anonymized profiles are immutable. Scoped active **jersey uniqueness** is enforced by a
bounded active-jersey scan (`domain/jersey.policy.ts`) → `409 jerseyConflict`.

## 4. Media (avatars)

Bytes never pass through the app or database. `MediaStoragePort`
(`model/members.types.ts`) is the object-storage boundary; the
`SignedUrlMediaStorageAdapter` mints short-lived HMAC-signed URLs (swap for S3/GCS by
replacing only the adapter). Flow:

1. `POST …/avatar` — validate content type/size/dimension
   (`domain/media-validation.policy.ts`), create a `pending`-scan asset with an isolated
   storage key, return a signed **upload** URL. Requires self or manager.
2. `POST …/media/:mediaId/scan` — a system/staff action recording the malware-scan
   outcome (`member.lifecycle.manage`).
3. `PUT …/avatar/:mediaId` — attach; **rejects any asset not scanned `clean`**
   (`409 mediaNotScanned`).
4. `GET …/avatar` — returns a signed **download** URL, or `{ url: null }` when there is
   no clean avatar. The avatar is optional: a missing/pending/infected asset never breaks
   profile rendering.

The private `storage_key` is never exposed in any response
(`lib/member.mapper.ts` strips it).

## 5. Data-subject support (anonymization and retention)

`anonymize` is the privileged retention action. In one transaction it moves the
membership to the terminal `anonymized` state, **redacts every restricted profile field**
(name → "Former member", contacts/DOB/measurements/positions/avatar cleared), and
soft-removes all aliases — while the membership row itself **persists** so historical
references (attendance, matches, ledgers) stay referentially valid. Requires
`member.lifecycle.manage`; audited to `security_events`.

## 6. Privacy classification of fields (import mapping)

Aligned to the import field classes: **Public** (name/jersey/positions/avatar-presence),
**Member-visible** (AR/preferred name, gender), **Coach-restricted** (contacts,
measurements, age band, jersey size), **Admin-restricted** (raw DOB, audit actors, status
reason, alias lineage). National IDs and payment/auth secrets are **not imported or
stored** by default. Audit context in `security_events` is ids only — never PII.

## 7. Authorization matrix (proven in `test/members.e2e-spec.ts`)

Allowed vs `403 permissionDenied` (forbidden role, suspended account, wrong team scope),
`403 profileForbidden` (non-owner without manage), `404 membershipNotFound` (forged id),
`400 invalidUuid`, `409` for invalid transition / version conflict / jersey conflict /
alias conflict / media-not-scanned. Every protected op checks auth + permission + team
scope + ownership/lifecycle + field shaping.

## 8. Deferred (documented)

- **Season-scoped rostering.** `season_id` is an optional forward-looking tag on a
  membership; season/team consistency checks and per-season jersey scope are owned by the
  future squad/roster module.
- **Database-level jersey exclusion constraint.** Scoped active jersey uniqueness spans
  membership status/season, so it is enforced in the application layer (mirroring the
  teams season-overlap approach) rather than a DB constraint.
- **Availability/injury periods.** Highly-restricted readiness data is deferred to a later
  slice.
