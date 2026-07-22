import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Injectable } from '@nestjs/common';

import { toAcknowledgement, toTeamRule } from '../lib/governance.mapper';
import {
  ACK_COLUMNS,
  LIST_MAX_LIMIT,
  RULE_COLUMNS,
} from '../model/governance.constants';
import type {
  AckRow,
  GovernanceCountRow,
  RuleRow,
} from '../model/governance.rows';
import type {
  NewRuleAcknowledgement,
  NewTeamRule,
  PageRequest,
  RuleAcknowledgement,
  RuleListFilter,
  TeamRule,
} from '../model/governance.types';

/**
 * Persistence for versioned team rules and their acknowledgements. Data access
 * only: parameterized SQL, static column lists, bounded reads. Rules are
 * append-only at the database level (an ON UPDATE DO INSTEAD NOTHING rule), so a
 * published version is never rewritten; an acknowledgement is upserted per
 * (rule, member) and always records the version it accepted.
 */
@Injectable()
export class RuleRepository {
  async insert(scope: TransactionScope, rule: NewTeamRule): Promise<TeamRule> {
    const rows = await scope.run<RuleRow>(
      `INSERT INTO "team_rules"
        ("id", "team_id", "rule_key", "version", "category", "title", "body",
         "audience", "requires_acknowledgement", "effective_from",
         "owner_user_id", "created_by", "created_at")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $10)
       RETURNING ${RULE_COLUMNS}`,
      [
        rule.id,
        rule.teamId,
        rule.ruleKey,
        rule.version,
        rule.category,
        rule.title,
        rule.body,
        rule.audience,
        rule.requiresAcknowledgement,
        rule.effectiveFrom.toISOString(),
        rule.ownerUserId,
        rule.createdBy,
      ],
    );
    const row = rows[0];
    if (row === undefined) {
      throw new Error('Expected a returned row from the rule write');
    }
    return toTeamRule(row);
  }

  async findForWrite(
    scope: TransactionScope,
    teamId: string,
    ruleId: string,
  ): Promise<TeamRule | null> {
    const rows = await scope.run<RuleRow>(
      `SELECT ${RULE_COLUMNS} FROM "team_rules"
        WHERE "id" = $1 AND "team_id" = $2`,
      [ruleId, teamId],
    );
    const row = rows[0];
    return row === undefined ? null : toTeamRule(row);
  }

  async findLatestByKey(
    scope: TransactionScope,
    teamId: string,
    ruleKey: string,
  ): Promise<TeamRule | null> {
    const rows = await scope.run<RuleRow>(
      `SELECT ${RULE_COLUMNS} FROM "team_rules"
        WHERE "team_id" = $1 AND "rule_key" = $2
        ORDER BY "version" DESC
        LIMIT 1`,
      [teamId, ruleKey],
    );
    const row = rows[0];
    return row === undefined ? null : toTeamRule(row);
  }

  async listForScope(
    scope: TransactionScope,
    teamId: string,
    filter: RuleListFilter,
    page: PageRequest,
  ): Promise<readonly TeamRule[]> {
    const rows = await scope.run<RuleRow>(
      `SELECT ${RULE_COLUMNS} FROM "team_rules"
        WHERE "team_id" = $1
          AND ($2::text IS NULL OR "category" = $2)
          AND ($3::text IS NULL OR "status" = $3)
        ORDER BY "rule_key" ASC, "version" DESC
        LIMIT $4 OFFSET $5`,
      [
        teamId,
        filter.category,
        filter.status,
        Math.min(page.limit, LIST_MAX_LIMIT),
        page.offset,
      ],
    );
    return rows.map(row => toTeamRule(row));
  }

  async countForScope(
    scope: TransactionScope,
    teamId: string,
    filter: RuleListFilter,
  ): Promise<number> {
    const rows = await scope.run<GovernanceCountRow>(
      `SELECT COUNT(*)::int AS "count" FROM "team_rules"
        WHERE "team_id" = $1
          AND ($2::text IS NULL OR "category" = $2)
          AND ($3::text IS NULL OR "status" = $3)`,
      [teamId, filter.category, filter.status],
    );
    return Number(rows[0]?.count ?? 0);
  }

  async upsertAcknowledgement(
    scope: TransactionScope,
    ack: NewRuleAcknowledgement,
  ): Promise<RuleAcknowledgement> {
    const rows = await scope.run<AckRow>(
      `INSERT INTO "rule_acknowledgements"
        ("id", "team_id", "rule_id", "membership_id", "rule_version",
         "acknowledged_at")
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT ("rule_id", "membership_id") DO UPDATE SET
         "rule_version" = EXCLUDED."rule_version",
         "acknowledged_at" = EXCLUDED."acknowledged_at"
       RETURNING ${ACK_COLUMNS}`,
      [
        ack.id,
        ack.teamId,
        ack.ruleId,
        ack.membershipId,
        ack.ruleVersion,
        ack.now.toISOString(),
      ],
    );
    const row = rows[0];
    if (row === undefined) {
      throw new Error('Expected a returned row from the acknowledgement write');
    }
    return toAcknowledgement(row);
  }
}
