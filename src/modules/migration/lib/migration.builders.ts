import type { AuditInput } from '@modules/platform';
import { AuditOutcome } from '@modules/platform';

import {
  initialStatusOf,
  normalizeAlias,
} from '../domain/alias-matching.policy';
import {
  classifyDiscrepancy,
  differenceOf,
} from '../domain/discrepancy-classification.policy';
import {
  ALIAS_RESOURCE_TYPE,
  COMPARISON_RESOURCE_TYPE,
  IMPORT_RESOURCE_TYPE,
  IMPORT_STAGED_ACTION,
  MAPPER_VERSION,
} from '../model/migration.constants';
import type { ImportStatus } from '../model/migration.enums';
import { AliasSource, RowAction, RowOutcome } from '../model/migration.enums';
import type {
  AliasResolution,
  ComparisonUpsert,
  FormulaComparison,
  ImportJob,
  ImportReconciliation,
  ImportReconciliationSummary,
  NewAliasResolution,
  NewImportJob,
  NewRowResult,
  ParsedCell,
  ParsedRow,
  RecordComparisonCommand,
  RegisterAliasCommand,
  StageImportCommand,
} from '../model/migration.types';

// --- Import jobs -------------------------------------------------------------

export function buildNewImportJob(
  id: string,
  teamId: string,
  command: StageImportCommand,
  sourceHash: string,
  actorUserId: string,
  now: Date,
): NewImportJob {
  return {
    id,
    teamId,
    seasonId: command.seasonId,
    workbookType: command.workbookType,
    mapperVersion: MAPPER_VERSION,
    sourceHash,
    sourceName: command.sourceName,
    dryRun: command.dryRun,
    reversalOfJobId: null,
    requestedBy: actorUserId,
    now,
  };
}

export function buildReversalJob(
  id: string,
  original: ImportJob,
  actorUserId: string,
  now: Date,
): NewImportJob {
  return {
    id,
    teamId: original.teamId,
    seasonId: original.seasonId,
    workbookType: original.workbookType,
    mapperVersion: original.mapperVersion,
    sourceHash: `reversal:${original.sourceHash}`,
    sourceName: `Reversal of ${original.sourceName}`,
    dryRun: false,
    reversalOfJobId: original.jobId,
    requestedBy: actorUserId,
    now,
  };
}

export function buildReconciliation(
  job: ImportJob,
  summary: ImportReconciliationSummary,
  status: ImportStatus,
  committed: boolean,
  reversed: boolean,
  now: Date,
): ImportReconciliation {
  return {
    id: job.jobId,
    teamId: job.teamId,
    expectedRecordVersion: job.recordVersion,
    status,
    receivedRows: summary.received,
    stagedRows: summary.staged,
    committedRows: summary.committed,
    skippedRows: summary.skippedDuplicate,
    errorRows: summary.error,
    quarantinedRows: summary.quarantined,
    committed,
    reversed,
    now,
  };
}

export function buildRowResult(
  id: string,
  teamId: string,
  jobId: string,
  parsed: ParsedRow,
  now: Date,
): NewRowResult {
  return {
    id,
    teamId,
    jobId,
    rowRef: parsed.rowRef,
    outcome: parsed.outcome,
    action: parsed.action,
    entityRef: parsed.entityRef,
    messageKey: parsed.issue === null ? null : `import.issue.${parsed.issue}`,
    now,
  };
}

export function buildParsedRow(
  rowRef: string,
  outcome: RowOutcome,
  action: RowAction,
  entityRef: string | null,
  issue: ParsedRow['issue'],
): ParsedRow {
  return { rowRef, outcome, action, entityRef, issue };
}

/**
 * Classify already-parsed cells into a staged outcome: a cell issue makes the
 * row an ERROR (never a coerced value), a row with no usable cell is
 * QUARANTINED for a human rather than dropped, and a clean row is STAGED.
 */
