import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Injectable } from '@nestjs/common';

import { parseMembershipStatus, toMembership } from '../lib/members.helpers';
import {
  CLAIMABLE_MEMBERSHIPS_MAX,
  DIRECTORY_FALLBACK_NAME,
  MEMBERSHIP_COLUMNS,
  MEMBERSHIP_COLUMNS_QUALIFIED,
} from '../model/members.constants';
import { MembershipStatus } from '../model/members.enums';
import type {
  CountRow,
  DirectoryRow,
  IdRow,
  MembershipRow,
} from '../model/members.rows';
import type {
  ListMembersResult,
  Membership,
  MembershipClaim,
  MembershipStatusChange,
  NewMembership,
  PageRequest,
} from '../model/members.types';

/**
 * Persistence for the memberships aggregate. Data access only: parameterized SQL
 * through the caller's transaction scope, static column lists, optimistic-version
 * guarded writes, soft-delete aware reads. Maps snake_case rows into the
 * vendor-free Membership type.
 */
@Injectable()
export class MembershipRepository {
  async findById(
    scope: TransactionScope,
    teamId: string,
    id: string,
  ): Promise<Membership | null> {
    const rows = await scope.run<MembershipRow>(
      `SELECT ${MEMBERSHIP_COLUMNS} FROM "memberships"
        WHERE "id" = $1 AND "team_id" = $2 AND "deleted_at" IS NULL`,
      [id, teamId],
    );
    const row = rows[0];
    return row === undefined ? null : toMembership(row);
  }

  async findActiveByUser(
    scope: TransactionScope,
    teamId: string,
    userId: string,
  ): Promise<Membership | null> {
    const rows = await scope.run<MembershipRow>(
      `SELECT ${MEMBERSHIP_COLUMNS} FROM "memberships"
        WHERE "team_id" = $1 AND "user_id" = $2 AND "status" = 'active'
          AND "deleted_at" IS NULL
        ORDER BY "created_at" ASC LIMIT 1`,
      [teamId, userId],
    );
    const row = rows[0];
    return row === undefined ? null : toMembership(row);
  }

  async existsForUserScope(
    scope: TransactionScope,
    teamId: string,
    userId: string,
    seasonId: string | null,
  ): Promise<boolean> {
    const rows = await scope.run<IdRow>(
      `SELECT "id" FROM "memberships"
        WHERE "team_id" = $1 AND "user_id" = $2
          AND "season_id" IS NOT DISTINCT FROM $3
          AND "deleted_at" IS NULL
          AND "status" NOT IN ('archived', 'anonymized', 'left')`,
      [teamId, userId, seasonId],
    );
    return rows.length > 0;
  }

  async insert(
    scope: TransactionScope,
    membership: NewMembership,
  ): Promise<Membership> {
    const rows = await scope.run<MembershipRow>(
      `INSERT INTO "memberships" ("id", "team_id", "season_id", "user_id",
              "status", "status_effective_at", "joined_at", "created_by",
              "created_at", "updated_at")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)
       RETURNING ${MEMBERSHIP_COLUMNS}`,
      [
        membership.id,
        membership.teamId,
        membership.seasonId,
        membership.userId,
        membership.status,
        membership.statusEffectiveAt.toISOString(),
        membership.status === MembershipStatus.Active
          ? membership.statusEffectiveAt.toISOString()
          : null,
        membership.createdBy,
        membership.now.toISOString(),
      ],
    );
    return toMembership(this.requireRow(rows));
  }

  async applyStatusChange(
    scope: TransactionScope,
    change: MembershipStatusChange,
  ): Promise<Membership | null> {
    const rows = await scope.run<MembershipRow>(
      `UPDATE "memberships"
          SET "status" = $2, "status_reason" = $3, "status_effective_at" = $4,
              "joined_at" = $5, "left_at" = $6, "anonymized_at" = $7,
              "updated_by" = $8, "updated_at" = $9, "version" = "version" + 1
        WHERE "id" = $1 AND "version" = $10 AND "deleted_at" IS NULL
       RETURNING ${MEMBERSHIP_COLUMNS}`,
      [
        change.id,
        change.toStatus,
        change.reason,
        change.statusEffectiveAt.toISOString(),
        change.joinedAt === null ? null : change.joinedAt.toISOString(),
        change.leftAt === null ? null : change.leftAt.toISOString(),
        change.anonymizedAt === null ? null : change.anonymizedAt.toISOString(),
        change.updatedBy,
        change.now.toISOString(),
        change.expectedVersion,
      ],
    );
    const row = rows[0];
    return row === undefined ? null : toMembership(row);
  }

