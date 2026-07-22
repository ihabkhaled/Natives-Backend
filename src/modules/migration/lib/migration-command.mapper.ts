import type {
  AliasListFilter,
  AliasListFilterInput,
  ComparisonListFilter,
  ComparisonListFilterInput,
  ImportListFilter,
  ImportListFilterInput,
  RecordComparisonCommand,
  RecordComparisonCommandInput,
  StageImportCommand,
  StageImportCommandInput,
} from '../model/migration.types';

export function toStageImportCommand(
  input: StageImportCommandInput,
): StageImportCommand {
  return {
    seasonId: input.seasonId ?? null,
    workbookType: input.workbookType,
    sourceName: input.sourceName.trim(),
    dryRun: input.dryRun ?? true,
    rows: input.rows,
  };
}

export function toRecordComparisonCommand(
  input: RecordComparisonCommandInput,
): RecordComparisonCommand {
  return {
    workbookType: input.workbookType,
    metric: input.metric.trim(),
    subjectRef: input.subjectRef.trim(),
    legacyValue: input.legacyValue ?? null,
    targetValue: input.targetValue ?? null,
    legacyRuleVersion: input.legacyRuleVersion ?? null,
    targetRuleVersion: input.targetRuleVersion ?? null,
  };
}

export function toImportListFilter(
  input: ImportListFilterInput,
): ImportListFilter {
  return {
    workbookType: input.workbookType ?? null,
    status: input.status ?? null,
  };
}

export function toAliasListFilter(
  input: AliasListFilterInput,
): AliasListFilter {
  return { status: input.status ?? null };
}

export function toComparisonListFilter(
  input: ComparisonListFilterInput,
): ComparisonListFilter {
  return {
    workbookType: input.workbookType ?? null,
    classification: input.classification ?? null,
    signedOff: input.signedOff ?? null,
  };
}
