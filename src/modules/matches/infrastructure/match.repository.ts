import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Injectable } from '@nestjs/common';

import { toInstant } from '../lib/matches.helpers';
import { toMatch } from '../lib/matches.mapper';
import { LIST_MAX_LIMIT, MATCH_COLUMNS } from '../model/matches.constants';
import type { CountRow, MatchRow } from '../model/matches.rows';
import type {
  Match,
  MatchFinalization,
  MatchListFilter,
  MatchReopening,
  MatchScoreUpdate,
  MatchStatusChange,
  NewMatch,
  PageRequest,
} from '../model/matches.types';

/**
 * Persistence for the match aggregate. Data access only: parameterized SQL
 * through the caller's transaction scope, static column lists,
 * optimistic-version-guarded writes, and bounded, deterministically ordered reads
 * with allow-listed filters.
 *
 * Every write is guarded on `record_version`, and the database additionally
 * rejects any update to a finalized row that does not bump `revision` — so the
 * only path from a published result to a different one is the audited reopen.
 */
@Injectable()
export class MatchRepository {
  async insert(scope: TransactionScope, match: NewMatch): Promise<Match> {
    const rows = await scope.run<MatchRow>(
      `INSERT INTO "matches"
        ("id", "team_id", "season_id", "competition_id", "fixture_id",
         "roster_id", "ruleset_id", "status", "home_away", "engine_version",
         "revision", "supersedes_match_id", "notes", "created_by", "created_at",
         "updated_at")
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'scheduled', $8, $9, $10, $11, $12,
               $13, $14, $14)
       RETURNING ${MATCH_COLUMNS}`,
      this.insertParameters(match),
    );
    return toMatch(this.requireRow(rows));
  }

  async findForWrite(
    scope: TransactionScope,
    teamId: string,
    matchId: string,
  ): Promise<Match | null> {
    const rows = await scope.run<MatchRow>(
      `SELECT ${MATCH_COLUMNS} FROM "matches"
        WHERE "id" = $1 AND "team_id" = $2`,
      [matchId, teamId],
    );
    const row = rows[0];
    return row === undefined ? null : toMatch(row);
  }

  async applyStatusChange(
    scope: TransactionScope,
    change: MatchStatusChange,
  ): Promise<Match | null> {
    const rows = await scope.run<MatchRow>(
      `UPDATE "matches"
          SET "status" = $4, "period" = $5, "result" = $6, "started_at" = $7,
              "paused_at" = $8, "resumed_at" = $9, "halftime_at" = $10,
              "completed_at" = $11, "abandoned_at" = $12,
              "abandon_reason" = $13, "updated_at" = $14,
              "record_version" = "record_version" + 1
        WHERE "id" = $1 AND "team_id" = $2 AND "record_version" = $3
       RETURNING ${MATCH_COLUMNS}`,
      this.statusParameters(change),
    );
    const row = rows[0];
    return row === undefined ? null : toMatch(row);
  }

  /**
   * Publish the authoritative result. The status moves to `finalized`, after
   * which the database trigger rejects every further in-place update.
   */
  async applyFinalization(
    scope: TransactionScope,
    finalization: MatchFinalization,
  ): Promise<Match | null> {
    const rows = await scope.run<MatchRow>(
      `UPDATE "matches"
          SET "status" = 'finalized', "result" = $4, "finalized_by" = $5,
              "finalized_at" = $6, "updated_at" = $6,
              "record_version" = "record_version" + 1
        WHERE "id" = $1 AND "team_id" = $2 AND "record_version" = $3
       RETURNING ${MATCH_COLUMNS}`,
      [
        finalization.id,
        finalization.teamId,
        finalization.expectedRecordVersion,
        finalization.result,
        finalization.finalizedBy,
        finalization.now.toISOString(),
      ],
    );
    const row = rows[0];
    return row === undefined ? null : toMatch(row);
  }

