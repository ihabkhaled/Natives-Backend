import { randomUUID } from 'node:crypto';

import type { QueryRunner } from 'typeorm';

import {
  BACKFILL_AUDIT_EVENT_TYPE,
  BACKFILL_MEMBER_ROLE_KEY,
  BACKFILL_ROLE_MISSING_MESSAGE,
} from './backfill-member-roles.constants';
import type {
  BackfillCandidate,
  BackfillCandidateRow,
  BackfillIdRow,
  BackfillResult,
} from './backfill-member-roles.types';

/**
 * Prompt-100 reconciliation for members linked BEFORE acceptance granted a
 * role: every active membership whose linked user holds zero live assignments
 * in that team. Deliberately an operator-reviewed two-step — the dry run
 * prints the plan and mutates nothing; `apply` grants exactly the listed set
 * as MEMBER with `granted_by NULL` (system provenance) plus one audit event
 * per grant, and bumps the policy version once. Never wired to startup: an
 * unreviewed blanket grant is the failure mode this shape prevents.
 */
export async function runMemberRoleBackfill(
  queryRunner: QueryRunner,
  apply: boolean,
): Promise<BackfillResult> {
  const candidates = await listCandidates(queryRunner);
  if (!apply || candidates.length === 0) {
    return { candidates, applied: false };
  }
  const roleId = await resolveMemberRoleId(queryRunner);
  for (const candidate of candidates) {
    await grantMemberRole(queryRunner, roleId, candidate);
  }
  await bumpPolicyVersion(queryRunner);
  return { candidates, applied: true };
}

async function listCandidates(
  queryRunner: QueryRunner,
): Promise<readonly BackfillCandidate[]> {
  const rows = (await queryRunner.query(
    `SELECT m."id" AS "membership_id", m."user_id", m."team_id"
       FROM "memberships" m
      WHERE m."user_id" IS NOT NULL AND m."status" = 'active'
        AND NOT EXISTS (
          SELECT 1 FROM "user_role_assignments" a
           WHERE a."user_id" = m."user_id" AND a."team_id" = m."team_id"
             AND a."revoked_at" IS NULL
        )
      ORDER BY m."team_id" ASC, m."id" ASC`,
  )) as readonly BackfillCandidateRow[];
  return rows.map(row => ({
    membershipId: row.membership_id,
    userId: row.user_id,
    teamId: row.team_id,
  }));
}

async function resolveMemberRoleId(queryRunner: QueryRunner): Promise<string> {
  const rows = (await queryRunner.query(
    `SELECT "id" FROM "roles" WHERE "key" = $1`,
    [BACKFILL_MEMBER_ROLE_KEY],
  )) as readonly BackfillIdRow[];
  const row = rows[0];
  if (row === undefined) {
    throw new Error(BACKFILL_ROLE_MISSING_MESSAGE);
  }
  return row.id;
}

async function grantMemberRole(
  queryRunner: QueryRunner,
  roleId: string,
  candidate: BackfillCandidate,
): Promise<void> {
  const assignmentId = randomUUID();
  await queryRunner.query(
    `INSERT INTO "user_role_assignments"
       ("id", "user_id", "role_id", "team_id", "season_id", "granted_by")
     VALUES ($1, $2, $3, $4, NULL, NULL)`,
    [assignmentId, candidate.userId, roleId, candidate.teamId],
  );
  await queryRunner.query(
    `INSERT INTO "security_events" ("id", "event_type", "actor_user_id",
                                    "context", "occurred_at")
     VALUES ($1, $2, NULL, $3::jsonb, now())`,
    [
      randomUUID(),
      BACKFILL_AUDIT_EVENT_TYPE,
      JSON.stringify({
        assignmentId,
        targetUserId: candidate.userId,
        roleKey: BACKFILL_MEMBER_ROLE_KEY,
        teamId: candidate.teamId,
        membershipId: candidate.membershipId,
        backfill: true,
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
