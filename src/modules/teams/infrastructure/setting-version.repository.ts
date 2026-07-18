import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Injectable } from '@nestjs/common';

import { parseSettingKey, toDate } from '../lib/teams.helpers';
import type { CountRow, IdRow, SettingVersionRow } from '../model/teams.rows';
import type {
  ListSettingVersionsResult,
  NewSettingVersion,
  PageRequest,
  SettingVersion,
} from '../model/teams.types';

/**
 * Persistence for effective-dated team setting versions. Append-only and
 * effective-unique per (team, key). The effective snapshot is read with a single
 * bounded `DISTINCT ON` query returning at most one in-effect row per setting key.
 */
@Injectable()
export class SettingVersionRepository {
  async existsAtInstant(
    scope: TransactionScope,
    teamId: string,
    settingKey: string,
    effectiveFrom: Date,
  ): Promise<boolean> {
    const rows = await scope.run<IdRow>(
      `SELECT "id" FROM "team_setting_versions"
        WHERE "team_id" = $1 AND "setting_key" = $2 AND "effective_from" = $3`,
      [teamId, settingKey, effectiveFrom.toISOString()],
    );
    return rows.length > 0;
  }

  async insert(
    scope: TransactionScope,
    version: NewSettingVersion,
  ): Promise<SettingVersion> {
    const rows = await scope.run<SettingVersionRow>(
      `INSERT INTO "team_setting_versions" ("id", "team_id", "setting_key",
              "effective_from", "value", "note", "created_by", "created_at")
       VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8)
       RETURNING "id", "team_id", "setting_key", "effective_from", "value",
              "note", "created_by", "created_at"`,
      [
        version.id,
        version.teamId,
        version.settingKey,
        version.effectiveFrom.toISOString(),
        JSON.stringify(version.value),
        version.note,
        version.createdBy,
        version.now.toISOString(),
      ],
    );
    return this.toVersion(this.requireRow(rows));
  }

  async loadEffective(
    scope: TransactionScope,
    teamId: string,
    asOf: Date,
  ): Promise<readonly SettingVersion[]> {
    const rows = await scope.run<SettingVersionRow>(
      `SELECT DISTINCT ON ("setting_key")
              "id", "team_id", "setting_key", "effective_from", "value",
              "note", "created_by", "created_at"
         FROM "team_setting_versions"
        WHERE "team_id" = $1 AND "effective_from" <= $2
        ORDER BY "setting_key" ASC, "effective_from" DESC`,
      [teamId, asOf.toISOString()],
    );
    return rows.map(row => this.toVersion(row));
  }

  async listForKey(
    scope: TransactionScope,
    teamId: string,
    settingKey: string,
    page: PageRequest,
  ): Promise<ListSettingVersionsResult> {
    const rows = await scope.run<SettingVersionRow>(
      `SELECT "id", "team_id", "setting_key", "effective_from", "value",
              "note", "created_by", "created_at"
         FROM "team_setting_versions"
        WHERE "team_id" = $1 AND "setting_key" = $2
        ORDER BY "effective_from" DESC, "id" DESC
        LIMIT $3 OFFSET $4`,
      [teamId, settingKey, page.limit, page.offset],
    );
    const counts = await scope.run<CountRow>(
      `SELECT COUNT(*)::int AS "count" FROM "team_setting_versions"
        WHERE "team_id" = $1 AND "setting_key" = $2`,
      [teamId, settingKey],
    );
    return {
      items: rows.map(row => this.toVersion(row)),
      total: counts[0]?.count ?? 0,
      limit: page.limit,
      offset: page.offset,
    };
  }

  private requireRow(rows: readonly SettingVersionRow[]): SettingVersionRow {
    const row = rows[0];
    if (row === undefined) {
      throw new Error('Expected a returned row from the setting version write');
    }
    return row;
  }

  private toVersion(row: SettingVersionRow): SettingVersion {
    return {
      id: row.id,
      teamId: row.team_id,
      settingKey: parseSettingKey(row.setting_key),
      effectiveFrom: toDate(row.effective_from),
      value: row.value,
      note: row.note,
      createdBy: row.created_by,
      createdAt: toDate(row.created_at),
    };
  }
}
