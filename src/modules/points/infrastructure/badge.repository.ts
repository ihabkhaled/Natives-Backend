import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Injectable } from '@nestjs/common';

import { toBadgeDefinition, toPlayerBadge } from '../lib/points.mapper';
import {
  BADGE_DEFINITION_COLUMNS,
  PLAYER_BADGE_COLUMNS,
  PLAYER_BADGE_LIMIT,
} from '../model/points.constants';
import { BadgeStatus } from '../model/points.enums';
import type {
  BadgeDefinitionRow,
  IdRow,
  PlayerBadgeRow,
} from '../model/points.rows';
import type {
  BadgeDefinition,
  NewPlayerBadge,
  PlayerBadge,
} from '../model/points.types';

/**
 * Persistence for badge tier definitions and the badges members have earned. Only
 * ACTIVE definitions are surfaced for awarding, so seeded `needs_approval`
 * candidates and the disabled broken tier are never awarded. Player-badge inserts
 * are idempotent by the unique (membership, definition) key — crossing a threshold
 * twice never doubles a badge.
 */
@Injectable()
export class BadgeRepository {
  async listActive(
    scope: TransactionScope,
    teamId: string,
  ): Promise<readonly BadgeDefinition[]> {
    const rows = await scope.run<BadgeDefinitionRow>(
      `SELECT ${BADGE_DEFINITION_COLUMNS} FROM "badge_definitions"
        WHERE ("team_id" = $1 OR "team_id" IS NULL) AND "status" = $2
        ORDER BY "threshold" ASC, "id" ASC`,
      [teamId, BadgeStatus.Active],
    );
    return rows.map(row => toBadgeDefinition(row));
  }

  async earnedDefinitionIds(
    scope: TransactionScope,
    membershipId: string,
  ): Promise<readonly string[]> {
    const rows = await scope.run<IdRow>(
      `SELECT "badge_definition_id" AS "id" FROM "player_badges"
        WHERE "membership_id" = $1`,
      [membershipId],
    );
    return rows.map(row => row.id);
  }

  async insertPlayerBadge(
    scope: TransactionScope,
    badge: NewPlayerBadge,
  ): Promise<PlayerBadge | null> {
    const rows = await scope.run<PlayerBadgeRow>(
      `INSERT INTO "player_badges"
        ("id", "team_id", "membership_id", "badge_definition_id", "badge_key",
         "threshold", "points_at_award", "awarded_by", "awarded_at")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT ("membership_id", "badge_definition_id") DO NOTHING
       RETURNING ${PLAYER_BADGE_COLUMNS}`,
      this.insertParameters(badge),
    );
    const row = rows[0];
    return row === undefined ? null : toPlayerBadge(row);
  }

  async listForMembership(
    scope: TransactionScope,
    membershipId: string,
  ): Promise<readonly PlayerBadge[]> {
    const rows = await scope.run<PlayerBadgeRow>(
      `SELECT ${PLAYER_BADGE_COLUMNS} FROM "player_badges"
        WHERE "membership_id" = $1
        ORDER BY "threshold" ASC, "awarded_at" ASC, "id" ASC
        LIMIT ${PLAYER_BADGE_LIMIT}`,
      [membershipId],
    );
    return rows.map(row => toPlayerBadge(row));
  }

  private insertParameters(badge: NewPlayerBadge): readonly unknown[] {
    return [
      badge.id,
      badge.teamId,
      badge.membershipId,
      badge.badgeDefinitionId,
      badge.badgeKey,
      badge.threshold,
      badge.pointsAtAward,
      badge.awardedBy,
      badge.now.toISOString(),
    ];
  }
}
