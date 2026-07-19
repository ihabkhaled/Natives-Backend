import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Injectable } from '@nestjs/common';

import { toMeasurementProtocol } from '../lib/measurements.mapper';
import {
  LIST_MAX_LIMIT,
  MEASUREMENT_PROTOCOL_COLUMNS,
} from '../model/measurements.constants';
import { ProtocolStatus } from '../model/measurements.enums';
import type {
  CountRow,
  MeasurementProtocolRow,
} from '../model/measurements.rows';
import type {
  MeasurementProtocol,
  NewProtocol,
  PageRequest,
} from '../model/measurements.types';

/**
 * Persistence for the measurement-protocol catalog. Data access only:
 * parameterized SQL through the caller's transaction scope, static column lists,
 * and bounded/ordered reads. A team admin only ever writes team-owned protocols;
 * reads additionally surface the seeded global catalog (team_id IS NULL).
 */
@Injectable()
export class MeasurementProtocolRepository {
  async insert(
    scope: TransactionScope,
    protocol: NewProtocol,
  ): Promise<MeasurementProtocol> {
    const rows = await scope.run<MeasurementProtocolRow>(
      `INSERT INTO "measurement_protocols"
        ("id", "team_id", "season_id", "protocol_key", "name", "description",
         "discipline", "unit", "direction", "result_policy", "instructions",
         "safety_notes", "min_value", "max_value", "status", "created_by",
         "created_at", "updated_at")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
               'active', $15, $16, $16)
       RETURNING ${MEASUREMENT_PROTOCOL_COLUMNS}`,
      this.insertParameters(protocol),
    );
    return toMeasurementProtocol(this.requireRow(rows));
  }

  async activeKeyExists(
    scope: TransactionScope,
    teamId: string,
    protocolKey: string,
  ): Promise<boolean> {
    const rows = await scope.run<CountRow>(
      `SELECT COUNT(*)::int AS "count" FROM "measurement_protocols"
        WHERE "team_id" = $1 AND "protocol_key" = $2 AND "status" = $3`,
      [teamId, protocolKey, ProtocolStatus.Active],
    );
    return (rows[0]?.count ?? 0) > 0;
  }

  async findVisible(
    scope: TransactionScope,
    teamId: string,
    protocolId: string,
  ): Promise<MeasurementProtocol | null> {
    const rows = await scope.run<MeasurementProtocolRow>(
      `SELECT ${MEASUREMENT_PROTOCOL_COLUMNS} FROM "measurement_protocols"
        WHERE "id" = $1 AND ("team_id" = $2 OR "team_id" IS NULL)`,
      [protocolId, teamId],
    );
    const row = rows[0];
    return row === undefined ? null : toMeasurementProtocol(row);
  }

  async listForTeam(
    scope: TransactionScope,
    teamId: string,
    page: PageRequest,
  ): Promise<readonly MeasurementProtocol[]> {
    const rows = await scope.run<MeasurementProtocolRow>(
      `SELECT ${MEASUREMENT_PROTOCOL_COLUMNS} FROM "measurement_protocols"
        WHERE "team_id" = $1 OR "team_id" IS NULL
        ORDER BY "team_id" NULLS LAST, "protocol_key" ASC, "id" ASC
        LIMIT $2 OFFSET $3`,
      [teamId, Math.min(page.limit, LIST_MAX_LIMIT), page.offset],
    );
    return rows.map(row => toMeasurementProtocol(row));
  }

  async countForTeam(scope: TransactionScope, teamId: string): Promise<number> {
    const rows = await scope.run<CountRow>(
      `SELECT COUNT(*)::int AS "count" FROM "measurement_protocols"
        WHERE "team_id" = $1 OR "team_id" IS NULL`,
      [teamId],
    );
    return rows[0]?.count ?? 0;
  }

  async listByIds(
    scope: TransactionScope,
    teamId: string,
    protocolIds: readonly string[],
  ): Promise<readonly MeasurementProtocol[]> {
    if (protocolIds.length === 0) {
      return [];
    }
    const rows = await scope.run<MeasurementProtocolRow>(
      `SELECT ${MEASUREMENT_PROTOCOL_COLUMNS} FROM "measurement_protocols"
        WHERE ("team_id" = $1 OR "team_id" IS NULL) AND "id" = ANY($2::uuid[])
        ORDER BY "protocol_key" ASC, "id" ASC`,
      [teamId, protocolIds],
    );
    return rows.map(row => toMeasurementProtocol(row));
  }

  private insertParameters(protocol: NewProtocol): readonly unknown[] {
    return [
      protocol.id,
      protocol.teamId,
      protocol.content.seasonId,
      protocol.content.protocolKey,
      protocol.content.name,
      protocol.content.description,
      protocol.content.discipline,
      protocol.content.unit,
      protocol.content.direction,
      protocol.content.resultPolicy,
      protocol.content.instructions,
      protocol.content.safetyNotes,
      protocol.content.minValue,
      protocol.content.maxValue,
      protocol.createdBy,
      protocol.now.toISOString(),
    ];
  }

  private requireRow(
    rows: readonly MeasurementProtocolRow[],
  ): MeasurementProtocolRow {
    const row = rows[0];
    if (row === undefined) {
      throw new Error('Expected a returned row from the protocol write');
    }
    return row;
  }
}
