import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Injectable } from '@nestjs/common';

import { toTotal } from '../lib/points.helpers';
import { toActivityTypePoints, toLedgerEntry } from '../lib/points.mapper';
import {
  LEDGER_ENTRY_COLUMNS,
  LEDGER_HISTORY_LIMIT,
} from '../model/points.constants';
import { LedgerEntryType } from '../model/points.enums';
import type {
  ActivityTypePointsRow,
  AwardFactsRow,
  LedgerEntryRow,
  TotalRow,
} from '../model/points.rows';
import type {
  ActivityTypePoints,
  AwardFacts,
  LedgerEntry,
  NewLedgerEntry,
} from '../model/points.types';

/**
 * Append-only persistence for the points ledger. Inserts are idempotent by the
 * unique `idempotency_key` (ON CONFLICT DO NOTHING); the database additionally
 * refuses any UPDATE or DELETE via a trigger, so an amount is never edited.
 * Totals are always computed here as SUM over entries — never a stored counter.
 * All reads are parameterized, bounded, and deterministically ordered.
 */
@Injectable()
export class PointsLedgerRepository {
  async insert(
    scope: TransactionScope,
    entry: NewLedgerEntry,
  ): Promise<LedgerEntry | null> {
    const rows = await scope.run<LedgerEntryRow>(
      `INSERT INTO "points_ledger"
        ("id", "team_id", "season_id", "membership_id", "entry_type", "amount",
         "source_type", "source_id", "rule_id", "rule_version",
         "activity_category", "reason", "reason_key", "reverses_entry_id",
         "idempotency_key", "effective_on", "actor_user_id", "created_at")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
               $16, $17, $18)
       ON CONFLICT ("idempotency_key") DO NOTHING
       RETURNING ${LEDGER_ENTRY_COLUMNS}`,
      this.insertParameters(entry),
    );
    const row = rows[0];
    return row === undefined ? null : toLedgerEntry(row);
  }

  async awardFacts(
    scope: TransactionScope,
    membershipId: string,
    category: string,
    performedOn: string,
  ): Promise<AwardFacts> {
    const rows = await scope.run<AwardFactsRow>(
      `SELECT
         COUNT(*) FILTER (WHERE "effective_on" = $3)::int AS "same_day_count",
         MAX("effective_on") AS "last_award_on"
       FROM "points_ledger"
       WHERE "membership_id" = $1 AND "activity_category" = $2
         AND "entry_type" = $4`,
      [membershipId, category, performedOn, LedgerEntryType.Award],
    );
    const row = rows[0];
    return {
      sameDayCount: Number(row?.same_day_count ?? 0),
      lastAwardOn: row?.last_award_on ?? null,
    };
  }

  async awardsForSubmission(
    scope: TransactionScope,
    submissionId: string,
  ): Promise<readonly LedgerEntry[]> {
    const rows = await scope.run<LedgerEntryRow>(
      `SELECT ${LEDGER_ENTRY_COLUMNS} FROM "points_ledger"
        WHERE "source_id" = $1 AND "entry_type" = $2
        ORDER BY "created_at" ASC, "id" ASC`,
      [submissionId, LedgerEntryType.Award],
    );
    return rows.map(row => toLedgerEntry(row));
  }

  async totalFor(
    scope: TransactionScope,
    membershipId: string,
  ): Promise<number> {
    const rows = await scope.run<TotalRow>(
      `SELECT SUM("amount") AS "total" FROM "points_ledger"
        WHERE "membership_id" = $1`,
      [membershipId],
    );
    return toTotal(rows[0]?.total ?? null);
  }

  async listForMembership(
    scope: TransactionScope,
    teamId: string,
    membershipId: string,
  ): Promise<readonly LedgerEntry[]> {
    const rows = await scope.run<LedgerEntryRow>(
      `SELECT ${LEDGER_ENTRY_COLUMNS} FROM "points_ledger"
        WHERE "team_id" = $1 AND "membership_id" = $2
        ORDER BY "created_at" DESC, "id" DESC
        LIMIT ${LEDGER_HISTORY_LIMIT}`,
      [teamId, membershipId],
    );
    return rows.map(row => toLedgerEntry(row));
  }

  async findActivityTypePoints(
    scope: TransactionScope,
    activityTypeId: string,
  ): Promise<ActivityTypePoints | null> {
    const rows = await scope.run<ActivityTypePointsRow>(
      `SELECT "id", "category", "points_approval" FROM "activity_types"
        WHERE "id" = $1`,
      [activityTypeId],
    );
    const row = rows[0];
    return row === undefined ? null : toActivityTypePoints(row);
  }

  private insertParameters(entry: NewLedgerEntry): readonly unknown[] {
    return [
      entry.id,
      entry.teamId,
      entry.seasonId,
      entry.membershipId,
      entry.entryType,
      entry.amount,
      entry.sourceType,
      entry.sourceId,
      entry.ruleId,
      entry.ruleVersion,
      entry.activityCategory,
      entry.reason,
      entry.reasonKey,
      entry.reversesEntryId,
      entry.idempotencyKey,
      entry.effectiveOn,
      entry.actorUserId,
      entry.now.toISOString(),
    ];
  }
}