  /**
   * The invited, still-unlinked memberships whose player profile carries this
   * email — the rows an invitation acceptance may claim. Optionally restricted
   * to one team when the invitation is team-scoped. Bounded and ordered
   * deterministically oldest-first.
   */
  async listInvitedUnlinkedByEmail(
    scope: TransactionScope,
    email: string,
    teamId: string | null,
  ): Promise<readonly Membership[]> {
    const rows = await scope.run<MembershipRow>(
      `SELECT ${MEMBERSHIP_COLUMNS_QUALIFIED} FROM "memberships" "m"
         JOIN "member_profiles" "p" ON "p"."membership_id" = "m"."id"
        WHERE lower("p"."email") = lower($1)
          AND "m"."status" = $2 AND "m"."user_id" IS NULL
          AND "m"."deleted_at" IS NULL
          AND ($3::uuid IS NULL OR "m"."team_id" = $3::uuid)
        ORDER BY "m"."created_at" ASC, "m"."id" ASC
        LIMIT $4`,
      [email, MembershipStatus.Invited, teamId, CLAIMABLE_MEMBERSHIPS_MAX],
    );
    return rows.map(row => toMembership(row));
  }

  /**
   * Link an invited membership to its new account and activate it in one
   * guarded UPDATE. Returns null when the row moved on (version bump, already
   * linked, or no longer invited) so the caller can skip it safely.
   */
  async linkUserAndActivate(
    scope: TransactionScope,
    claim: MembershipClaim,
  ): Promise<Membership | null> {
    const rows = await scope.run<MembershipRow>(
      `UPDATE "memberships"
          SET "user_id" = $2, "status" = $3, "status_effective_at" = $4,
              "joined_at" = COALESCE("joined_at", $4), "updated_by" = $2,
              "updated_at" = $5, "version" = "version" + 1
        WHERE "id" = $1 AND "version" = $6 AND "user_id" IS NULL
          AND "status" = $7 AND "deleted_at" IS NULL
       RETURNING ${MEMBERSHIP_COLUMNS}`,
      [
        claim.id,
        claim.userId,
        MembershipStatus.Active,
        claim.statusEffectiveAt.toISOString(),
        claim.now.toISOString(),
        claim.expectedVersion,
        MembershipStatus.Invited,
      ],
    );
    const row = rows[0];
    return row === undefined ? null : toMembership(row);
  }

  /**
   * One page of the member directory plus the total. Items and total read the
   * same membership population: the profile join is a LEFT JOIN, so an
   * account-only membership (no player profile yet — e.g. seeded personas)
   * still appears, named from the linked account. The COUNT applies the same
   * WHERE clause, so `total` always equals the sum of the pages.
   */
  async listDirectory(
    scope: TransactionScope,
    teamId: string,
    page: PageRequest,
  ): Promise<ListMembersResult> {
    const rows = await scope.run<DirectoryRow>(
      `SELECT "m"."id" AS "membership_id", "m"."team_id" AS "team_id",
              "m"."status" AS "status",
              COALESCE("p"."preferred_name", "p"."full_name",
                       "u"."display_name", "u"."email") AS "display_name",
              "p"."nickname" AS "nickname", "p"."jersey_number" AS "jersey_number",
              "p"."positions" AS "positions",
              ("p"."avatar_media_id" IS NOT NULL) AS "has_avatar"
         FROM "memberships" "m"
         LEFT JOIN "member_profiles" "p" ON "p"."membership_id" = "m"."id"
         LEFT JOIN "users" "u" ON "u"."id" = "m"."user_id"
        WHERE "m"."team_id" = $1 AND "m"."deleted_at" IS NULL
        ORDER BY lower(COALESCE("p"."preferred_name", "p"."full_name",
                       "u"."display_name", "u"."email")) ASC NULLS LAST,
                 "m"."id" ASC
        LIMIT $2 OFFSET $3`,
      [teamId, page.limit, page.offset],
    );
    const counts = await scope.run<CountRow>(
      `SELECT COUNT(*)::int AS "count" FROM "memberships"
        WHERE "team_id" = $1 AND "deleted_at" IS NULL`,
      [teamId],
    );
    return {
      items: rows.map(row => this.toDirectoryItem(row)),
      total: counts[0]?.count ?? 0,
      limit: page.limit,
      offset: page.offset,
    };
  }

  private toDirectoryItem(
    row: DirectoryRow,
  ): ListMembersResult['items'][number] {
    return {
      membershipId: row.membership_id,
      teamId: row.team_id,
      status: parseMembershipStatus(row.status),
      displayName: row.display_name ?? DIRECTORY_FALLBACK_NAME,
      nickname: row.nickname,
      jerseyNumber: row.jersey_number,
      positions: row.positions ?? [],
      hasAvatar: row.has_avatar,
    };
  }

  private requireRow(rows: readonly MembershipRow[]): MembershipRow {
    const row = rows[0];
    if (row === undefined) {
      throw new Error('Expected a returned row from the membership write');
    }
    return row;
  }
}
