import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Injectable } from '@nestjs/common';

import { toMatchRevision } from '../lib/matches.mapper';
import {
  FIRST_SEQUENCE,
  LIST_MAX_LIMIT,
  MATCH_REVISION_COLUMNS,
} from '../model/matches.constants';
import type {
  CountRow,
  MatchRevisionRow,
  NumberRow,
} from '../model/matches.rows';
import type {
  MatchRevision,
  NewMatchRevision,
  PageRequest,
} from '../model/matches.types';

/**
 * Persistence for the immutable correction trail. Data access only:
 * parameterized SQL, static column lists, append-only writes (an ON UPDATE DO
 * INSTEAD NOTHING rule makes rewriting one a no-op at the database level), and
 * bounded, deterministically ordered reads.
 */
@Injectable()
export class MatchRevisionRepository {
  async append(
    scope: TransactionScope,
    revision: NewMatchRevision,
  ): Promise<MatchRevision> {
    const rows = await scope.run<MatchRevisionRow>(
      `INSERT INTO "match_revisions"
        ("id", "match_id", "team_id", "sequence", "revision", "action", "reason",
         "from_status", "to_status", "our_score_before",
         "opponent_score_before", "our_score_after", "opponent_score_after",
         "stream_version", "actor_user_id", "created_at")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
               $16)
       RETURNING ${MATCH_REVISION_COLUMNS}`,
      this.appendParameters(revision),
    );
    return toMatchRevision(this.requireRow(rows));
  }

  /**
   * The ordinal the next trail entry takes. The trail is strictly ordered even
   * when several entries share a match revision (a reopen and the correction
   * that follows it) or land on the same instant.
   */
  async nextSequence(
    scope: TransactionScope,
    matchId: string,
  ): Promise<number> {
    const rows = await scope.run<NumberRow>(
      `SELECT MAX("sequence") AS "value" FROM "match_revisions"
        WHERE "match_id" = $1`,
      [matchId],
    );
    const current = rows[0]?.value;
    return current === null || current === undefined
      ? FIRST_SEQUENCE
      : Number(current) + 1;
  }

  async listForMatch(
    scope: TransactionScope,
    matchId: string,
    page: PageRequest,
  ): Promise<readonly MatchRevision[]> {
    const rows = await scope.run<MatchRevisionRow>(
      `SELECT ${MATCH_REVISION_COLUMNS} FROM "match_revisions"
        WHERE "match_id" = $1
        ORDER BY "sequence" ASC
        LIMIT $2 OFFSET $3`,
      [matchId, Math.min(page.limit, LIST_MAX_LIMIT), page.offset],
    );
    return rows.map(row => toMatchRevision(row));
  }

  async countForMatch(
    scope: TransactionScope,
    matchId: string,
  ): Promise<number> {
    const rows = await scope.run<CountRow>(
      `SELECT COUNT(*)::int AS "count" FROM "match_revisions"
        WHERE "match_id" = $1`,
      [matchId],
    );
    return rows[0]?.count ?? 0;
  }

  private appendParameters(revision: NewMatchRevision): readonly unknown[] {
    return [
      revision.id,
      revision.matchId,
      revision.teamId,
      revision.sequence,
      revision.revision,
      revision.action,
      revision.reason,
      revision.fromStatus,
      revision.toStatus,
      revision.ourScoreBefore,
      revision.opponentScoreBefore,
      revision.ourScoreAfter,
      revision.opponentScoreAfter,
      revision.streamVersion,
      revision.actorUserId,
      revision.now.toISOString(),
    ];
  }

  private requireRow(rows: readonly MatchRevisionRow[]): MatchRevisionRow {
    const row = rows[0];
    if (row === undefined) {
      throw new Error('Expected a returned row from the match revision append');
    }
    return row;
  }
}