export function classifyParsedRow(
  rowRef: string,
  cells: readonly ParsedCell[],
): ParsedRow {
  const issue = cells.find(cell => cell.issue !== null)?.issue ?? null;
  if (issue !== null) {
    return buildParsedRow(
      rowRef,
      RowOutcome.Error,
      RowAction.None,
      null,
      issue,
    );
  }
  if (!cells.some(cell => cell.value !== null)) {
    return buildParsedRow(
      rowRef,
      RowOutcome.Quarantined,
      RowAction.None,
      null,
      null,
    );
  }
  return buildParsedRow(
    rowRef,
    RowOutcome.Staged,
    RowAction.None,
    rowRef,
    null,
  );
}

// --- Alias resolutions -------------------------------------------------------

export function buildNewAliasResolution(
  id: string,
  teamId: string,
  command: RegisterAliasCommand,
  confidence: number,
  now: Date,
): NewAliasResolution {
  return {
    id,
    teamId,
    source: AliasSource.Import,
    sourceAlias: command.sourceAlias,
    normalizedAlias: normalizeAlias(command.sourceAlias),
    candidateMembershipId: command.candidateMembershipId,
    confidence,
    status: initialStatusOf(confidence),
    now,
  };
}

// --- Formula comparisons -----------------------------------------------------

export function buildComparison(
  id: string,
  teamId: string,
  command: RecordComparisonCommand,
  legacyBroken: boolean,
  checksum: string,
  now: Date,
): ComparisonUpsert {
  const input = {
    legacyValue: command.legacyValue,
    targetValue: command.targetValue,
    legacyRuleVersion: command.legacyRuleVersion,
    targetRuleVersion: command.targetRuleVersion,
    legacyBroken,
  };
  return {
    id,
    teamId,
    workbookType: command.workbookType,
    metric: command.metric,
    subjectRef: command.subjectRef,
    legacyValue: command.legacyValue,
    targetValue: command.targetValue,
    difference: differenceOf(input),
    classification: classifyDiscrepancy(input),
    legacyRuleVersion: command.legacyRuleVersion,
    targetRuleVersion: command.targetRuleVersion,
    artifactChecksum: checksum,
    now,
  };
}

// --- Audit -------------------------------------------------------------------

/** Audit an import. Counts only — never a source value or a row payload. */
export function buildImportAudit(
  action: string,
  actorUserId: string,
  job: ImportJob,
): AuditInput {
  return {
    actorUserId,
    action,
    resourceType: IMPORT_RESOURCE_TYPE,
    resourceId: job.jobId,
    teamId: job.teamId,
    seasonId: job.seasonId,
    correlationId: null,
    outcome: AuditOutcome.Success,
    diff: {
      workbookType: job.workbookType,
      dryRun: job.dryRun,
      status: job.status,
      committedRows: job.committedRows,
      quarantinedRows: job.quarantinedRows,
    },
  };
}

export function buildStagedAudit(
  actorUserId: string,
  job: ImportJob,
): AuditInput {
  return buildImportAudit(IMPORT_STAGED_ACTION, actorUserId, job);
}

/** Audit an alias review. The source alias text never enters the diff. */
export function buildAliasAudit(
  action: string,
  actorUserId: string,
  resolution: AliasResolution,
): AuditInput {
  return {
    actorUserId,
    action,
    resourceType: ALIAS_RESOURCE_TYPE,
    resourceId: resolution.resolutionId,
    teamId: resolution.teamId,
    seasonId: null,
    correlationId: null,
    outcome: AuditOutcome.Success,
    diff: {
      status: resolution.status,
      confidence: resolution.confidence,
      resolvedMembershipId: resolution.resolvedMembershipId,
      override: resolution.override,
    },
  };
}

export function buildComparisonAudit(
  action: string,
  actorUserId: string,
  comparison: FormulaComparison,
): AuditInput {
  return {
    actorUserId,
    action,
    resourceType: COMPARISON_RESOURCE_TYPE,
    resourceId: comparison.comparisonId,
    teamId: comparison.teamId,
    seasonId: null,
    correlationId: null,
    outcome: AuditOutcome.Success,
    diff: {
      workbookType: comparison.workbookType,
      metric: comparison.metric,
      classification: comparison.classification,
      signedOff: comparison.signedOff,
    },
  };
}
