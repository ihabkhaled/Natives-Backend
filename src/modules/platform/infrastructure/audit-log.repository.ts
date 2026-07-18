import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Injectable } from '@nestjs/common';

import { toAuditEntry } from '../lib/platform.mapper';
import { AUDIT_COLUMNS } from '../model/platform.constants';
import type { AuditEntryRow, CountRow } from '../model/platform.rows';
import type {
  AuditEntry,
  NewAuditEntry,
  PagedResult,
  PageRequest,
} from '../model/platform.types';

/**
 * Append-only audit ledger. Every protected mutation records who did what to
 * which resource, in which team/season scope, with correlation, outcome, and a
 * redacted scalar diff — in the same transaction as the change it describes. Rows
 * are never updated or deleted; reads are bounded and deterministically ordered.
 */
@Injectable()
export class AuditLogRepository {
  async append(scope: TransactionScope, entry: NewAuditEntry): Promise<void> {
    await scope.run(
      `INSERT INTO "audit_log" ("id", "actor_user_id", "action",
              "resource_type", "resource_id", "team_id", "season_id",
              "correlation_id", "outcome", "diff", "occurred_at")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11)`,
      [
        entry.id,
        entry.actorUserId,
        entry.action,
        entry.resourceType,
        entry.resourceId,
        entry.teamId,
        entry.seasonId,
        entry.correlationId,
        entry.outcome,
        JSON.stringify(entry.diff),
        entry.occurredAt.toISOString(),
      ],
    );
  }

  async listByTeam(
    scope: TransactionScope,
    teamId: string,
    page: PageRequest,
  ): Promise<PagedResult<AuditEntry>> {
    const rows = await scope.run<AuditEntryRow>(
      `SELECT ${AUDIT_COLUMNS} FROM "audit_log"
        WHERE "team_id" = $1
        ORDER BY "occurred_at" DESC, "id" DESC
        LIMIT $2 OFFSET $3`,
      [teamId, page.limit, page.offset],
    );
    const counts = await scope.run<CountRow>(
      `SELECT COUNT(*)::int AS "count" FROM "audit_log" WHERE "team_id" = $1`,
      [teamId],
    );
    return {
      items: rows.map(row => toAuditEntry(row)),
      total: counts[0]?.count ?? 0,
      limit: page.limit,
      offset: page.offset,
    };
  }
}
