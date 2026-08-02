import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Injectable } from '@nestjs/common';

import {
  parseStaffAssignmentStatus,
  toDate,
  toNullableDate,
} from '../lib/teams.helpers';
import {
  PUBLIC_STAFF_DIRECTORY_MAX,
  STAFF_ASSIGNMENT_COLUMNS,
  STAFF_DIRECTORY_FALLBACK_NAME,
} from '../model/teams.constants';
import type {
  CountRow,
  IdRow,
  StaffAssignmentRow,
  StaffDirectoryRow,
} from '../model/teams.rows';
import type {
  ListStaffAssignmentsResult,
  NewStaffAssignment,
  PageRequest,
  StaffAssignment,
  StaffAssignmentRemoval,
  StaffDirectoryEntry,
} from '../model/teams.types';

/**
 * Persistence for the staff-title assignment aggregate. Data access only:
 * parameterized SQL through the caller's transaction scope, a static column
 * list, bounded/paginated reads, optimistic-version guarded writes.
 * Assignments are soft-removed, never deleted, so history stays intact.
 */
@Injectable()
export class StaffAssignmentRepository {
  /** True when the membership exists, in this team, and is not soft-removed. */
  async membershipExistsInTeam(
    scope: TransactionScope,
    teamId: string,
    membershipId: string,
  ): Promise<boolean> {
    const rows = await scope.run<IdRow>(
      `SELECT "id" FROM "memberships"
        WHERE "id" = $1 AND "team_id" = $2 AND "deleted_at" IS NULL`,
      [membershipId, teamId],
    );
    return rows.length > 0;
  }

  async existsActive(
    scope: TransactionScope,
    teamId: string,
    membershipId: string,
    titleEntryId: string,
  ): Promise<boolean> {
    const rows = await scope.run<IdRow>(
      `SELECT "id" FROM "team_staff_assignments"
        WHERE "team_id" = $1 AND "membership_id" = $2 AND "title_entry_id" = $3
          AND "status" = 'active'`,
      [teamId, membershipId, titleEntryId],
    );
    return rows.length > 0;
  }

  async findByIdInTeam(
    scope: TransactionScope,
    teamId: string,
    id: string,
  ): Promise<StaffAssignment | null> {
    const rows = await scope.run<StaffAssignmentRow>(
      `SELECT ${STAFF_ASSIGNMENT_COLUMNS} FROM "team_staff_assignments"
        WHERE "id" = $1 AND "team_id" = $2`,
      [id, teamId],
    );
    const row = rows[0];
    return row === undefined ? null : this.toAssignment(row);
  }

  async insert(
    scope: TransactionScope,
    assignment: NewStaffAssignment,
  ): Promise<StaffAssignment> {
    const rows = await scope.run<StaffAssignmentRow>(
      `INSERT INTO "team_staff_assignments" ("id", "team_id", "membership_id",
              "title_entry_id", "photo_url", "created_by", "created_at",
              "updated_at")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $7)
       RETURNING ${STAFF_ASSIGNMENT_COLUMNS}`,
      [
        assignment.id,
        assignment.teamId,
        assignment.membershipId,
        assignment.titleEntryId,
        assignment.photoUrl,
        assignment.createdBy,
        assignment.now.toISOString(),
      ],
    );
    return this.toAssignment(this.requireRow(rows));
  }

  async remove(
    scope: TransactionScope,
    removal: StaffAssignmentRemoval,
  ): Promise<StaffAssignment | null> {
    const rows = await scope.run<StaffAssignmentRow>(
      `UPDATE "team_staff_assignments"
          SET "status" = 'removed', "removed_by" = $3, "removed_at" = $4,
              "updated_at" = $4, "version" = "version" + 1
        WHERE "id" = $1 AND "team_id" = $2 AND "status" = 'active'
       RETURNING ${STAFF_ASSIGNMENT_COLUMNS}`,
      [
        removal.id,
        removal.teamId,
        removal.updatedBy,
        removal.now.toISOString(),
      ],
    );
    const row = rows[0];
    return row === undefined ? null : this.toAssignment(row);
  }

