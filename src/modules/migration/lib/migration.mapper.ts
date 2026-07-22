import {
  ALIAS_RESOLUTION_STATUS_VALUES,
  ALIAS_SOURCE_VALUES,
  DISCREPANCY_CLASSIFICATION_VALUES,
  IMPORT_STATUS_VALUES,
  ROW_ACTION_VALUES,
  ROW_OUTCOME_VALUES,
  WORKBOOK_TYPE_VALUES,
} from '../model/migration.enums';
import type {
  AliasResolutionRow,
  ComparisonRow,
  ImportJobRow,
  RowResultRow,
} from '../model/migration.rows';
import type {
  AliasResolution,
  FormulaComparison,
  ImportJob,
  RowResult,
} from '../model/migration.types';
import {
  parseEnumValue,
  toDate,
  toNullableDate,
  toNullableNumber,
  toNumber,
} from './migration.helpers';

export function toImportJob(row: ImportJobRow): ImportJob {
  return {
    jobId: row.id,
    teamId: row.team_id,
    seasonId: row.season_id,
    workbookType: parseEnumValue(
      WORKBOOK_TYPE_VALUES,
      row.workbook_type,
      'workbook type',
    ),
    mapperVersion: row.mapper_version,
    sourceHash: row.source_hash,
    sourceName: row.source_name,
    dryRun: row.dry_run,
    status: parseEnumValue(IMPORT_STATUS_VALUES, row.status, 'import status'),
    receivedRows: toNumber(row.received_rows),
    stagedRows: toNumber(row.staged_rows),
    committedRows: toNumber(row.committed_rows),
    skippedRows: toNumber(row.skipped_rows),
    errorRows: toNumber(row.error_rows),
    quarantinedRows: toNumber(row.quarantined_rows),
    reversalOfJobId: row.reversal_of_job_id,
    recordVersion: toNumber(row.record_version),
    requestedBy: row.requested_by,
    committedAt: toNullableDate(row.committed_at),
    reversedAt: toNullableDate(row.reversed_at),
    createdAt: toDate(row.created_at),
    updatedAt: toDate(row.updated_at),
  };
}

export function toRowResult(row: RowResultRow): RowResult {
  return {
    resultId: row.id,
    jobId: row.job_id,
    rowRef: row.row_ref,
    outcome: parseEnumValue(ROW_OUTCOME_VALUES, row.outcome, 'row outcome'),
    action: parseEnumValue(ROW_ACTION_VALUES, row.action, 'row action'),
    entityRef: row.entity_ref,
    messageKey: row.message_key,
  };
}

export function toAliasResolution(row: AliasResolutionRow): AliasResolution {
  return {
    resolutionId: row.id,
    teamId: row.team_id,
    source: parseEnumValue(ALIAS_SOURCE_VALUES, row.source, 'alias source'),
    sourceAlias: row.source_alias,
    normalizedAlias: row.normalized_alias,
    candidateMembershipId: row.candidate_membership_id,
    confidence: toNumber(row.confidence),
    status: parseEnumValue(
      ALIAS_RESOLUTION_STATUS_VALUES,
      row.status,
      'resolution status',
    ),
    resolvedMembershipId: row.resolved_membership_id,
    override: row.override,
    recordVersion: toNumber(row.record_version),
    reviewedBy: row.reviewed_by,
    reviewedAt: toNullableDate(row.reviewed_at),
    createdAt: toDate(row.created_at),
    updatedAt: toDate(row.updated_at),
  };
}

export function toComparison(row: ComparisonRow): FormulaComparison {
  return {
    comparisonId: row.id,
    teamId: row.team_id,
    workbookType: parseEnumValue(
      WORKBOOK_TYPE_VALUES,
      row.workbook_type,
      'workbook type',
    ),
    metric: row.metric,
    subjectRef: row.subject_ref,
    legacyValue: toNullableNumber(row.legacy_value),
    targetValue: toNullableNumber(row.target_value),
    difference: toNullableNumber(row.difference),
    classification: parseEnumValue(
      DISCREPANCY_CLASSIFICATION_VALUES,
      row.classification,
      'classification',
    ),
    legacyRuleVersion: row.legacy_rule_version,
    targetRuleVersion: row.target_rule_version,
    artifactChecksum: row.artifact_checksum,
    signedOff: row.signed_off,
    signedOffByName: row.signed_off_by_name,
    recordVersion: toNumber(row.record_version),
    signedOffAt: toNullableDate(row.signed_off_at),
    createdAt: toDate(row.created_at),
    updatedAt: toDate(row.updated_at),
  };
}
