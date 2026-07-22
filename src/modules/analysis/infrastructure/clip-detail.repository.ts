import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Injectable } from '@nestjs/common';

import { CLIP_PLAYER_COLUMNS } from '../model/analysis.constants';
import type { ClipPlayerRow, ClipTagRow } from '../model/analysis.rows';

/**
 * Persistence for the two satellite tables of a clip: the memberships it is
 * about and its configurable tags. Data access only — parameterized SQL, static
 * column lists, and bounded array reads keyed by clip id.
 */
@Injectable()
export class ClipDetailRepository {
  async replacePlayers(
    scope: TransactionScope,
    clipId: string,
    membershipIds: readonly string[],
    now: Date,
  ): Promise<void> {
    await scope.run(`DELETE FROM "video_clip_players" WHERE "clip_id" = $1`, [
      clipId,
    ]);
    if (membershipIds.length === 0) {
      return;
    }
    await scope.run(
      `INSERT INTO "video_clip_players" ("clip_id", "membership_id",
         "created_at")
       SELECT $1, "membership_id", $3
         FROM UNNEST($2::uuid[]) AS "membership_id"`,
      [clipId, [...membershipIds], now.toISOString()],
    );
  }

  async replaceTags(
    scope: TransactionScope,
    clipId: string,
    tags: readonly string[],
    now: Date,
  ): Promise<void> {
    await scope.run(`DELETE FROM "video_clip_tags" WHERE "clip_id" = $1`, [
      clipId,
    ]);
    if (tags.length === 0) {
      return;
    }
    await scope.run(
      `INSERT INTO "video_clip_tags" ("clip_id", "tag", "created_at")
       SELECT $1, "tag", $3 FROM UNNEST($2::text[]) AS "tag"`,
      [clipId, [...tags], now.toISOString()],
    );
  }

  async listPlayers(
    scope: TransactionScope,
    clipIds: readonly string[],
  ): Promise<readonly ClipPlayerRow[]> {
    if (clipIds.length === 0) {
      return [];
    }
    return scope.run<ClipPlayerRow>(
      `SELECT ${CLIP_PLAYER_COLUMNS} FROM "video_clip_players"
        WHERE "clip_id" = ANY($1::uuid[])
        ORDER BY "clip_id" ASC, "membership_id" ASC`,
      [[...clipIds]],
    );
  }

  async listTags(
    scope: TransactionScope,
    clipIds: readonly string[],
  ): Promise<readonly ClipTagRow[]> {
    if (clipIds.length === 0) {
      return [];
    }
    return scope.run<ClipTagRow>(
      `SELECT "clip_id", "tag" FROM "video_clip_tags"
        WHERE "clip_id" = ANY($1::uuid[])
        ORDER BY "clip_id" ASC, "tag" ASC`,
      [[...clipIds]],
    );
  }

  /**
   * Stamp one member's acknowledgement. Only an unacknowledged row is written,
   * so a second acknowledgement never rewrites the first instant — the record of
   * WHEN a player saw the analysis is append-once.
   */
  async acknowledge(
    scope: TransactionScope,
    clipId: string,
    membershipId: string,
    now: Date,
  ): Promise<boolean> {
    const rows = await scope.run<ClipPlayerRow>(
      `UPDATE "video_clip_players"
          SET "acknowledged_at" = $3
        WHERE "clip_id" = $1 AND "membership_id" = $2
          AND "acknowledged_at" IS NULL
       RETURNING ${CLIP_PLAYER_COLUMNS}`,
      [clipId, membershipId, now.toISOString()],
    );
    return rows.length > 0;
  }
}
