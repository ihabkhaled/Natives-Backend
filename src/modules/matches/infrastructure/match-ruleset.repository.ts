import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Injectable } from '@nestjs/common';

import { toMatchRuleset } from '../lib/matches.mapper';
import {
  LIST_MAX_LIMIT,
  MATCH_RULESET_COLUMNS,
  RULESET_VERSION_MIN,
} from '../model/matches.constants';
import type {
  CountRow,
  MatchRulesetRow,
  NumberRow,
} from '../model/matches.rows';
import type {
  MatchRuleset,
  NewMatchRuleset,
  PageRequest,
} from '../model/matches.types';

/**
 * Persistence for the VERSIONED scoring rule sets. Data access only:
 * parameterized SQL, static column lists, and bounded, deterministically ordered
 * reads. A published version is never updated — publishing a change inserts the
 * next version and archives the previous active one — so every historical match
 * stays explainable under exactly the rules it was played under.
 */
@Injectable()
export class MatchRulesetRepository {
  async insert(
    scope: TransactionScope,
    ruleset: NewMatchRuleset,
  ): Promise<MatchRuleset> {
    const rows = await scope.run<MatchRulesetRow>(
      `INSERT INTO "match_rulesets"
        ("id", "team_id", "season_id", "ruleset_key", "ruleset_version", "name",
         "game_to", "win_by", "hard_cap", "soft_cap_minutes", "soft_cap_plus",
         "time_cap_minutes", "halftime_at", "timeouts_per_team",
         "timeouts_per_period", "periods", "opponent_error_attribution",
         "status", "notes", "created_by", "created_at", "updated_at")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
               $16, $17, 'active', $18, $19, $20, $20)
       RETURNING ${MATCH_RULESET_COLUMNS}`,
      this.insertParameters(ruleset),
    );
    return toMatchRuleset(this.requireRow(rows));
  }

  /** Archive the currently active version of a key so the new one can take over. */
  async archiveActive(
    scope: TransactionScope,
    teamId: string,
    rulesetKey: string,
    now: Date,
  ): Promise<void> {
    await scope.run(
      `UPDATE "match_rulesets"
          SET "status" = 'archived', "updated_at" = $3
        WHERE "team_id" = $1 AND "ruleset_key" = $2 AND "status" = 'active'`,
      [teamId, rulesetKey, now.toISOString()],
    );
  }

  async findById(
    scope: TransactionScope,
    teamId: string,
    rulesetId: string,
  ): Promise<MatchRuleset | null> {
    const rows = await scope.run<MatchRulesetRow>(
      `SELECT ${MATCH_RULESET_COLUMNS} FROM "match_rulesets"
        WHERE "id" = $1 AND "team_id" = $2`,
      [rulesetId, teamId],
    );
    const row = rows[0];
    return row === undefined ? null : toMatchRuleset(row);
  }

  /** The active version of a named key — the only one a new match may adopt. */
  async findActiveByKey(
    scope: TransactionScope,
    teamId: string,
    rulesetKey: string,
  ): Promise<MatchRuleset | null> {
    const rows = await scope.run<MatchRulesetRow>(
      `SELECT ${MATCH_RULESET_COLUMNS} FROM "match_rulesets"
        WHERE "team_id" = $1 AND "ruleset_key" = $2 AND "status" = 'active'`,
      [teamId, rulesetKey],
    );
    const row = rows[0];
    return row === undefined ? null : toMatchRuleset(row);
  }

  /** Any active ruleset for the team, used as the default when none is named. */
  async findDefaultActive(
    scope: TransactionScope,
    teamId: string,
  ): Promise<MatchRuleset | null> {
    const rows = await scope.run<MatchRulesetRow>(
      `SELECT ${MATCH_RULESET_COLUMNS} FROM "match_rulesets"
        WHERE "team_id" = $1 AND "status" = 'active'
        ORDER BY "created_at" ASC, "id" ASC
        LIMIT 1`,
      [teamId],
    );
    const row = rows[0];
    return row === undefined ? null : toMatchRuleset(row);
  }

  async nextVersion(
    scope: TransactionScope,
    teamId: string,
    rulesetKey: string,
  ): Promise<number> {
    const rows = await scope.run<NumberRow>(
      `SELECT MAX("ruleset_version") AS "value" FROM "match_rulesets"
        WHERE "team_id" = $1 AND "ruleset_key" = $2`,
      [teamId, rulesetKey],
    );
    const current = rows[0]?.value;
    return current === null || current === undefined
      ? RULESET_VERSION_MIN
      : Number(current) + 1;
  }

  async listForTeam(
    scope: TransactionScope,
    teamId: string,
    page: PageRequest,
  ): Promise<readonly MatchRuleset[]> {
    const rows = await scope.run<MatchRulesetRow>(
      `SELECT ${MATCH_RULESET_COLUMNS} FROM "match_rulesets"
        WHERE "team_id" = $1
        ORDER BY "ruleset_key" ASC, "ruleset_version" DESC, "id" ASC
        LIMIT $2 OFFSET $3`,
      [teamId, Math.min(page.limit, LIST_MAX_LIMIT), page.offset],
    );
    return rows.map(row => toMatchRuleset(row));
  }

  async countForTeam(scope: TransactionScope, teamId: string): Promise<number> {
    const rows = await scope.run<CountRow>(
      `SELECT COUNT(*)::int AS "count" FROM "match_rulesets"
        WHERE "team_id" = $1`,
      [teamId],
    );
    return rows[0]?.count ?? 0;
  }

  private insertParameters(ruleset: NewMatchRuleset): readonly unknown[] {
    return [
      ruleset.id,
      ruleset.teamId,
      ruleset.seasonId,
      ruleset.rulesetKey,
      ruleset.rulesetVersion,
      ruleset.name,
      ruleset.gameTo,
      ruleset.winBy,
      ruleset.hardCap,
      ruleset.softCapMinutes,
      ruleset.softCapPlus,
      ruleset.timeCapMinutes,
      ruleset.halftimeAt,
      ruleset.timeoutsPerTeam,
      ruleset.timeoutsPerPeriod,
      ruleset.periods,
      ruleset.opponentErrorAttribution,
      ruleset.notes,
      ruleset.createdBy,
      ruleset.now.toISOString(),
    ];
  }

  private requireRow(rows: readonly MatchRulesetRow[]): MatchRulesetRow {
    const row = rows[0];
    if (row === undefined) {
      throw new Error('Expected a returned row from the ruleset write');
    }
    return row;
  }
}
