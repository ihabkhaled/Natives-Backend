import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Injectable } from '@nestjs/common';

import { toVideoClip } from '../lib/analysis.mapper';
import {
  LIST_MAX_LIMIT,
  VIDEO_CLIP_COLUMNS,
} from '../model/analysis.constants';
import type { AnalysisCountRow, VideoClipRow } from '../model/analysis.rows';
import type {
  ClipStatusChange,
  NewVideoClip,
  PageRequest,
  VideoClip,
  VideoClipListFilter,
} from '../model/analysis.types';

/**
 * Persistence for analysis clips. Data access only: parameterized SQL through
 * the caller's transaction scope, static column lists, optimistic-version
 * guarded status writes, and a bounded, deterministically ordered queue read
 * whose facets are all allow-listed.
 */
@Injectable()
export class VideoClipRepository {
  async insert(
    scope: TransactionScope,
    clip: NewVideoClip,
  ): Promise<VideoClip> {
    const rows = await scope.run<VideoClipRow>(
      `INSERT INTO "video_clips"
        ("id", "team_id", "season_id", "source_id", "match_id", "point_id",
         "event_id", "start_second", "end_second", "play_context", "clip_type",
         "title", "comment", "visibility", "status", "revision",
         "supersedes_clip_id", "import_reference", "author_user_id",
         "created_at", "updated_at")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
               'draft', $15, $16, $17, $18, $19, $19)
       RETURNING ${VIDEO_CLIP_COLUMNS}`,
      this.insertParameters(clip),
    );
    return toVideoClip(this.requireRow(rows));
  }

  async findForWrite(
    scope: TransactionScope,
    teamId: string,
    clipId: string,
  ): Promise<VideoClip | null> {
    const rows = await scope.run<VideoClipRow>(
      `SELECT ${VIDEO_CLIP_COLUMNS} FROM "video_clips"
        WHERE "id" = $1 AND "team_id" = $2`,
      [clipId, teamId],
    );
    const row = rows[0];
    return row === undefined ? null : toVideoClip(row);
  }

  async findByImportReference(
    scope: TransactionScope,
    teamId: string,
    reference: string,
  ): Promise<VideoClip | null> {
    const rows = await scope.run<VideoClipRow>(
      `SELECT ${VIDEO_CLIP_COLUMNS} FROM "video_clips"
        WHERE "team_id" = $1 AND "import_reference" = $2`,
      [teamId, reference],
    );
    const row = rows[0];
    return row === undefined ? null : toVideoClip(row);
  }

  async applyStatusChange(
    scope: TransactionScope,
    change: ClipStatusChange,
  ): Promise<VideoClip | null> {
    const rows = await scope.run<VideoClipRow>(
      `UPDATE "video_clips"
          SET "status" = $4, "reviewed_by" = $5, "reviewed_at" = $6,
              "published_by" = $7, "published_at" = $8, "archived_at" = $9,
              "updated_at" = $10, "record_version" = "record_version" + 1
        WHERE "id" = $1 AND "team_id" = $2 AND "record_version" = $3
       RETURNING ${VIDEO_CLIP_COLUMNS}`,
      this.statusParameters(change),
    );
    const row = rows[0];
    return row === undefined ? null : toVideoClip(row);
  }

  async listForScope(
    scope: TransactionScope,
    teamId: string,
    filter: VideoClipListFilter,
    page: PageRequest,
  ): Promise<readonly VideoClip[]> {
    const rows = await scope.run<VideoClipRow>(
      `SELECT ${VIDEO_CLIP_COLUMNS} FROM "video_clips" c
        WHERE ${this.filterPredicate()}
        ORDER BY "created_at" DESC, "id" ASC
        LIMIT $8 OFFSET $9`,
      [
        ...this.filterParameters(teamId, filter),
        Math.min(page.limit, LIST_MAX_LIMIT),
        page.offset,
      ],
    );
    return rows.map(row => toVideoClip(row));
  }

  async countForScope(
    scope: TransactionScope,
    teamId: string,
    filter: VideoClipListFilter,
  ): Promise<number> {
    const rows = await scope.run<AnalysisCountRow>(
      `SELECT COUNT(*)::int AS "count" FROM "video_clips" c
        WHERE ${this.filterPredicate()}`,
      this.filterParameters(teamId, filter),
    );
    return Number(rows[0]?.count ?? 0);
  }

  private filterPredicate(): string {
    return `c."team_id" = $1
          AND ($2::uuid IS NULL OR c."source_id" = $2)
          AND ($3::uuid IS NULL OR c."match_id" = $3)
          AND ($4::text IS NULL OR c."clip_type" = $4)
          AND ($5::text IS NULL OR c."status" = $5)
          AND ($6::uuid IS NULL OR EXISTS (
                SELECT 1 FROM "video_clip_players" p
                 WHERE p."clip_id" = c."id" AND p."membership_id" = $6))
          AND ($7::text IS NULL OR EXISTS (
                SELECT 1 FROM "video_clip_tags" t
                 WHERE t."clip_id" = c."id" AND t."tag" = $7))`;
  }

  private filterParameters(
    teamId: string,
    filter: VideoClipListFilter,
  ): readonly unknown[] {
    return [
      teamId,
      filter.sourceId,
      filter.matchId,
      filter.clipType,
      filter.status,
      filter.membershipId,
      filter.tag,
    ];
  }

  private insertParameters(clip: NewVideoClip): readonly unknown[] {
    return [
      clip.id,
      clip.teamId,
      clip.seasonId,
      clip.sourceId,
      clip.matchId,
      clip.pointId,
      clip.eventId,
      clip.startSecond,
      clip.endSecond,
      clip.playContext,
      clip.clipType,
      clip.title,
      clip.comment,
      clip.visibility,
      clip.revision,
      clip.supersedesClipId,
      clip.importReference,
      clip.authorUserId,
      clip.now.toISOString(),
    ];
  }

  private statusParameters(change: ClipStatusChange): readonly unknown[] {
    return [
      change.id,
      change.teamId,
      change.expectedRecordVersion,
      change.toStatus,
      change.reviewedBy,
      this.instant(change.reviewedAt),
      change.publishedBy,
      this.instant(change.publishedAt),
      this.instant(change.archivedAt),
      change.now.toISOString(),
    ];
  }

  private instant(value: Date | null): string | null {
    return value === null ? null : value.toISOString();
  }

  private requireRow(rows: readonly VideoClipRow[]): VideoClipRow {
    const row = rows[0];
    if (row === undefined) {
      throw new Error('Expected a returned row from the video clip write');
    }
    return row;
  }
}
