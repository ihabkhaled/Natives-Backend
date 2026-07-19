import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Injectable } from '@nestjs/common';

import { toActivityBuddy } from '../lib/activity.mapper';
import { ACTIVITY_BUDDY_COLUMNS } from '../model/activities.constants';
import type { ActivityBuddyRow, CountRow } from '../model/activity.rows';
import type {
  ActivityBuddy,
  BuddyResponseUpdate,
  NewActivityBuddy,
  PageRequest,
} from '../model/activity.types';

/**
 * Persistence for training buddies. Buddy credits are fixed at submission creation
 * (one row per co-participant) and answered independently by the credited member.
 * Ownership-checked lookups join memberships so a member can only ever see or
 * answer buddy credits pointing at their own membership. Parameterized SQL,
 * static column lists, bounded ordered reads.
 */
@Injectable()
export class ActivityBuddyRepository {
  async insertMany(
    scope: TransactionScope,
    buddies: readonly NewActivityBuddy[],
  ): Promise<void> {
    if (buddies.length === 0) {
      return;
    }
    await scope.run(
      `INSERT INTO "activity_buddies"
        ("id", "submission_id", "membership_id", "status", "created_at")
       SELECT input."id", input."submission_id", input."membership_id",
              input."status", input."created_at"
         FROM jsonb_to_recordset($1::jsonb) AS input(
           "id" uuid, "submission_id" uuid, "membership_id" uuid,
           "status" text, "created_at" timestamptz)`,
      [JSON.stringify(buddies.map(buddy => this.record(buddy)))],
    );
  }

  async listForSubmission(
    scope: TransactionScope,
    submissionId: string,
  ): Promise<readonly ActivityBuddy[]> {
    const rows = await scope.run<ActivityBuddyRow>(
      `SELECT ${ACTIVITY_BUDDY_COLUMNS} FROM "activity_buddies"
        WHERE "submission_id" = $1
        ORDER BY "created_at" ASC, "id" ASC`,
      [submissionId],
    );
    return rows.map(row => toActivityBuddy(row));
  }

  async buddiesBySubmission(
    scope: TransactionScope,
    submissionIds: readonly string[],
  ): Promise<ReadonlyMap<string, readonly ActivityBuddy[]>> {
    const grouped = new Map<string, ActivityBuddy[]>();
    if (submissionIds.length === 0) {
      return grouped;
    }
    const rows = await scope.run<ActivityBuddyRow>(
      `SELECT ${ACTIVITY_BUDDY_COLUMNS} FROM "activity_buddies"
        WHERE "submission_id" = ANY($1::uuid[])
        ORDER BY "submission_id" ASC, "created_at" ASC, "id" ASC`,
      [submissionIds],
    );
    for (const row of rows) {
      const bucket = grouped.get(row.submission_id) ?? [];
      bucket.push(toActivityBuddy(row));
      grouped.set(row.submission_id, bucket);
    }
    return grouped;
  }

  async findOwnedForResponse(
    scope: TransactionScope,
    teamId: string,
    buddyId: string,
    userId: string,
  ): Promise<ActivityBuddy | null> {
    const rows = await scope.run<ActivityBuddyRow>(
      `SELECT ${this.qualified()} FROM "activity_buddies" b
         JOIN "memberships" m ON m."id" = b."membership_id"
         JOIN "activity_submissions" s ON s."id" = b."submission_id"
        WHERE b."id" = $1 AND m."user_id" = $2 AND s."team_id" = $3
          AND m."deleted_at" IS NULL AND s."deleted_at" IS NULL`,
      [buddyId, userId, teamId],
    );
    const row = rows[0];
    return row === undefined ? null : toActivityBuddy(row);
  }

  async updateStatus(
    scope: TransactionScope,
    update: BuddyResponseUpdate,
  ): Promise<ActivityBuddy | null> {
    const rows = await scope.run<ActivityBuddyRow>(
      `UPDATE "activity_buddies"
          SET "status" = $2, "responded_at" = $3, "responded_by" = $4
        WHERE "id" = $1 AND "status" = 'pending'
       RETURNING ${ACTIVITY_BUDDY_COLUMNS}`,
      [
        update.id,
        update.toStatus,
        update.now.toISOString(),
        update.actorUserId,
      ],
    );
    const row = rows[0];
    return row === undefined ? null : toActivityBuddy(row);
  }

  async listPendingForMember(
    scope: TransactionScope,
    teamId: string,
    userId: string,
    page: PageRequest,
  ): Promise<readonly ActivityBuddy[]> {
    const rows = await scope.run<ActivityBuddyRow>(
      `SELECT ${this.qualified()} FROM "activity_buddies" b
         JOIN "memberships" m ON m."id" = b."membership_id"
         JOIN "activity_submissions" s ON s."id" = b."submission_id"
        WHERE m."user_id" = $1 AND s."team_id" = $2 AND b."status" = 'pending'
          AND m."deleted_at" IS NULL AND s."deleted_at" IS NULL
        ORDER BY b."created_at" DESC, b."id" ASC
        LIMIT $3 OFFSET $4`,
      [userId, teamId, page.limit, page.offset],
    );
    return rows.map(row => toActivityBuddy(row));
  }

  async countPendingForMember(
    scope: TransactionScope,
    teamId: string,
    userId: string,
  ): Promise<number> {
    const rows = await scope.run<CountRow>(
      `SELECT COUNT(*)::int AS "count" FROM "activity_buddies" b
         JOIN "memberships" m ON m."id" = b."membership_id"
         JOIN "activity_submissions" s ON s."id" = b."submission_id"
        WHERE m."user_id" = $1 AND s."team_id" = $2 AND b."status" = 'pending'
          AND m."deleted_at" IS NULL AND s."deleted_at" IS NULL`,
      [userId, teamId],
    );
    return rows[0]?.count ?? 0;
  }

  private qualified(): string {
    return ACTIVITY_BUDDY_COLUMNS.split(',')
      .map(column => `b.${column.trim()}`)
      .join(', ');
  }

  private record(buddy: NewActivityBuddy): Readonly<Record<string, unknown>> {
    return {
      id: buddy.id,
      submission_id: buddy.submissionId,
      membership_id: buddy.membershipId,
      status: buddy.status,
      created_at: buddy.now.toISOString(),
    };
  }
}
