# Member roles — canonical route decision and contract

Status: **accepted**, 2026-07-20. Supersedes the ambiguity recorded as _Gap 2_ in the
client's `docs/api-verification.md`.

## 1. The problem

Two shapes existed for the same product capability — "which roles does this person hold
in this team, and which may I give them?".

| Shape                                               | Owner   | Resource identity                             | Status before this change |
| --------------------------------------------------- | ------- | --------------------------------------------- | ------------------------- |
| `/rbac/assignments`, `/rbac/users/{id}/assignments` | RBAC    | **user id**, one row per (role, team, season) | implemented               |
| `/teams/{teamId}/members/{membershipId}/roles`      | Members | **membership id**, the whole set at once      | 404, client-only          |

The client's member profile screen addresses a **membership**, not a user id: a person
may exist in the roster without an account at all, and the screen never learns a user id.
Making it call `/rbac/**` would force the client to map membership → user, which it
cannot do, and would leak account identifiers into a roster screen.

## 2. Decision

**Both routes are canonical, for different callers.**

- `/teams/{teamId}/members/{membershipId}/roles` is the **product** surface. It is
  membership-scoped, set-shaped (`PUT` replaces the whole set), and it is what the member
  profile screen uses. It is implemented in the members module and **delegates entirely**
  to the RBAC public surface (`TeamRoleQueryService`, `ReplaceTeamRolesUseCase`). The
  members module models no roles of its own.
- `/rbac/assignments` and `/rbac/users/{userId}/assignments` remain the **administration**
  surface: user-scoped, row-shaped, season-aware, and able to express time-bounded
  grants (`effectiveTo`). Platform administration and audit tooling use it.

Rejected alternatives:

- _Only `/rbac/**`_ — the client cannot resolve a user id from a membership, and a roster
  screen should not handle account identifiers.
- _Only the membership route_ — loses season-scoped and time-bounded assignment, which the
  RBAC model supports and administration needs.
- _Duplicating the write logic in members_ — would fork the privilege-ceiling rule. The
  members route owns no transaction, no policy-version bump, and no audit write.

Both are in `contracts/openapi.json`, tagged `member-roles` and `rbac` respectively.

## 3. The membership-scoped contract

### `GET /teams/{teamId}/members/{membershipId}/roles`

Permission: `member.profile.read.coach` (coach-tier read inside the team scope).

```json
{
  "membershipId": "b1c0…",
  "roles": ["coach", "member"],
  "assignableRoles": ["analyst", "coach", "member", "scorekeeper"]
}
```

- `roles` — the role slugs this member holds **in this team**, sorted, de-duplicated.
  A membership with no linked account always returns `[]`.
- `assignableRoles` — the actor's **privilege ceiling**: every seeded bundle whose
  permissions the actor already holds in this team. Rendering it lets the UI show the
  ceiling instead of discovering it through a 403.

### `PUT /teams/{teamId}/members/{membershipId}/roles`

Permission: `member.roles.manage`. Body:

```json
{ "roles": ["coach", "member"] }
```

The list is **absolute**: slugs present are granted, slugs absent are revoked, slugs
already held are left untouched (their original grant timestamp and audit trail survive).
The response is the same shape as `GET`.

### Slugs

Clients exchange lower-snake slugs; the database stores upper-snake keys. The single
translator is `src/modules/rbac/lib/role-slug.mapper.ts`, exported from the RBAC barrel.

| Slug          | Stored key    |
| ------------- | ------------- |
| `member`      | `MEMBER`      |
| `scorekeeper` | `SCOREKEEPER` |
| `analyst`     | `ANALYST`     |
| `coach`       | `COACH`       |
| `team_admin`  | `TEAM_ADMIN`  |

Any other value is rejected with `404 errors.rbac.roleNotFound` — a caller-supplied string
can never widen the role set.

## 4. Guarantees

- **Anti-escalation.** Every grant _and_ every revoke passes
  `PrivilegeCeilingService.assertCanManageRole` for the target team scope, so an actor can
  neither hand out nor take away a capability they do not themselves hold. Violations are
  `403 errors.rbac.escalationDenied`.
- **Team scope + ownership.** The membership is resolved inside `:teamId` first; a member
  addressed under the wrong team is `404 errors.members.membershipNotFound` and never
  leaks existence. The permissions guard independently resolves the team scope from the
  path param.
- **Atomicity.** The whole reconciliation runs in one RBAC transaction, bumps the policy
  version exactly once (invalidating resolver caches), and appends one audit event per
  change.
- **Accounts.** Roles are granted to accounts. A membership with no `user_id` is
  `409 errors.members.accountRequired` on write; it reads as holding no roles.

## 5. Error catalogue

| Situation                           | Status | `messageKey`                        |
| ----------------------------------- | ------ | ----------------------------------- |
| No bearer token                     | 401    | `errors.auth.tokenRequired`         |
| Missing read/write permission       | 403    | `errors.auth.permissionDenied`      |
| Role outside the actor's ceiling    | 403    | `errors.rbac.escalationDenied`      |
| Member not in this team             | 404    | `errors.members.membershipNotFound` |
| Unknown role slug                   | 404    | `errors.rbac.roleNotFound`          |
| Membership without a linked account | 409    | `errors.members.accountRequired`    |
| Malformed body                      | 400    | `errors.validation.failed`          |

## 6. Where the code lives

| Concern                    | File                                                               |
| -------------------------- | ------------------------------------------------------------------ |
| Transport                  | `src/modules/members/api/member-roles.controller.ts`               |
| Read projection            | `src/modules/members/application/member-roles.service.ts`          |
| Write orchestration        | `src/modules/members/application/replace-member-roles.use-case.ts` |
| RBAC read surface          | `src/modules/rbac/application/team-role-query.service.ts`          |
| RBAC write surface         | `src/modules/rbac/application/replace-team-roles.use-case.ts`      |
| Set reconciliation (pure)  | `src/modules/rbac/domain/role-set-diff.policy.ts`                  |
| Ceiling projection (pure)  | `src/modules/rbac/domain/privilege-ceiling.policy.ts`              |
| Slug translation (pure)    | `src/modules/rbac/lib/role-slug.mapper.ts`                         |
| Authorization matrix (e2e) | `test/member-roles.e2e-spec.ts`                                    |
