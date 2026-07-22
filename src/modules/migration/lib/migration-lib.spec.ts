import { describe, expect, it } from 'vitest';

import {
  AliasResolutionStatus,
  DiscrepancyClassification,
  ImportStatus,
  RowAction,
  RowOutcome,
  WorkbookType,
} from '../model/migration.enums';
import type { ImportJobRow } from '../model/migration.rows';
import type {
  ImportJob,
  ParsedRow,
  RegisterAliasCommand,
  StageImportCommand,
} from '../model/migration.types';
import { count, isBalanced, reconcile } from './import-reconciler';
import {
  buildComparison,
  buildImportAudit,
  buildNewAliasResolution,
  buildNewImportJob,
  buildParsedRow,
  buildReconciliation,
  buildReversalJob,
  buildRowResult,
} from './migration.builders';
import {
  parseEnumValue,
  resolveMigrationPage,
  sourceHash,
  toDate,
  toNullableNumber,
  toNumber,
} from './migration.helpers';
import { toImportJob } from './migration.mapper';

const NOW = new Date('2025-03-01T00:00:00.000Z');

const JOB_ROW: ImportJobRow = {
  id: 'job-1',
  team_id: 'team-1',
  season_id: null,
  workbook_type: 'assessments',
  mapper_version: 'mapper-v1',
  source_hash: 'hash',
  source_name: 'book.xlsx',
  dry_run: true,
  status: 'staged',
  received_rows: '3',
  staged_rows: '2',
  committed_rows: '0',
  skipped_rows: '0',
  error_rows: '1',
  quarantined_rows: '0',
  reversal_of_job_id: null,
  record_version: '1',
  requested_by: 'user-1',
  committed_at: null,
  reversed_at: null,
  created_at: NOW,
  updated_at: NOW,
};

const JOB: ImportJob = toImportJob(JOB_ROW);

function parsed(outcome: RowOutcome): ParsedRow {
  return buildParsedRow('r-1', outcome, RowAction.None, null, null);
}

describe('migration helpers', () => {
  it('clamps paging, coerces values, and hashes source deterministically', () => {
    expect(resolveMigrationPage(undefined, undefined)).toEqual({
      limit: 20,
      offset: 0,
    });
    expect(toDate(NOW)).toBe(NOW);
    expect(toNumber('4')).toBe(4);
    expect(toNullableNumber(null)).toBeNull();
    expect(parseEnumValue(['a'], 'a', 'x')).toBe('a');
    const rows = [
      { rowRef: 'b', cells: { y: '2', x: '1' } },
      { rowRef: 'a', cells: { x: '1' } },
    ];
    const shuffled = [
      { rowRef: 'a', cells: { x: '1' } },
      { rowRef: 'b', cells: { x: '1', y: '2' } },
    ];
    expect(sourceHash(rows)).toBe(sourceHash(shuffled));
    expect(sourceHash(rows)).not.toBe(sourceHash([{ rowRef: 'a', cells: {} }]));
  });
});

describe('import reconciler', () => {
  it('accounts for every received row exactly once', () => {
    const summary = reconcile([
      parsed(RowOutcome.Staged),
      parsed(RowOutcome.Error),
      parsed(RowOutcome.Quarantined),
    ]);
    expect(summary.received).toBe(3);
    expect(summary.staged).toBe(1);
    expect(summary.error).toBe(1);
    expect(summary.quarantined).toBe(1);
    expect(isBalanced(summary)).toBe(true);
    expect(count([parsed(RowOutcome.Staged)], RowOutcome.Committed)).toBe(0);
  });
});

describe('migration mapper', () => {
  it('maps an import job', () => {
    expect(JOB.workbookType).toBe(WorkbookType.Assessments);
    expect(JOB.status).toBe(ImportStatus.Staged);
    expect(JOB.receivedRows).toBe(3);
    expect(JOB.errorRows).toBe(1);
  });
});

describe('migration builders', () => {
  const command: StageImportCommand = {
    seasonId: null,
    workbookType: WorkbookType.Assessments,
    sourceName: 'book.xlsx',
    dryRun: true,
    rows: [],
  };

  it('builds a new job and a reversal job pointing back', () => {
    const job = buildNewImportJob(
      'id-1',
      'team-1',
      command,
      'hash',
      'user-1',
      NOW,
    );
    expect(job.mapperVersion).toBe('mapper-v1');
    const reversal = buildReversalJob('id-2', JOB, 'user-1', NOW);
    expect(reversal.reversalOfJobId).toBe('job-1');
    expect(reversal.dryRun).toBe(false);
  });

  it('builds a reconciliation and a row result', () => {
    const reconciliation = buildReconciliation(
      JOB,
      {
        received: 3,
        staged: 2,
        committed: 0,
        skippedDuplicate: 0,
        error: 1,
        quarantined: 0,
      },
      ImportStatus.Validated,
      false,
      false,
      NOW,
    );
    expect(reconciliation.status).toBe(ImportStatus.Validated);
    const result = buildRowResult(
      'id-1',
      'team-1',
      'job-1',
      parsed(RowOutcome.Error),
      NOW,
    );
    expect(result.messageKey).toBeNull();
    const withIssue = buildRowResult(
      'id-2',
      'team-1',
      'job-1',
      buildParsedRow(
        'r-2',
        RowOutcome.Error,
        RowAction.None,
        null,
        'broken_reference' as ParsedRow['issue'],
      ),
      NOW,
    );
    expect(withIssue.messageKey).toContain('broken_reference');
  });

  it('builds an alias resolution and a classified comparison', () => {
    const command: RegisterAliasCommand = {
      sourceAlias: 'Mohd Ali',
      candidateMembershipId: 'member-1',
    };
    const resolution = buildNewAliasResolution(
      'id-1',
      'team-1',
      command,
      0.99,
      NOW,
    );
    expect(resolution.normalizedAlias).toBe('mohamed ali');
    expect(resolution.status).toBe(AliasResolutionStatus.Confirmed);
    const comparison = buildComparison(
      'id-1',
      'team-1',
      {
        workbookType: WorkbookType.MatchStats,
        metric: 'goals',
        subjectRef: 's-1',
        legacyValue: 10,
        targetValue: 15,
        legacyRuleVersion: 'v1',
        targetRuleVersion: 'v1',
      },
      false,
      'checksum',
      NOW,
    );
    expect(comparison.classification).toBe(DiscrepancyClassification.TargetBug);
    expect(comparison.difference).toBe(5);
  });

  it('audits imports with counts only, never a source value', () => {
    const audit = buildImportAudit('migration.import.staged', 'user-1', JOB);
    expect(audit.diff['committedRows']).toBe(0);
    expect(JSON.stringify(audit.diff)).not.toContain('book.xlsx');
  });
});
