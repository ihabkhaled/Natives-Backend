import { randomUUID } from 'node:crypto';

import type { QueryRunner } from 'typeorm';

import {
  RECONCILE_EMAIL_BACKFILL_EVENT,
  RECONCILE_LINK_EVENT,
  RECONCILE_ROLE_EVENT,
  RECONCILE_ROLE_MISSING_PREFIX,
} from './reconcile-invited-memberships.constants';
import type {
  OrphanedInvitation,
  OrphanedInvitationRow,
  ReconcileIdRow,
  ReconcileResult,
} from './reconcile-invited-memberships.types';

/**
 * Reconciliation for invitations whose roster membership was written without
 * an email.
 *
 * Acceptance claims an invited membership by matching the invitation's address
 * against `member_profiles.email`, and grants the invited team role only for
 * the memberships it claims. A membership created without that address is
 * therefore unclaimable: the invitee finishes with an active account, an
 * orphaned `invited` membership, no team context and no role.
 *
 * Two populations, repaired differently:
 *
 * - **Pending** invitation: only the address is missing. Restoring it is all
 *   this does — the ordinary accept path then links and grants as designed.
 *   Nothing privileged happens here.
 * - **Accepted** invitation: the token is spent and cannot be replayed, so the
 *   membership is linked and activated and the role the invitation already
 *   promised is granted. The role comes from `invitations.team_role_key`,
 *   ceiling-validated when the invitation was issued — this delivers that
 *   promise, it does not infer a new one.
 *
 * The only inference is WHICH membership belongs to an invitation, and it is
 * made only when the pairing is forced: exactly one invited, unlinked,
 * email-less membership in the team, and exactly one orphaned invitation
 * competing for it. Anything else is reported as ambiguous and left untouched
 * for a human, because guessing attaches a person to a stranger's record.
 *
 * Operator-reviewed two-step, never wired to startup: the dry run prints the
 * plan and mutates nothing; `--apply` performs exactly the listed repairs in
 * one transaction, each with an audit row.
 */
export async function runInvitedMembershipReconciliation(
  queryRunner: QueryRunner,
  apply: boolean,
): Promise<ReconcileResult> {
  const orphans = await listOrphans(queryRunner);
  const repairable = orphans.filter(orphan => orphan.verdict === 'repairable');
  if (!apply || repairable.length === 0) {
    return { orphans, repaired: [], applied: false };
  }
  for (const orphan of repairable) {
    await repair(queryRunner, orphan);
  }
  await bumpPolicyVersion(queryRunner);
  return { orphans, repaired: repairable, applied: true };
}

/**
 * Every team-scoped invitation that no membership can satisfy, with the count
 * of candidate memberships that decides whether it is safe to repair.
 *
 * An invitation is orphaned when no membership in its team carries its email:
 * for a pending one that means acceptance is about to claim nothing, and for
 * an accepted one it means acceptance already claimed nothing.
 */
async function listOrphans(
  queryRunner: QueryRunner,
): Promise<readonly OrphanedInvitation[]> {
  const rows = (await queryRunner.query(
    `WITH "candidates" AS (
        SELECT m."id", m."team_id"
          FROM "memberships" m
          JOIN "member_profiles" p ON p."membership_id" = m."id"
         WHERE m."status" = 'invited' AND m."user_id" IS NULL
           AND m."deleted_at" IS NULL AND p."email" IS NULL
     ), "orphans" AS (
        SELECT i."id", i."email", i."team_id", i."team_role_key", i."status",
               i."created_at"
          FROM "invitations" i
         WHERE i."team_id" IS NOT NULL
           AND i."status" IN ('pending', 'accepted')
           AND NOT EXISTS (
             SELECT 1 FROM "memberships" m
               JOIN "member_profiles" p ON p."membership_id" = m."id"
              WHERE m."team_id" = i."team_id" AND m."deleted_at" IS NULL
                AND lower(p."email") = lower(i."email")
           )
     )
     SELECT o."id" AS "invitation_id", o."email", o."team_id",
            o."team_role_key", o."status",
            u."id" AS "user_id",
            (SELECT count(*) FROM "candidates" c WHERE c."team_id" = o."team_id")
              AS "candidate_count",
            (SELECT count(*) FROM "orphans" p WHERE p."team_id" = o."team_id")
              AS "invitation_count",
            (SELECT c."id" FROM "candidates" c WHERE c."team_id" = o."team_id"
              LIMIT 1) AS "membership_id"
       FROM "orphans" o
       LEFT JOIN "users" u ON lower(u."email") = lower(o."email")
      ORDER BY o."created_at" ASC, o."id" ASC`,
  )) as readonly OrphanedInvitationRow[];
  return rows.map(row => toOrphan(row));
}

/**
 * Repairable means the pairing is forced, not merely plausible: exactly one
 * email-less membership in the team AND exactly one orphaned invitation for it.
 *
 * Two orphaned invitations over one candidate membership is the dangerous
 * shape. Both would name the same row, the first repair would take it, and the
 * second would be left holding an invitation with nothing to link — so it is
 * reported instead. Whichever of those two people the roster row belongs to is
 * a question only a human can answer.
 */
function toOrphan(row: OrphanedInvitationRow): OrphanedInvitation {
  const candidateCount = Number(row.candidate_count);
  const invitationCount = Number(row.invitation_count);
  const forced =
    candidateCount === 1 && invitationCount === 1 && row.membership_id !== null;
  return {
    invitationId: row.invitation_id,
    email: row.email,
    teamId: row.team_id,
    teamRoleKey: row.team_role_key,
    status: row.status === 'accepted' ? 'accepted' : 'pending',
    membershipId: forced ? row.membership_id : null,
    candidateCount,
    invitationCount,
    userId: row.user_id,
    verdict: forced ? 'repairable' : 'ambiguous',
  };
}

