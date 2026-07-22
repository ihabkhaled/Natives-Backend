import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Injectable } from '@nestjs/common';

import { toAliasResolution } from '../lib/migration.mapper';
import {
  ALIAS_RESOLUTION_COLUMNS,
  LIST_MAX_LIMIT,
} from '../model/migration.constants';
import type {
  AliasResolutionRow,
  MigrationCountRow,
} from '../model/migration.rows';
import type {
  AliasListFilter,
  AliasResolution,
  AliasReview,
  NewAliasResolution,
  PageRequest,
} from '../model/migration.types';

/**
 * Persistence for legacy alias resolutions. Data access only: parameterized SQL,
 * static column lists, optimistic-version-guarded review writes, and bounded
 * reads. Confirmations are upserted per normalized alias so re-registering the
 * same legacy name updates the row rather than duplicating it.
 */
@Injectable()
export class AliasResolutionRepository {
  async upsert(
    scope: TransactionScope,
    resolution: NewAliasResolution,
  ): Promise<AliasResolution> {
    const rows = await scope.run<AliasResolutionRow>(
      `INSERT INTO "alias_resolutions"
        ("id", "team_id", "source", "source_alias", "normalized_alias",
         "candidate_membership_id", "confidence", "status", "created_at",
         "updated_at")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)
       ON CONFLICT ("team_id", "normalized_alias", "source") DO UPDATE SET
         "source_alias" = EXCLUDED."source_alias",
         "candidate_membership_id" = EXCLUDED."candidate_membership_id",
         "confidence" = EXCLUDED."confidence",
         "updated_at" = EXCLUDED."updated_at"
       RETURNING ${ALIAS_RESOLUTION_COLUMNS}`,
      [
        resolution.id,
        resolution.teamId,
        resolution.source,
        resolution.sourceAlias,
        resolution.normalizedAlias,
        resolution.candidateMembershipId,
        resolution.confidence,
        resolution.status,
        resolution.now.toISOString(),
      ],
    );
    const row = rows[0];
    if (row === undefined) {
      throw new Error('Expected a returned row from the alias write');
    }
    return toAliasResolution(row);
  }

  async findForWrite(
    scope: TransactionScope,
    teamId: string,
    resolutionId: string,
  ): Promise<AliasResolution | null> {
    const rows = await scope.run<AliasResolutionRow>(
      `SELECT ${ALIAS_RESOLUTION_COLUMNS} FROM "alias_resolutions"
        WHERE "id" = $1 AND "team_id" = $2`,
      [resolutionId, teamId],
    );
    const row = rows[0];
    return row === undefined ? null : toAliasResolution(row);
  }

  async applyReview(
    scope: TransactionScope,
    review: AliasReview,
  ): Promise<AliasResolution | null> {
    const rows = await scope.run<AliasResolutionRow>(
      `UPDATE "alias_resolutions"
          SET "status" = $4, "resolved_membership_id" = $5, "override" = $6,
              "reviewed_by" = $7, "reviewed_at" = $8, "updated_at" = $8,
              "record_version" = "record_version" + 1
        WHERE "id" = $1 AND "team_id" = $2 AND "record_version" = $3
       RETURNING ${ALIAS_RESOLUTION_COLUMNS}`,
      [
        review.id,
        review.teamId,
        review.expectedRecordVersion,
        review.status,
        review.resolvedMembershipId,
        review.override,
        review.reviewedBy,
        review.now.toISOString(),
      ],
    );
    const row = rows[0];
    return row === undefined ? null : toAliasResolution(row);
  }

  async listForScope(
    scope: TransactionScope,
    teamId: string,
    filter: AliasListFilter,
    page: PageRequest,
  ): Promise<readonly AliasResolution[]> {
    const rows = await scope.run<AliasResolutionRow>(
      `SELECT ${ALIAS_RESOLUTION_COLUMNS} FROM "alias_resolutions"
        WHERE "team_id" = $1
          AND ($2::text IS NULL OR "status" = $2)
        ORDER BY "normalized_alias" ASC, "id" ASC
        LIMIT $3 OFFSET $4`,
      [
        teamId,
        filter.status,
        Math.min(page.limit, LIST_MAX_LIMIT),
        page.offset,
      ],
    );
    return rows.map(row => toAliasResolution(row));
  }

  async countForScope(
    scope: TransactionScope,
    teamId: string,
    filter: AliasListFilter,
  ): Promise<number> {
    const rows = await scope.run<MigrationCountRow>(
      `SELECT COUNT(*)::int AS "count" FROM "alias_resolutions"
        WHERE "team_id" = $1
          AND ($2::text IS NULL OR "status" = $2)`,
      [teamId, filter.status],
    );
    return Number(rows[0]?.count ?? 0);
  }
}
