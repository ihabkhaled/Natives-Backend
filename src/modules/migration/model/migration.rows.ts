/** Raw `import_jobs` row. */
export interface ImportJobRow {
  readonly id: string;
  readonly team_id: string;
  readonly season_id: string | null;
  readonly workbook_type: string;
  readonly mapper_version: string;
  readonly source_hash: string;
  readonly source_name: string;
  readonly dry_run: boolean;
  readonly status: string;
  readonly received_rows: number | string;
  readonly staged_rows: number | string;
  readonly committed_rows: number | string;
  readonly skipped_rows: number | string;
  readonly error_rows: number | string;
  readonly quarantined_rows: number | string;
  readonly reversal_of_job_id: string | null;
  readonly record_version: number | string;
  readonly requested_by: string | null;
  readonly committed_at: string | Date | null;
  readonly reversed_at: string | Date | null;
  readonly created_at: string | Date;
  readonly updated_at: string | Date;
}

/** Raw `import_row_results` row. */
export interface RowResultRow {
  readonly id: string;
  readonly team_id: string;
  readonly job_id: string;
  readonly row_ref: string;
  readonly outcome: string;
  readonly action: string;
  readonly entity_ref: string | null;
  readonly message_key: string | null;
  readonly created_at: string | Date;
}

/** Raw `alias_resolutions` row. */
export interface AliasResolutionRow {
  readonly id: string;
  readonly team_id: string;
  readonly source: string;
  readonly source_alias: string;
  readonly normalized_alias: string;
  readonly candidate_membership_id: string | null;
  readonly confidence: number | string;
  readonly status: string;
  readonly resolved_membership_id: string | null;
  readonly override: boolean;
  readonly record_version: number | string;
  readonly reviewed_by: string | null;
  readonly reviewed_at: string | Date | null;
  readonly created_at: string | Date;
  readonly updated_at: string | Date;
}

/** Raw `formula_comparisons` row. */
export interface ComparisonRow {
  readonly id: string;
  readonly team_id: string;
  readonly workbook_type: string;
  readonly metric: string;
  readonly subject_ref: string;
  readonly legacy_value: number | string | null;
  readonly target_value: number | string | null;
  readonly difference: number | string | null;
  readonly classification: string;
  readonly legacy_rule_version: string | null;
  readonly target_rule_version: string | null;
  readonly artifact_checksum: string;
  readonly signed_off: boolean;
  readonly signed_off_by_name: string | null;
  readonly record_version: number | string;
  readonly signed_off_at: string | Date | null;
  readonly created_at: string | Date;
  readonly updated_at: string | Date;
}

/** A generic count row. */
export interface MigrationCountRow {
  readonly count: number | string;
}

/** A single-column id probe row. */
export interface MigrationIdRow {
  readonly id: string;
}
