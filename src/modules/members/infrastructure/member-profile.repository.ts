import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Injectable } from '@nestjs/common';

import { toMemberProfile } from '../lib/members.helpers';
import { MEMBER_PROFILE_COLUMNS as PROFILE_COLUMNS } from '../model/members.constants';
import type { JerseyRow, MemberProfileRow } from '../model/members.rows';
import type {
  JerseyReservation,
  MemberProfile,
  MemberProfileUpdate,
  NewMemberProfile,
  ProfileRedaction,
} from '../model/members.types';

/**
 * Persistence for the player-profile aggregate (1:1 with a membership). Data
 * access only: parameterized SQL, static column lists, optimistic-version guarded
 * writes. Date-only DOB is read as an ISO string; numeric measurements arrive as
 * strings and are mapped null-preservingly (null-not-zero).
 */
@Injectable()
export class MemberProfileRepository {
  async findByMembershipId(
    scope: TransactionScope,
    membershipId: string,
  ): Promise<MemberProfile | null> {
    const rows = await scope.run<MemberProfileRow>(
      `SELECT ${PROFILE_COLUMNS} FROM "member_profiles"
        WHERE "membership_id" = $1`,
      [membershipId],
    );
    const row = rows[0];
    return row === undefined ? null : toMemberProfile(row);
  }

  async insert(
    scope: TransactionScope,
    profile: NewMemberProfile,
  ): Promise<MemberProfile> {
    const p = profile.profile;
    const rows = await scope.run<MemberProfileRow>(
      `INSERT INTO "member_profiles" ("id", "membership_id", "team_id",
              "full_name", "preferred_name", "full_name_ar", "nickname", "email",
              "phone", "gender", "division", "positions", "jersey_number",
              "jersey_size", "height_cm", "weight_kg", "date_of_birth",
              "created_by", "created_at", "updated_at")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
              $16, $17, $18, $19, $19)
       RETURNING ${PROFILE_COLUMNS}`,
      [
        profile.id,
        profile.membershipId,
        profile.teamId,
        p.fullName,
        p.preferredName,
        p.fullNameAr,
        p.nickname,
        p.email,
        p.phone,
        p.gender,
        p.division,
        p.positions,
        p.jerseyNumber,
        p.jerseySize,
        p.heightCm,
        p.weightKg,
        p.dateOfBirth,
        profile.createdBy,
        profile.now.toISOString(),
      ],
    );
    return toMemberProfile(this.requireRow(rows));
  }

  async update(
    scope: TransactionScope,
    update: MemberProfileUpdate,
  ): Promise<MemberProfile | null> {
    const p = update.profile;
    const rows = await scope.run<MemberProfileRow>(
      `UPDATE "member_profiles"
          SET "full_name" = $2, "preferred_name" = $3, "full_name_ar" = $4,
              "nickname" = $5, "email" = $6, "phone" = $7, "gender" = $8,
              "division" = $9, "positions" = $10, "jersey_number" = $11,
              "jersey_size" = $12, "height_cm" = $13, "weight_kg" = $14,
              "date_of_birth" = $15, "updated_by" = $16, "updated_at" = $17,
              "version" = "version" + 1
        WHERE "membership_id" = $1 AND "version" = $18
       RETURNING ${PROFILE_COLUMNS}`,
      [
        update.membershipId,
        p.fullName,
        p.preferredName,
        p.fullNameAr,
        p.nickname,
        p.email,
        p.phone,
        p.gender,
        p.division,
        p.positions,
        p.jerseyNumber,
        p.jerseySize,
        p.heightCm,
        p.weightKg,
        p.dateOfBirth,
        update.updatedBy,
        update.now.toISOString(),
        update.expectedVersion,
      ],
    );
    const row = rows[0];
    return row === undefined ? null : toMemberProfile(row);
  }

  async updateAvatar(
    scope: TransactionScope,
    membershipId: string,
    avatarMediaId: string,
    updatedBy: string | null,
    now: Date,
  ): Promise<MemberProfile | null> {
    const rows = await scope.run<MemberProfileRow>(
      `UPDATE "member_profiles"
          SET "avatar_media_id" = $2, "updated_by" = $3, "updated_at" = $4,
              "version" = "version" + 1
        WHERE "membership_id" = $1
       RETURNING ${PROFILE_COLUMNS}`,
      [membershipId, avatarMediaId, updatedBy, now.toISOString()],
    );
    const row = rows[0];
    return row === undefined ? null : toMemberProfile(row);
  }

  async redact(
    scope: TransactionScope,
    redaction: ProfileRedaction,
  ): Promise<void> {
    await scope.run(
      `UPDATE "member_profiles"
          SET "full_name" = $2, "preferred_name" = NULL, "full_name_ar" = NULL,
              "nickname" = NULL, "email" = NULL, "phone" = NULL, "gender" = NULL,
              "division" = NULL, "positions" = '{}', "jersey_number" = NULL,
              "jersey_size" = NULL, "height_cm" = NULL, "weight_kg" = NULL,
              "date_of_birth" = NULL, "avatar_media_id" = NULL,
              "updated_by" = $3, "updated_at" = $4, "version" = "version" + 1
        WHERE "membership_id" = $1`,
      [
        redaction.membershipId,
        redaction.redactedName,
        redaction.updatedBy,
        redaction.now.toISOString(),
      ],
    );
  }

  async listActiveJerseys(
    scope: TransactionScope,
    teamId: string,
    seasonId: string | null,
    limit: number,
  ): Promise<readonly JerseyReservation[]> {
    const rows = await scope.run<JerseyRow>(
      `SELECT "p"."membership_id" AS "membership_id",
              "p"."jersey_number" AS "jersey_number"
         FROM "member_profiles" "p"
         JOIN "memberships" "m" ON "m"."id" = "p"."membership_id"
        WHERE "p"."team_id" = $1
          AND "m"."season_id" IS NOT DISTINCT FROM $2
          AND "p"."jersey_number" IS NOT NULL
          AND "m"."status" = 'active'
          AND "m"."deleted_at" IS NULL
        ORDER BY "p"."jersey_number" ASC
        LIMIT $3`,
      [teamId, seasonId, limit],
    );
    return rows.map(row => ({
      membershipId: row.membership_id,
      jerseyNumber: row.jersey_number,
    }));
  }

  private requireRow(rows: readonly MemberProfileRow[]): MemberProfileRow {
    const row = rows[0];
    if (row === undefined) {
      throw new Error('Expected a returned row from the profile write');
    }
    return row;
  }
}
