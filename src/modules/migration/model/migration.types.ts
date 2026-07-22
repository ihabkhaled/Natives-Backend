import type {
  AliasResolutionStatus,
  AliasSource,
  CellIssue,
  DiscrepancyClassification,
  ImportStatus,
  RowAction,
  RowOutcome,
  WorkbookType,
} from './migration.enums';

// --- Pagination --------------------------------------------------------------

export interface PageRequest {
  readonly limit: number;
  readonly offset: number;
}

export interface PagedResult<TItem> {
  readonly items: readonly TItem[];
  readonly total: number;
  readonly limit: number;
  readonly offset: number;
}

// --- Import jobs -------------------------------------------------------------

export interface ImportJob {
  readonly jobId: string;
  readonly teamId: string;
  readonly seasonId: string | null;
  readonly workbookType: WorkbookType;
  readonly mapperVersion: string;
  readonly sourceHash: string;
  readonly sourceName: string;
  readonly dryRun: boolean;
  readonly status: ImportStatus;
  readonly receivedRows: number;
  readonly stagedRows: number;
  readonly committedRows: number;
  readonly skippedRows: number;
  readonly errorRows: number;
  readonly quarantinedRows: number;
  readonly reversalOfJobId: string | null;
  readonly recordVersion: number;
  readonly requestedBy: string | null;
  readonly committedAt: Date | null;
  readonly reversedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface NewImportJob {
  readonly id: string;
  readonly teamId: string;
  readonly seasonId: string | null;
  readonly workbookType: WorkbookType;
  readonly mapperVersion: string;
  readonly sourceHash: string;
  readonly sourceName: string;
  readonly dryRun: boolean;
  readonly reversalOfJobId: string | null;
  readonly requestedBy: string;
  readonly now: Date;
}

/** A version-guarded reconciliation update of an import job. */
export interface ImportReconciliation {
  readonly id: string;
  readonly teamId: string;
  readonly expectedRecordVersion: number;
  readonly status: ImportStatus;
  readonly receivedRows: number;
  readonly stagedRows: number;
  readonly committedRows: number;
  readonly skippedRows: number;
  readonly errorRows: number;
  readonly quarantinedRows: number;
  readonly committed: boolean;
  readonly reversed: boolean;
  readonly now: Date;
}

/** One raw source row passed to a dry-run or commit. */
export interface ImportSourceRow {
  readonly rowRef: string;
  readonly cells: Readonly<Record<string, string>>;
}

export interface StageImportCommand {
  readonly seasonId: string | null;
  readonly workbookType: WorkbookType;
  readonly sourceName: string;
  readonly dryRun: boolean;
  readonly rows: readonly ImportSourceRow[];
}

/** One parsed and validated row, or the reason it was rejected. */
export interface ParsedRow {
  readonly rowRef: string;
  readonly outcome: RowOutcome;
  readonly action: RowAction;
  readonly entityRef: string | null;
  readonly issue: CellIssue | null;
}

export interface NewRowResult {
  readonly id: string;
  readonly teamId: string;
  readonly jobId: string;
  readonly rowRef: string;
  readonly outcome: RowOutcome;
  readonly action: RowAction;
  readonly entityRef: string | null;
  readonly messageKey: string | null;
  readonly now: Date;
}

export interface RowResult {
  readonly resultId: string;
  readonly jobId: string;
  readonly rowRef: string;
  readonly outcome: RowOutcome;
  readonly action: RowAction;
  readonly entityRef: string | null;
  readonly messageKey: string | null;
}

/** The reconciliation totals of one import run. */
export interface ImportReconciliationSummary {
  readonly received: number;
  readonly staged: number;
  readonly committed: number;
  readonly skippedDuplicate: number;
  readonly error: number;
  readonly quarantined: number;
}

export type ImportJobPage = PagedResult<ImportJob>;

/** An import job's per-row results (already bounded by the repository). */
export interface RowResultList {
  readonly items: readonly RowResult[];
}

export interface ImportListFilter {
  readonly workbookType: WorkbookType | null;
  readonly status: ImportStatus | null;
}

export interface ImportListFilterInput {
  readonly workbookType?: WorkbookType | null;
  readonly status?: ImportStatus | null;
}

export interface StageImportCommandInput {
  readonly seasonId?: string | null;
  readonly workbookType: WorkbookType;
  readonly sourceName: string;
  readonly dryRun?: boolean | null;
  readonly rows: readonly ImportSourceRow[];
}

// --- Workbook parsing (adapter contract) -------------------------------------

/** A parsed cell: its typed value, or the issue that makes it untrusted. */
export interface ParsedCell {
  readonly raw: string;
  readonly value: string | null;
  readonly issue: CellIssue | null;
}

export interface WorkbookParserPort {
  parseCell(raw: string): ParsedCell;
  parseSerialDate(raw: string): string | null;
}

// --- Alias resolution (703) --------------------------------------------------

export interface AliasResolution {
  readonly resolutionId: string;
  readonly teamId: string;
  readonly source: AliasSource;
  readonly sourceAlias: string;
  readonly normalizedAlias: string;
  readonly candidateMembershipId: string | null;
  readonly confidence: number;
  readonly status: AliasResolutionStatus;
  readonly resolvedMembershipId: string | null;
  readonly override: boolean;
  readonly recordVersion: number;
  readonly reviewedBy: string | null;
  readonly reviewedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface NewAliasResolution {
  readonly id: string;
  readonly teamId: string;
  readonly source: AliasSource;
  readonly sourceAlias: string;
  readonly normalizedAlias: string;
  readonly candidateMembershipId: string | null;
  readonly confidence: number;
  readonly status: AliasResolutionStatus;
  readonly now: Date;
}

export interface RegisterAliasCommand {
  readonly sourceAlias: string;
  readonly candidateMembershipId: string | null;
}

/** A version-guarded human review of a resolution. */
export interface AliasReview {
  readonly id: string;
  readonly teamId: string;
  readonly expectedRecordVersion: number;
  readonly status: AliasResolutionStatus;
  readonly resolvedMembershipId: string | null;
  readonly override: boolean;
  readonly reviewedBy: string;
  readonly now: Date;
}

export interface ReviewAliasCommand {
  readonly status: AliasResolutionStatus;
  readonly resolvedMembershipId: string | null;
  readonly override: boolean;
  readonly expectedRecordVersion: number;
}

export type AliasResolutionPage = PagedResult<AliasResolution>;

export interface AliasListFilter {
  readonly status: AliasResolutionStatus | null;
}

export interface AliasListFilterInput {
  readonly status?: AliasResolutionStatus | null;
}

// --- Formula comparison (704) ------------------------------------------------

export interface FormulaComparison {
  readonly comparisonId: string;
  readonly teamId: string;
  readonly workbookType: WorkbookType;
  readonly metric: string;
  readonly subjectRef: string;
  readonly legacyValue: number | null;
  readonly targetValue: number | null;
  readonly difference: number | null;
  readonly classification: DiscrepancyClassification;
  readonly legacyRuleVersion: string | null;
  readonly targetRuleVersion: string | null;
  readonly artifactChecksum: string;
  readonly signedOff: boolean;
  readonly signedOffByName: string | null;
  readonly recordVersion: number;
  readonly signedOffAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface ComparisonUpsert {
  readonly id: string;
  readonly teamId: string;
  readonly workbookType: WorkbookType;
  readonly metric: string;
  readonly subjectRef: string;
  readonly legacyValue: number | null;
  readonly targetValue: number | null;
  readonly difference: number | null;
  readonly classification: DiscrepancyClassification;
  readonly legacyRuleVersion: string | null;
  readonly targetRuleVersion: string | null;
  readonly artifactChecksum: string;
  readonly now: Date;
}

export interface RecordComparisonCommand {
  readonly workbookType: WorkbookType;
  readonly metric: string;
  readonly subjectRef: string;
  readonly legacyValue: number | null;
  readonly targetValue: number | null;
  readonly legacyRuleVersion: string | null;
  readonly targetRuleVersion: string | null;
}

export interface RecordComparisonCommandInput {
  readonly workbookType: WorkbookType;
  readonly metric: string;
  readonly subjectRef: string;
  readonly legacyValue?: number | null;
  readonly targetValue?: number | null;
  readonly legacyRuleVersion?: string | null;
  readonly targetRuleVersion?: string | null;
}

export interface SignOffCommand {
  readonly signedOffByName: string;
  readonly expectedRecordVersion: number;
}

/** A version-guarded named sign-off. */
export interface ComparisonSignOff {
  readonly id: string;
  readonly teamId: string;
  readonly expectedRecordVersion: number;
  readonly signedOffByName: string;
  readonly now: Date;
}

export type FormulaComparisonPage = PagedResult<FormulaComparison>;

export interface ComparisonListFilter {
  readonly workbookType: WorkbookType | null;
  readonly classification: DiscrepancyClassification | null;
  readonly signedOff: boolean | null;
}

export interface ComparisonListFilterInput {
  readonly workbookType?: WorkbookType | null;
  readonly classification?: DiscrepancyClassification | null;
  readonly signedOff?: boolean | null;
}

/** The inputs the classification policy consumes. */
export interface ComparisonInput {
  readonly legacyValue: number | null;
  readonly targetValue: number | null;
  readonly legacyRuleVersion: string | null;
  readonly targetRuleVersion: string | null;
  readonly legacyBroken: boolean;
}

/** The resolved team scope of a migration operation. */
export interface MigrationScope {
  readonly teamId: string;
}
