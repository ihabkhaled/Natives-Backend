import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Injectable } from '@nestjs/common';

import { toFixture } from '../lib/competitions.mapper';
import {
  FIXTURE_COLUMNS,
  LIST_MAX_LIMIT,
} from '../model/competitions.constants';
import type { CountRow, FixtureRow } from '../model/competitions.rows';
import type {
  Fixture,
  FixtureReschedule,
  FixtureStatusChange,
  NewFixture,
  PageRequest,
} from '../model/competitions.types';

/**
 * Persistence for the fixture aggregate. Data access only: parameterized SQL,
 * static column lists, optimistic-version-guarded writes, and bounded/ordered
 * reads. A cancelled fixture is kept for history — writes never delete a row.
 */
@Injectable()
export class FixtureRepository {
  async insert(scope: TransactionScope, fixture: NewFixture): Promise<Fixture> {
    const rows = await scope.run<FixtureRow>(
      `INSERT INTO "fixtures"
        ("id", "competition_id", "team_id", "season_id", "stage_id", "round_id",
         "opponent_id", "venue_id", "home_away", "scheduled_at", "status",
         "created_by", "created_at", "updated_at")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'scheduled', $11, $12,
               $12)
       RETURNING ${FIXTURE_COLUMNS}`,
      this.insertParameters(fixture),
    );
    return toFixture(this.requireRow(rows));
  }

  async findForWrite(
    scope: TransactionScope,
    teamId: string,
    competitionId: string,
    fixtureId: string,
  ): Promise<Fixture | null> {
    const rows = await scope.run<FixtureRow>(
      `SELECT ${FIXTURE_COLUMNS} FROM "fixtures"
        WHERE "id" = $1 AND "team_id" = $2 AND "competition_id" = $3
          AND "deleted_at" IS NULL`,
      [fixtureId, teamId, competitionId],
    );
    const row = rows[0];
    return row === undefined ? null : toFixture(row);
  }

  async applyReschedule(
    scope: TransactionScope,
    reschedule: FixtureReschedule,
  ): Promise<Fixture | null> {
    const rows = await scope.run<FixtureRow>(
      `UPDATE "fixtures"
          SET "scheduled_at" = $4, "previous_scheduled_at" = $5,
              "venue_id" = $6, "reschedule_reason" = $7, "status" = 'rescheduled',
              "reschedule_count" = "reschedule_count" + 1, "rescheduled_at" = $8,
              "updated_at" = $8, "record_version" = "record_version" + 1
        WHERE "id" = $1 AND "team_id" = $2 AND "record_version" = $3
          AND "deleted_at" IS NULL
       RETURNING ${FIXTURE_COLUMNS}`,
      this.rescheduleParameters(reschedule),
    );
    const row = rows[0];
    return row === undefined ? null : toFixture(row);
  }

  async applyStatusChange(
    scope: TransactionScope,
    change: FixtureStatusChange,
  ): Promise<Fixture | null> {
    const rows = await scope.run<FixtureRow>(
      `UPDATE "fixtures"
          SET "status" = $4, "finalized_at" = $5, "cancelled_at" = $6,
              "cancellation_reason" = $7, "updated_at" = $8,
              "record_version" = "record_version" + 1
        WHERE "id" = $1 AND "team_id" = $2 AND "record_version" = $3
          AND "deleted_at" IS NULL
       RETURNING ${FIXTURE_COLUMNS}`,
      this.statusParameters(change),
    );
    const row = rows[0];
    return row === undefined ? null : toFixture(row);
  }

  async listForCompetition(
    scope: TransactionScope,
    teamId: string,
    competitionId: string,
    page: PageRequest,
  ): Promise<readonly Fixture[]> {
    const rows = await scope.run<FixtureRow>(
      `SELECT ${FIXTURE_COLUMNS} FROM "fixtures"
        WHERE "team_id" = $1 AND "competition_id" = $2 AND "deleted_at" IS NULL
        ORDER BY "scheduled_at" ASC, "id" ASC
        LIMIT $3 OFFSET $4`,
      [
        teamId,
        competitionId,
        Math.min(page.limit, LIST_MAX_LIMIT),
        page.offset,
      ],
    );
    return rows.map(row => toFixture(row));
  }

  async countForCompetition(
    scope: TransactionScope,
    teamId: string,
    competitionId: string,
  ): Promise<number> {
    const rows = await scope.run<CountRow>(
      `SELECT COUNT(*)::int AS "count" FROM "fixtures"
        WHERE "team_id" = $1 AND "competition_id" = $2 AND "deleted_at" IS NULL`,
      [teamId, competitionId],
    );
    return rows[0]?.count ?? 0;
  }

  private insertParameters(fixture: NewFixture): readonly unknown[] {
    const { content } = fixture;
    return [
      fixture.id,
      fixture.competitionId,
      fixture.teamId,
      fixture.seasonId,
      content.stageId,
      content.roundId,
      content.opponentId,
      content.venueId,
      content.homeAway,
      fixture.scheduledAt.toISOString(),
      fixture.createdBy,
      fixture.now.toISOString(),
    ];
  }

  private rescheduleParameters(
    reschedule: FixtureReschedule,
  ): readonly unknown[] {
    return [
      reschedule.id,
      reschedule.teamId,
      reschedule.expectedRecordVersion,
      reschedule.newScheduledAt.toISOString(),
      reschedule.previousScheduledAt.toISOString(),
      reschedule.venueId,
      reschedule.reason,
      reschedule.now.toISOString(),
    ];
  }

  private statusParameters(change: FixtureStatusChange): readonly unknown[] {
    return [
      change.id,
      change.teamId,
      change.expectedRecordVersion,
      change.toStatus,
      change.finalizedAt === null ? null : change.finalizedAt.toISOString(),
      change.cancelledAt === null ? null : change.cancelledAt.toISOString(),
      change.cancellationReason,
      change.now.toISOString(),
    ];
  }

  private requireRow(rows: readonly FixtureRow[]): FixtureRow {
    const row = rows[0];
    if (row === undefined) {
      throw new Error('Expected a returned row from the fixture write');
    }
    return row;
  }
}
