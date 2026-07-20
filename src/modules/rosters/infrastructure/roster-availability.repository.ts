import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Injectable } from '@nestjs/common';

import { toRosterAvailability } from '../lib/rosters.mapper';
import {
  AVAILABILITY_COLUMNS,
  ENTRY_MAX_LIMIT,
} from '../model/rosters.constants';
import type { CountRow, RosterAvailabilityRow } from '../model/rosters.rows';
import type {
  PageRequest,
  RosterAvailabilityRecord,
  RosterAvailabilityUpsert,
} from '../model/rosters.types';

/**
 * Persistence for roster availability declarations. Data access only:
 * parameterized SQL, static columns, one declaration per member per roster
 * (upsert), and bounded, deterministically ordered reads.
 */
@Injectable()
export class RosterAvailabilityRepository {
  async upsert(
    scope: TransactionScope,
    upsert: RosterAvailabilityUpsert,
  ): Promise<RosterAvailabilityRecord> {
    const rows = await scope.run<RosterAvailabilityRow>(
      `INSERT INTO "roster_availability"
        ("id", "roster_id", "team_id", "membership_id", "availability",
         "reason", "source", "declared_by", "created_at", "updated_at")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)
       ON CONFLICT ("roster_id", "membership_id") DO UPDATE
          SET "availability" = EXCLUDED."availability",
              "reason" = EXCLUDED."reason",
              "source" = EXCLUDED."source",
              "declared_by" = EXCLUDED."declared_by",
              "updated_at" = EXCLUDED."updated_at",
              "record_version" = "roster_availability"."record_version" + 1
       RETURNING ${AVAILABILITY_COLUMNS}`,
      [
        upsert.id,
        upsert.rosterId,
        upsert.teamId,
        upsert.membershipId,
        upsert.availability,
        upsert.reason,
        upsert.source,
        upsert.declaredBy,
        upsert.now.toISOString(),
      ],
    );
    return toRosterAvailability(this.requireRow(rows));
  }

  async listForRoster(
    scope: TransactionScope,
    rosterId: string,
    page: PageRequest,
  ): Promise<readonly RosterAvailabilityRecord[]> {
    const rows = await scope.run<RosterAvailabilityRow>(
      `SELECT ${AVAILABILITY_COLUMNS} FROM "roster_availability"
        WHERE "roster_id" = $1
        ORDER BY "updated_at" DESC, "id" ASC
        LIMIT $2 OFFSET $3`,
      [rosterId, Math.min(page.limit, ENTRY_MAX_LIMIT), page.offset],
    );
    return rows.map(row => toRosterAvailability(row));
  }

  async countForRoster(
    scope: TransactionScope,
    rosterId: string,
  ): Promise<number> {
    const rows = await scope.run<CountRow>(
      `SELECT COUNT(*)::int AS "count" FROM "roster_availability"
        WHERE "roster_id" = $1`,
      [rosterId],
    );
    return rows[0]?.count ?? 0;
  }

  private requireRow(
    rows: readonly RosterAvailabilityRow[],
  ): RosterAvailabilityRow {
    const row = rows[0];
    if (row === undefined) {
      throw new Error('Expected a returned row from the availability write');
    }
    return row;
  }
}
