import type { TransactionScope } from '@core/persistence/unit-of-work.port';
import { Injectable } from '@nestjs/common';

import { ReportDataRepository } from '../infrastructure/report-data.repository';
import {
  TEMPLATE_COLUMNS,
  TEMPLATE_TITLES,
} from '../model/reports.data.constants';
import { ReportTemplate } from '../model/reports.enums';
import type { ReportJob, ReportRow } from '../model/reports.types';

/**
 * Resolves the columns, title, and rows a report template needs. The column
 * schema is fixed per template, so a dataset can never smuggle a field the
 * template did not define. Roster-based datasets are complete: every active
 * member appears, so a report never silently drops the zero-contribution
 * players.
 */
@Injectable()
export class ReportDatasetService {
  constructor(private readonly data: ReportDataRepository) {}

  columnsFor(template: ReportTemplate): readonly string[] {
    return (
      TEMPLATE_COLUMNS.get(template) ?? [
        'membershipId',
        'status',
        'jerseyNumber',
      ]
    );
  }

  titleFor(template: ReportTemplate): string {
    return TEMPLATE_TITLES.get(template) ?? 'Report';
  }

  rowsFor(
    scope: TransactionScope,
    job: ReportJob,
  ): Promise<readonly ReportRow[]> {
    if (job.template === ReportTemplate.Attendance) {
      return this.data.attendanceRows(scope, job.teamId, job.seasonId);
    }
    if (job.template === ReportTemplate.TrainingLeaderboard) {
      return this.data.leaderboardRows(scope, job.teamId, job.seasonId);
    }
    return this.data.rosterRows(scope, job.teamId);
  }
}
