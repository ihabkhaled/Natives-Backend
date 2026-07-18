import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Injectable } from '@nestjs/common';

import { parseRuleStatus, parseWeights } from '../lib/attendance.helpers';
import { ATTENDANCE_RULE_COLUMNS } from '../model/attendance.constants';
import type { AttendanceScoringRuleRow } from '../model/attendance.rows';
import type { AttendanceScoringRule } from '../model/attendance.types';

/**
 * Read-only access to the versioned attendance scoring rules. The seeded legacy
 * weights live here as DATA (never hard-coded constants); the participation
 * projection cites the default rule so a displayed rate/points contribution is
 * always reproducible from source records against a named version.
 */
@Injectable()
export class AttendanceScoringRuleRepository {
  async findDefault(
    scope: TransactionScope,
  ): Promise<AttendanceScoringRule | null> {
    const rows = await scope.run<AttendanceScoringRuleRow>(
      `SELECT ${ATTENDANCE_RULE_COLUMNS} FROM "attendance_scoring_rules"
        WHERE "is_default" = true
        ORDER BY "effective_from" DESC, "code" ASC
        LIMIT 1`,
    );
    const row = rows[0];
    return row === undefined ? null : this.toRule(row);
  }

  private toRule(row: AttendanceScoringRuleRow): AttendanceScoringRule {
    return {
      code: row.code,
      status: parseRuleStatus(row.status),
      weights: parseWeights(row.weights),
      defaultWeight: row.default_weight,
      latePenalty: row.late_penalty,
      absentPenalty: row.absent_penalty,
      excusedExcluded: row.excused_excluded,
    };
  }
}
