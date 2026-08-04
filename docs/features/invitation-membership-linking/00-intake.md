# UN-P0-INV intake

- Request ID: UN-P0-INV
- Title: Invitation, membership, and role linking integrity
- Type: P0 defect — cross-repository data-integrity and onboarding failure
- Source: Ultimate Natives Live Regression & Completion Prompt Pack v3,
  `05-P0-RELIABILITY/010` (compatibility hotfix) and `050` (orphan reconciliation);
  delivery batch `17-DELIVERY-BATCHES/020-batch-01`
- Owners: identity owner, members owner, RBAC owner, QA, operations
- Severity / urgency: P0 / release-blocking — no invited person can use the product
- Affected domains: identity (invitations), members (memberships, profiles), RBAC
  (team role assignments), frontend members module
- Delivery track: standard track, backend-compatible frontend repair first
- Scope: make the invited membership carry the address acceptance matches on;
  repair the memberships already written without it.
- Critical-risk flags: privilege grant during reconciliation, production data
  repair, identity linkage, ambiguous record matching.

## Evidence at intake

Verified in current source, not inherited from the pack's audited baseline
(`Natives-App` `fe8c438`): the defect is still present at `Natives-App` `0a99df4`
and `Natives-Backend` `bf1ddb8`.

- `src/modules/members/types/members.types.ts` — `InviteMemberInput` carried
  `fullName`, `nickname`, `jerseyNumber`. No email.
- `src/modules/members/gateways/members.gateway.ts` — `buildProfileBody` emitted
  those three fields only.
- `src/modules/members/services/invite-member-by-email.service.ts` — held the
  address, passed it to the invitation, never to the membership.
- `PlayerProfileDto.email` exists and is optional; `contracts/openapi.json` 1.7.0
  declares it. The server was ready; the client never sent it.
- `membership.repository.ts#listInvitedUnlinkedByEmail` matches
  `lower(p.email) = lower($1)`, so a null profile email matches nothing.
