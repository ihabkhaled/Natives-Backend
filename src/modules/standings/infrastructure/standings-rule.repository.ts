import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Injectable } from '@nestjs/common';

import { toStandingsRule } from '../lib/standings.mapper';
import {
  LIST_MAX_LIMIT,
  RULE_VERSION_COLUMNS,
} from '../model/standings.constants';
import type {
  StandingsCountRow,
  StandingsRuleRow,
} from '../model/standings.rows';
import type {
  NewStandingsRuleVersion,
  PageRequest,
  StandingsRuleVersion,
} from '../model/standings.types';

/**
 * Persistence for named, versioned standings rules. Data access only:
 * parameterized SQL, static column lists, and bounded deterministic reads.
 * Rows are append-only at the database level (an ON UPDATE DO INSTEAD NOTHING
 * rule), so a published version can never be rewritten under a stored table.
 */
@Injectable()
export class StandingsRuleRepository {
  async insert(
    scope: TransactionScope,
    rule: NewStandingsRuleVersion,
  ): Promise<StandingsRuleVersion> {
    const rows = await scope.run<StandingsRuleRow>(
      `INSERT INTO "standings_rule_versions"
        ("id", "team_id", "rule_key", "version", "name", "win_points",
         "loss_points", "tie_points", "tie_break_order", "effective_from",
         "created_by", "created_at")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::text[], $10, $11, $10)
       RETURNING ${RULE_VERSION_COLUMNS}`,
      [
        rule.id,
        rule.teamId,
        rule.ruleKey,
        rule.version,
        rule.name,
        rule.winPoints,
        rule.lossPoints,
        rule.tiePoints,
        [...rule.tieBreakOrder],
        rule.effectiveFrom.toISOString(),
        rule.createdBy,
      ],
    );
    const row = rows[0];
    if (row === undefined) {
      throw new Error('Expected a returned row from the standings rule write');
    }
    return toStandingsRule(row);
  }

  /** The newest version of a named rule inside the team. */
  async findLatestByKey(
    scope: TransactionScope,
    teamId: string,
    ruleKey: string,
  ): Promise<StandingsRuleVersion | null> {
    const rows = await scope.run<StandingsRuleRow>(
      `SELECT ${RULE_VERSION_COLUMNS} FROM "standings_rule_versions"
        WHERE "team_id" = $1 AND "rule_key" = $2 AND "status" = 'active'
        ORDER BY "version" DESC
        LIMIT 1`,
      [teamId, ruleKey],
    );
    const row = rows[0];
    return row === undefined ? null : toStandingsRule(row);
  }

  async findById(
    scope: TransactionScope,
    teamId: string,
    ruleVersionId: string,
  ): Promise<StandingsRuleVersion | null> {
    const rows = await scope.run<StandingsRuleRow>(
      `SELECT ${RULE_VERSION_COLUMNS} FROM "standings_rule_versions"
        WHERE "id" = $1 AND "team_id" = $2`,
      [ruleVersionId, teamId],
    );
    const row = rows[0];
    return row === undefined ? null : toStandingsRule(row);
  }

  async listForTeam(
    scope: TransactionScope,
    teamId: string,
    page: PageRequest,
  ): Promise<readonly StandingsRuleVersion[]> {
    const rows = await scope.run<StandingsRuleRow>(
      `SELECT ${RULE_VERSION_COLUMNS} FROM "standings_rule_versions"
        WHERE "team_id" = $1
        ORDER BY "rule_key" ASC, "version" DESC
        LIMIT $2 OFFSET $3`,
      [teamId, Math.min(page.limit, LIST_MAX_LIMIT), page.offset],
    );
    return rows.map(row => toStandingsRule(row));
  }

  async countForTeam(scope: TransactionScope, teamId: string): Promise<number> {
    const rows = await scope.run<StandingsCountRow>(
      `SELECT COUNT(*)::int AS "count" FROM "standings_rule_versions"
        WHERE "team_id" = $1`,
      [teamId],
    );
    return Number(rows[0]?.count ?? 0);
  }
}
