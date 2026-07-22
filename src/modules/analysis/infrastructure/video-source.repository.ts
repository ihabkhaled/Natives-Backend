import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Injectable } from '@nestjs/common';

import { toVideoSource } from '../lib/analysis.mapper';
import {
  LIST_MAX_LIMIT,
  VIDEO_SOURCE_COLUMNS,
} from '../model/analysis.constants';
import type { AnalysisCountRow, VideoSourceRow } from '../model/analysis.rows';
import type {
  NewVideoSource,
  PageRequest,
  VideoSource,
  VideoSourceListFilter,
} from '../model/analysis.types';

/**
 * Persistence for registered video sources. Data access only: parameterized SQL
 * through the caller's transaction scope, static column lists, and bounded,
 * deterministically ordered reads with allow-listed filters. The opaque provider
 * reference is stored; the recording itself never touches the application.
 */
@Injectable()
export class VideoSourceRepository {
  async insert(
    scope: TransactionScope,
    source: NewVideoSource,
  ): Promise<VideoSource> {
    const rows = await scope.run<VideoSourceRow>(
      `INSERT INTO "video_sources"
        ("id", "team_id", "season_id", "match_id", "provider", "external_ref",
         "title", "duration_seconds", "sync_offset_seconds",
         "processing_status", "access_policy", "registered_by", "created_at",
         "updated_at")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $13)
       RETURNING ${VIDEO_SOURCE_COLUMNS}`,
      [
        source.id,
        source.teamId,
        source.seasonId,
        source.matchId,
        source.provider,
        source.externalRef,
        source.title,
        source.durationSeconds,
        source.syncOffsetSeconds,
        source.processingStatus,
        source.accessPolicy,
        source.registeredBy,
        source.now.toISOString(),
      ],
    );
    return toVideoSource(this.requireRow(rows));
  }

  async findForWrite(
    scope: TransactionScope,
    teamId: string,
    sourceId: string,
  ): Promise<VideoSource | null> {
    const rows = await scope.run<VideoSourceRow>(
      `SELECT ${VIDEO_SOURCE_COLUMNS} FROM "video_sources"
        WHERE "id" = $1 AND "team_id" = $2`,
      [sourceId, teamId],
    );
    const row = rows[0];
    return row === undefined ? null : toVideoSource(row);
  }

  async listForScope(
    scope: TransactionScope,
    teamId: string,
    filter: VideoSourceListFilter,
    page: PageRequest,
  ): Promise<readonly VideoSource[]> {
    const rows = await scope.run<VideoSourceRow>(
      `SELECT ${VIDEO_SOURCE_COLUMNS} FROM "video_sources"
        WHERE "team_id" = $1
          AND ($2::uuid IS NULL OR "match_id" = $2)
          AND ($3::text IS NULL OR "provider" = $3)
        ORDER BY "created_at" DESC, "id" ASC
        LIMIT $4 OFFSET $5`,
      [
        teamId,
        filter.matchId,
        filter.provider,
        Math.min(page.limit, LIST_MAX_LIMIT),
        page.offset,
      ],
    );
    return rows.map(row => toVideoSource(row));
  }

  async countForScope(
    scope: TransactionScope,
    teamId: string,
    filter: VideoSourceListFilter,
  ): Promise<number> {
    const rows = await scope.run<AnalysisCountRow>(
      `SELECT COUNT(*)::int AS "count" FROM "video_sources"
        WHERE "team_id" = $1
          AND ($2::uuid IS NULL OR "match_id" = $2)
          AND ($3::text IS NULL OR "provider" = $3)`,
      [teamId, filter.matchId, filter.provider],
    );
    return Number(rows[0]?.count ?? 0);
  }

  private requireRow(rows: readonly VideoSourceRow[]): VideoSourceRow {
    const row = rows[0];
    if (row === undefined) {
      throw new Error('Expected a returned row from the video source write');
    }
    return row;
  }
}