  async listByTeam(
    scope: TransactionScope,
    teamId: string,
    page: PageRequest,
  ): Promise<ListStaffAssignmentsResult> {
    const rows = await scope.run<StaffAssignmentRow>(
      `SELECT ${STAFF_ASSIGNMENT_COLUMNS} FROM "team_staff_assignments"
        WHERE "team_id" = $1 AND "status" = 'active'
        ORDER BY "created_at" ASC, "id" ASC
        LIMIT $2 OFFSET $3`,
      [teamId, page.limit, page.offset],
    );
    const counts = await scope.run<CountRow>(
      `SELECT COUNT(*)::int AS "count" FROM "team_staff_assignments"
        WHERE "team_id" = $1 AND "status" = 'active'`,
      [teamId],
    );
    return {
      items: rows.map(row => this.toAssignment(row)),
      total: counts[0]?.count ?? 0,
      limit: page.limit,
      offset: page.offset,
    };
  }

  /**
   * The public "who's who": one row per membership holding at least one
   * active staff title, with every held title's label aggregated. Reuses the
   * members module's LEFT JOIN display-name fallback pattern (profile
   * preferred/full name, else the linked account's display name/email) so no
   * private field is exposed and no domain logic is duplicated.
   */
  async listPublicDirectory(
    scope: TransactionScope,
    teamId: string,
  ): Promise<readonly StaffDirectoryEntry[]> {
    const rows = await scope.run<StaffDirectoryRow>(
      `SELECT "m"."id" AS "membership_id",
              COALESCE("p"."preferred_name", "p"."full_name",
                       "u"."display_name", "u"."email") AS "display_name",
              "p"."nickname" AS "nickname",
              array_agg(DISTINCT "rce"."label" ORDER BY "rce"."label") AS "titles",
              MAX("tsa"."photo_url") AS "photo_url"
         FROM "team_staff_assignments" "tsa"
         JOIN "memberships" "m" ON "m"."id" = "tsa"."membership_id"
         JOIN "reference_catalog_entries" "rce" ON "rce"."id" = "tsa"."title_entry_id"
         LEFT JOIN "member_profiles" "p" ON "p"."membership_id" = "m"."id"
         LEFT JOIN "users" "u" ON "u"."id" = "m"."user_id"
        WHERE "tsa"."team_id" = $1 AND "tsa"."status" = 'active'
          AND "m"."status" = 'active' AND "m"."deleted_at" IS NULL
        GROUP BY "m"."id", "p"."preferred_name", "p"."full_name",
                 "u"."display_name", "u"."email", "p"."nickname"
        ORDER BY lower("display_name") ASC NULLS LAST, "m"."id" ASC
        LIMIT $2`,
      [teamId, PUBLIC_STAFF_DIRECTORY_MAX],
    );
    return rows.map(row => this.toDirectoryEntry(row));
  }

  private toDirectoryEntry(row: StaffDirectoryRow): StaffDirectoryEntry {
    return {
      membershipId: row.membership_id,
      displayName: row.display_name ?? STAFF_DIRECTORY_FALLBACK_NAME,
      nickname: row.nickname,
      titles: row.titles,
      photoUrl: row.photo_url,
    };
  }

  private requireRow(rows: readonly StaffAssignmentRow[]): StaffAssignmentRow {
    const row = rows[0];
    if (row === undefined) {
      throw new Error(
        'Expected a returned row from the staff assignment write',
      );
    }
    return row;
  }

  private toAssignment(row: StaffAssignmentRow): StaffAssignment {
    return {
      id: row.id,
      teamId: row.team_id,
      membershipId: row.membership_id,
      titleEntryId: row.title_entry_id,
      photoUrl: row.photo_url,
      status: parseStaffAssignmentStatus(row.status),
      createdBy: row.created_by,
      removedBy: row.removed_by,
      createdAt: toDate(row.created_at),
      updatedAt: toDate(row.updated_at),
      removedAt: toNullableDate(row.removed_at),
      version: row.version,
    };
  }
}
