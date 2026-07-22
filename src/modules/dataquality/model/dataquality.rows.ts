/** Raw `data_quality_anomalies` row. */
export interface AnomalyRow {
  readonly id: string;
  readonly team_id: string;
  readonly rule_key: string;
  readonly rule_version: string;
  readonly severity: string;
  readonly resource_type: string;
  readonly resource_ref: string;
  readonly fingerprint: string;
  readonly occurrence_count: number | string;
  readonly status: string;
  readonly owner_user_id: string | null;
  readonly resolution: string | null;
  readonly suppressed_until: string | Date | null;
  readonly record_version: number | string;
  readonly first_seen_at: string | Date;
  readonly last_seen_at: string | Date;
  readonly resolved_at: string | Date | null;
  readonly created_at: string | Date;
  readonly updated_at: string | Date;
}

/** Raw `data_quality_repairs` row. */
export interface RepairRow {
  readonly id: string;
  readonly team_id: string;
  readonly anomaly_id: string;
  readonly repair_kind: string;
  readonly status: string;
  readonly impact_count: number | string;
  readonly impact_summary: string | null;
  readonly rollback_ref: string | null;
  readonly record_version: number | string;
  readonly requested_by: string | null;
  readonly applied_at: string | Date | null;
  readonly rolled_back_at: string | Date | null;
  readonly created_at: string | Date;
  readonly updated_at: string | Date;
}

/**
 * A detected anomaly fact projected from a source check. Ids only — the safe
 * resource reference never carries a personal payload.
 */
export interface DetectedRow {
  readonly resource_type: string;
  readonly resource_ref: string;
  readonly detail: string;
}

/** A generic count row. */
export interface DataQualityCountRow {
  readonly count: number | string;
}

/** A single-column id probe row. */
export interface DataQualityIdRow {
  readonly id: string;
}
