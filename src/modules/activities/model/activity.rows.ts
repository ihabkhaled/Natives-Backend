/** Raw `activity_types` row as returned by the database driver. */
export interface ActivityTypeRow {
  readonly id: string;
  readonly family_id: string;
  readonly type_key: string;
  readonly name: string;
  readonly description: string;
  readonly category: string;
  readonly unit: string | null;
  readonly default_point_value: string | null;
  readonly points_approval: string;
  readonly requires_evidence: boolean;
  readonly min_duration_minutes: number | null;
  readonly max_duration_minutes: number | null;
  readonly status: string;
  readonly catalog_version: number;
  readonly created_at: string | Date;
}

/** Raw `activity_submissions` row. */
export interface ActivitySubmissionRow {
  readonly id: string;
  readonly team_id: string;
  readonly season_id: string | null;
  readonly membership_id: string;
  readonly activity_type_id: string;
  readonly submitter_user_id: string;
  readonly status: string;
  readonly performed_on: string;
  readonly duration_minutes: number | null;
  readonly quantity: string | null;
  readonly notes: string | null;
  readonly review_note: string | null;
  readonly record_version: number;
  readonly submitted_at: string | Date | null;
  readonly submitted_by: string | null;
  readonly reviewed_at: string | Date | null;
  readonly reviewed_by: string | null;
  readonly withdrawn_at: string | Date | null;
  readonly created_by: string | null;
  readonly created_at: string | Date;
  readonly updated_at: string | Date;
  readonly deleted_at: string | Date | null;
}

/** Raw `activity_evidence` row (carries the private storage reference). */
export interface ActivityEvidenceRow {
  readonly id: string;
  readonly submission_id: string;
  readonly kind: string;
  readonly storage_reference: string;
  readonly content_type: string | null;
  readonly byte_size: string | null;
  readonly description: string | null;
  readonly scan_status: string;
  readonly created_by: string | null;
  readonly created_at: string | Date;
}

/** Raw `activity_buddies` row. */
export interface ActivityBuddyRow {
  readonly id: string;
  readonly submission_id: string;
  readonly membership_id: string;
  readonly status: string;
  readonly responded_at: string | Date | null;
  readonly responded_by: string | null;
  readonly created_at: string | Date;
}

export interface CountRow {
  readonly count: number;
}

/** Grouped evidence count per submission for a batched N+1-free list assembly. */
export interface EvidenceCountRow {
  readonly submission_id: string;
  readonly count: number;
}

export interface IdRow {
  readonly id: string;
}
