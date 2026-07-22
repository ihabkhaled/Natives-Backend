import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Injectable } from '@nestjs/common';

import { toDisciplineCase } from '../lib/governance.mapper';
import { CASE_COLUMNS, LIST_MAX_LIMIT } from '../model/governance.constants';
import type {
  DisciplineCaseRow,
  GovernanceCountRow,
} from '../model/governance.rows';
import type {
  DisciplineCase,
  DisciplineListFilter,
  DisciplineStatusChange,
  NewDisciplineCase,
  PageRequest,
} from '../model/governance.types';

/**
 * Persistence for discipline cases — the most restricted data in the module.
 * Data access only: parameterized SQL, static column lists,
 * optimistic-version-guarded transitions, and bounded reads. The private notes
 * and fact summary never leave this row; they are not projected into any list
 * used by search, notifications, or analytics.
 */
@Injectable()
export class DisciplineRepository {
  async insert(
    scope: TransactionScope,
    disciplineCase: NewDisciplineCase,
  ): Promise<DisciplineCase> {
    const rows = await scope.run<DisciplineCaseRow>(
      `INSERT INTO "discipline_cases"
        ("id", "team_id", "membership_id", "rule_id", "severity",
         "fact_summary", "evidence_reference", "private_notes", "action",
         "due_date", "opened_by", "retention_expires_at", "created_at",
         "updated_at")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $13)
       RETURNING ${CASE_COLUMNS}`,
      [
        disciplineCase.id,
        disciplineCase.teamId,
        disciplineCase.membershipId,
        disciplineCase.ruleId,
        disciplineCase.severity,
        disciplineCase.factSummary,
        disciplineCase.evidenceReference,
        disciplineCase.privateNotes,
        disciplineCase.action,
        disciplineCase.dueDate,
        disciplineCase.openedBy,
        disciplineCase.retentionExpiresAt.toISOString(),
        disciplineCase.now.toISOString(),
      ],
    );
    const row = rows[0];
    if (row === undefined) {
      throw new Error('Expected a returned row from the discipline write');
    }
    return toDisciplineCase(row);
  }

  async findForWrite(
    scope: TransactionScope,
    teamId: string,
    caseId: string,
  ): Promise<DisciplineCase | null> {
    const rows = await scope.run<DisciplineCaseRow>(
      `SELECT ${CASE_COLUMNS} FROM "discipline_cases"
        WHERE "id" = $1 AND "team_id" = $2`,
      [caseId, teamId],
    );
    const row = rows[0];
    return row === undefined ? null : toDisciplineCase(row);
  }

  async applyStatusChange(
    scope: TransactionScope,
    change: DisciplineStatusChange,
  ): Promise<DisciplineCase | null> {
    const rows = await scope.run<DisciplineCaseRow>(
      `UPDATE "discipline_cases"
          SET "status" = $4, "action" = $5, "member_response" = $6,
              "appeal_reason" = $7, "resolution" = $8, "reviewed_by" = $9,
              "resolved_by" = $10, "responded_at" = $11, "reviewed_at" = $12,
              "appealed_at" = $13, "resolved_at" = $14, "expunged_at" = $15,
              "updated_at" = $16, "record_version" = "record_version" + 1
        WHERE "id" = $1 AND "team_id" = $2 AND "record_version" = $3
       RETURNING ${CASE_COLUMNS}`,
      this.statusParameters(change),
    );
    const row = rows[0];
    return row === undefined ? null : toDisciplineCase(row);
  }

  async listForScope(
    scope: TransactionScope,
    teamId: string,
    filter: DisciplineListFilter,
    page: PageRequest,
  ): Promise<readonly DisciplineCase[]> {
    const rows = await scope.run<DisciplineCaseRow>(
      `SELECT ${CASE_COLUMNS} FROM "discipline_cases"
        WHERE ${this.predicate()}
        ORDER BY "created_at" DESC, "id" ASC
        LIMIT $5 OFFSET $6`,
      [
        ...this.filterParameters(teamId, filter),
        Math.min(page.limit, LIST_MAX_LIMIT),
        page.offset,
      ],
    );
    return rows.map(row => toDisciplineCase(row));
  }

  async countForScope(
    scope: TransactionScope,
    teamId: string,
    filter: DisciplineListFilter,
  ): Promise<number> {
    const rows = await scope.run<GovernanceCountRow>(
      `SELECT COUNT(*)::int AS "count" FROM "discipline_cases"
        WHERE ${this.predicate()}`,
      this.filterParameters(teamId, filter),
    );
    return Number(rows[0]?.count ?? 0);
  }

  private predicate(): string {
    return `"team_id" = $1
          AND ($2::uuid IS NULL OR "membership_id" = $2)
          AND ($3::text IS NULL OR "status" = $3)
          AND ($4::text IS NULL OR "severity" = $4)`;
  }

  private filterParameters(
    teamId: string,
    filter: DisciplineListFilter,
  ): readonly unknown[] {
    return [teamId, filter.membershipId, filter.status, filter.severity];
  }

  private statusParameters(change: DisciplineStatusChange): readonly unknown[] {
    return [
      change.id,
      change.teamId,
      change.expectedRecordVersion,
      change.toStatus,
      change.action,
      change.memberResponse,
      change.appealReason,
      change.resolution,
      change.reviewedBy,
      change.resolvedBy,
      this.instant(change.respondedAt),
      this.instant(change.reviewedAt),
      this.instant(change.appealedAt),
      this.instant(change.resolvedAt),
      this.instant(change.expungedAt),
      change.now.toISOString(),
    ];
  }

  private instant(value: Date | null): string | null {
    return value === null ? null : value.toISOString();
  }
}