  /**
   * Reopen a finalized match for correction. Bumping `revision` is precisely
   * what the immutability trigger accepts as a lawful correction; the previous
   * result stays recorded in the append-only revision trail.
   */
  async applyReopening(
    scope: TransactionScope,
    reopening: MatchReopening,
  ): Promise<Match | null> {
    const rows = await scope.run<MatchRow>(
      `UPDATE "matches"
          SET "status" = 'live', "revision" = $4, "reopen_reason" = $5,
              "reopened_by" = $6, "reopened_at" = $7, "result" = 'undecided',
              "finalized_by" = NULL, "finalized_at" = NULL, "updated_at" = $7,
              "record_version" = "record_version" + 1
        WHERE "id" = $1 AND "team_id" = $2 AND "record_version" = $3
       RETURNING ${MATCH_COLUMNS}`,
      [
        reopening.id,
        reopening.teamId,
        reopening.expectedRecordVersion,
        reopening.revision,
        reopening.reason,
        reopening.reopenedBy,
        reopening.now.toISOString(),
      ],
    );
    const row = rows[0];
    return row === undefined ? null : toMatch(row);
  }

  /**
   * Move the score projection forward with the stream. Guarded on the previous
   * `stream_version`, so two devices appending concurrently cannot both win.
   */
  async applyScoreUpdate(
    scope: TransactionScope,
    update: MatchScoreUpdate,
  ): Promise<Match | null> {
    const rows = await scope.run<MatchRow>(
      `UPDATE "matches"
          SET "our_score" = $3, "opponent_score" = $4, "stream_version" = $5,
              "cap_applied" = $6, "updated_at" = $7,
              "record_version" = "record_version" + 1
        WHERE "id" = $1 AND "team_id" = $2 AND "stream_version" = $5 - 1
       RETURNING ${MATCH_COLUMNS}`,
      [
        update.id,
        update.teamId,
        update.ourScore,
        update.opponentScore,
        update.streamVersion,
        update.capApplied,
        update.now.toISOString(),
      ],
    );
    const row = rows[0];
    return row === undefined ? null : toMatch(row);
  }

  async listForScope(
    scope: TransactionScope,
    teamId: string,
    filter: MatchListFilter,
    page: PageRequest,
  ): Promise<readonly Match[]> {
    const rows = await scope.run<MatchRow>(
      `SELECT ${MATCH_COLUMNS} FROM "matches"
        WHERE "team_id" = $1
          AND ($2::uuid IS NULL OR "competition_id" = $2)
          AND ($3::uuid IS NULL OR "fixture_id" = $3)
          AND ($4::text IS NULL OR "status" = $4)
        ORDER BY "created_at" DESC, "id" ASC
        LIMIT $5 OFFSET $6`,
      [
        teamId,
        filter.competitionId,
        filter.fixtureId,
        filter.status,
        Math.min(page.limit, LIST_MAX_LIMIT),
        page.offset,
      ],
    );
    return rows.map(row => toMatch(row));
  }

  async countForScope(
    scope: TransactionScope,
    teamId: string,
    filter: MatchListFilter,
  ): Promise<number> {
    const rows = await scope.run<CountRow>(
      `SELECT COUNT(*)::int AS "count" FROM "matches"
        WHERE "team_id" = $1
          AND ($2::uuid IS NULL OR "competition_id" = $2)
          AND ($3::uuid IS NULL OR "fixture_id" = $3)
          AND ($4::text IS NULL OR "status" = $4)`,
      [teamId, filter.competitionId, filter.fixtureId, filter.status],
    );
    return rows[0]?.count ?? 0;
  }

  private insertParameters(match: NewMatch): readonly unknown[] {
    return [
      match.id,
      match.teamId,
      match.seasonId,
      match.competitionId,
      match.fixtureId,
      match.rosterId,
      match.rulesetId,
      match.homeAway,
      match.engineVersion,
      match.revision,
      match.supersedesMatchId,
      match.notes,
      match.createdBy,
      match.now.toISOString(),
    ];
  }

  private statusParameters(change: MatchStatusChange): readonly unknown[] {
    return [
      change.id,
      change.teamId,
      change.expectedRecordVersion,
      change.toStatus,
      change.period,
      change.result,
      toInstant(change.startedAt),
      toInstant(change.pausedAt),
      toInstant(change.resumedAt),
      toInstant(change.halftimeAt),
      toInstant(change.completedAt),
      toInstant(change.abandonedAt),
      change.abandonReason,
      change.now.toISOString(),
    ];
  }

  private requireRow(rows: readonly MatchRow[]): MatchRow {
    const row = rows[0];
    if (row === undefined) {
      throw new Error('Expected a returned row from the match write');
    }
    return row;
  }
}
