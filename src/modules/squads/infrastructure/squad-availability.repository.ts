import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Injectable } from '@nestjs/common';

import { toAvailability } from '../lib/squads.mapper';
import {
  AVAILABILITY_COLUMNS,
  LIST_MAX_LIMIT,
} from '../model/squads.constants';
import type { AvailabilityRow, CountRow } from '../model/squads.rows';
import type {
  Availability,
  AvailabilityUpsert,
  PageRequest,
} from '../model/squads.types';

/**
 * Persistence for squad availability declarations. Data access only:
 * parameterized SQL, static columns, one declaration per member per squad
 * (upsert), and a bounded, deterministically ordered read.
 */
@Injectable()
export class SquadAvailabilityRepository {
  async upsert(
    scope: TransactionScope,
    upsert: AvailabilityUpsert,
  ): Promise<Availability> {
    const rows = await scope.run<AvailabilityRow>(
      `INSERT INTO "squad_availability"
        ("id", "squad_id", "team_id", "membership_id", "availability", "reason",
         "source", "declared_by", "created_at", "updated_at")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)
       ON CONFLICT ("squad_id", "membership_id") DO UPDATE
          SET "availability" = EXCLUDED."availability",
              "reason" = EXCLUDED."reason",
              "source" = EXCLUDED."source",
              "declared_by" = EXCLUDED."declared_by",
              "updated_at" = EXCLUDED."updated_at",
              "record_version" = "squad_availability"."record_version" + 1
       RETURNING ${AVAILABILITY_COLUMNS}`,
      [
        upsert.id,
        upsert.squadId,
        upsert.teamId,
        upsert.membershipId,
        upsert.availability,
        upsert.reason,
        upsert.source,
        upsert.declaredBy,
        upsert.now.toISOString(),
      ],
    );
    return toAvailability(this.requireRow(rows));
  }

  async listForSquad(
    scope: TransactionScope,
    squadId: string,
    page: PageRequest,
  ): Promise<readonly Availability[]> {
    const rows = await scope.run<AvailabilityRow>(
      `SELECT ${AVAILABILITY_COLUMNS} FROM "squad_availability"
        WHERE "squad_id" = $1
        ORDER BY "updated_at" DESC, "id" ASC
        LIMIT $2 OFFSET $3`,
      [squadId, Math.min(page.limit, LIST_MAX_LIMIT), page.offset],
    );
    return rows.map(row => toAvailability(row));
  }

  async countForSquad(
    scope: TransactionScope,
    squadId: string,
  ): Promise<number> {
    const rows = await scope.run<CountRow>(
      `SELECT COUNT(*)::int AS "count" FROM "squad_availability"
        WHERE "squad_id" = $1`,
      [squadId],
    );
    return rows[0]?.count ?? 0;
  }

  private requireRow(rows: readonly AvailabilityRow[]): AvailabilityRow {
    const row = rows[0];
    if (row === undefined) {
      throw new Error('Expected a returned row from the availability write');
    }
    return row;
  }
}