/**
 * A pending invitation needs only its address back. An accepted one is spent,
 * so the membership is linked and the promised role granted directly — but
 * only once an account actually exists to link to.
 */
async function repair(
  queryRunner: QueryRunner,
  orphan: OrphanedInvitation,
): Promise<void> {
  await restoreProfileEmail(queryRunner, orphan);
  if (orphan.status !== 'accepted' || orphan.userId === null) {
    return;
  }
  // The grant is conditional on the link, not merely sequenced after it. A role
  // assignment for somebody who holds no membership in the team is a permission
  // with nothing behind it, and the UPDATE is the only thing that can say
  // whether the row was still there to take.
  const linked = await linkAndActivate(queryRunner, orphan, orphan.userId);
  if (linked) {
    await grantInvitedRole(queryRunner, orphan, orphan.userId);
  }
}

async function restoreProfileEmail(
  queryRunner: QueryRunner,
  orphan: OrphanedInvitation,
): Promise<void> {
  await queryRunner.query(
    `UPDATE "member_profiles" SET "email" = $2, "updated_at" = now()
      WHERE "membership_id" = $1 AND "email" IS NULL`,
    [orphan.membershipId, orphan.email],
  );
  await recordAudit(queryRunner, RECONCILE_EMAIL_BACKFILL_EVENT, orphan, {});
}

/**
 * Take the membership, or report that it was already gone. The guard reproduces
 * the state machine's own preconditions, and RETURNING is what makes the result
 * observable: a repair earlier in this same run may have claimed the row.
 */
async function linkAndActivate(
  queryRunner: QueryRunner,
  orphan: OrphanedInvitation,
  userId: string,
): Promise<boolean> {
  const linked = (await queryRunner.query(
    `UPDATE "memberships"
        SET "user_id" = $2, "status" = 'active', "status_effective_at" = now(),
            "joined_at" = COALESCE("joined_at", now()), "updated_at" = now(),
            "version" = "version" + 1
      WHERE "id" = $1 AND "user_id" IS NULL AND "status" = 'invited'
        AND "deleted_at" IS NULL
    RETURNING "id"`,
    [orphan.membershipId, userId],
  )) as readonly ReconcileIdRow[];
  if (linked.length === 0) {
    return false;
  }
  await queryRunner.query(
    `INSERT INTO "membership_status_events" ("id", "membership_id",
            "from_status", "to_status", "reason", "actor_user_id",
            "effective_at", "occurred_at")
     VALUES ($1, $2, 'invited', 'active', $3, NULL, now(), now())`,
    [randomUUID(), orphan.membershipId, RECONCILE_LINK_EVENT],
  );
  await recordAudit(queryRunner, RECONCILE_LINK_EVENT, orphan, {
    targetUserId: userId,
  });
  return true;
}

async function grantInvitedRole(
  queryRunner: QueryRunner,
  orphan: OrphanedInvitation,
  userId: string,
): Promise<void> {
  const roleId = await resolveRoleId(queryRunner, orphan.teamRoleKey);
  const assignmentId = randomUUID();
  await queryRunner.query(
    `INSERT INTO "user_role_assignments"
       ("id", "user_id", "role_id", "team_id", "season_id", "granted_by")
     SELECT $1, $2, $3, $4, NULL, NULL
      WHERE NOT EXISTS (
        SELECT 1 FROM "user_role_assignments"
         WHERE "user_id" = $2 AND "role_id" = $3 AND "team_id" = $4
           AND "revoked_at" IS NULL
      )`,
    [assignmentId, userId, roleId, orphan.teamId],
  );
  await recordAudit(queryRunner, RECONCILE_ROLE_EVENT, orphan, {
    assignmentId,
    targetUserId: userId,
    roleKey: orphan.teamRoleKey,
  });
}

async function resolveRoleId(
  queryRunner: QueryRunner,
  roleKey: string,
): Promise<string> {
  const rows = (await queryRunner.query(
    `SELECT "id" FROM "roles" WHERE "key" = $1`,
    [roleKey],
  )) as readonly ReconcileIdRow[];
  const row = rows[0];
  if (row === undefined) {
    throw new Error(`${RECONCILE_ROLE_MISSING_PREFIX} "${roleKey}".`);
  }
  return row.id;
}

/** Every repair is attributable: system provenance, never a borrowed actor. */
async function recordAudit(
  queryRunner: QueryRunner,
  eventType: string,
  orphan: OrphanedInvitation,
  extra: Readonly<Record<string, unknown>>,
): Promise<void> {
  await queryRunner.query(
    `INSERT INTO "security_events" ("id", "event_type", "actor_user_id",
            "context", "occurred_at")
     VALUES ($1, $2, NULL, $3::jsonb, now())`,
    [
      randomUUID(),
      eventType,
      JSON.stringify({
        invitationId: orphan.invitationId,
        membershipId: orphan.membershipId,
        teamId: orphan.teamId,
        reconciliation: true,
        ...extra,
      }),
    ],
  );
}

async function bumpPolicyVersion(queryRunner: QueryRunner): Promise<void> {
  await queryRunner.query(
    `UPDATE "rbac_policy_version"
        SET "version" = "version" + 1, "updated_at" = now()
      WHERE "singleton" = true`,
  );
}
