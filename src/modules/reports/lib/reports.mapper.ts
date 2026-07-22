import {
  REPORT_FORMAT_VALUES,
  REPORT_PRIVACY_CLASS_VALUES,
  REPORT_STATUS_VALUES,
  REPORT_TEMPLATE_VALUES,
} from '../model/reports.enums';
import type { ReportJobRow } from '../model/reports.rows';
import type { ReportJob } from '../model/reports.types';
import {
  parseEnumValue,
  toDate,
  toNullableDate,
  toNullableNumber,
  toNumber,
  toParameters,
} from './reports.helpers';

export function toReportJob(row: ReportJobRow): ReportJob {
  return {
    jobId: row.id,
    teamId: row.team_id,
    seasonId: row.season_id,
    template: parseEnumValue(REPORT_TEMPLATE_VALUES, row.template, 'template'),
    format: parseEnumValue(REPORT_FORMAT_VALUES, row.format, 'format'),
    privacyClass: parseEnumValue(
      REPORT_PRIVACY_CLASS_VALUES,
      row.privacy_class,
      'privacy class',
    ),
    parameters: toParameters(row.parameters),
    requestHash: row.request_hash,
    status: parseEnumValue(REPORT_STATUS_VALUES, row.status, 'status'),
    progress: toNumber(row.progress),
    retryCount: toNumber(row.retry_count),
    calculationVersion: row.calculation_version,
    snapshotAt: toDate(row.snapshot_at),
    storageReference: row.storage_reference,
    checksum: row.checksum,
    rowCount: toNullableNumber(row.row_count),
    failureReason: row.failure_reason,
    expiresAt: toDate(row.expires_at),
    recordVersion: toNumber(row.record_version),
    requestedBy: row.requested_by,
    startedAt: toNullableDate(row.started_at),
    completedAt: toNullableDate(row.completed_at),
    failedAt: toNullableDate(row.failed_at),
    createdAt: toDate(row.created_at),
    updatedAt: toDate(row.updated_at),
  };
}
