/** Raw `tryout_events` row. */
export interface TryoutEventRow {
  readonly id: string;
  readonly team_id: string;
  readonly season_id: string;
  readonly venue_id: string | null;
  readonly name: string;
  readonly capacity: number | string | null;
  readonly registration_opens_at: string | Date;
  readonly registration_closes_at: string | Date;
  readonly starts_at: string | Date;
  readonly ends_at: string | Date;
  readonly visibility: string;
  readonly consent_version: string;
  readonly eligibility_note: string | null;
  readonly retention_days: number | string;
  readonly status: string;
  readonly record_version: number | string;
  readonly created_by: string | null;
  readonly opened_at: string | Date | null;
  readonly closed_at: string | Date | null;
  readonly completed_at: string | Date | null;
  readonly cancelled_at: string | Date | null;
  readonly created_at: string | Date;
  readonly updated_at: string | Date;
}

/** Raw `tryout_candidates` row. */
export interface CandidateRow {
  readonly id: string;
  readonly team_id: string;
  readonly event_id: string;
  readonly display_name: string;
  readonly identity_hash: string;
  readonly contact_channel: string;
  readonly contact_reference: string | null;
  readonly prior_sport: string | null;
  readonly referral_source: string | null;
  readonly motivation: string | null;
  readonly communication_opt_in: boolean;
  readonly consent_version: string;
  readonly consented_at: string | Date;
  readonly readiness: string;
  readonly restricted_notes: string | null;
  readonly status: string;
  readonly waitlist_position: number | string | null;
  readonly checked_in_at: string | Date | null;
  readonly withdrawn_at: string | Date | null;
  readonly duplicate_of_candidate_id: string | null;
  readonly converted_membership_id: string | null;
  readonly converted_at: string | Date | null;
  readonly retention_expires_at: string | Date;
  readonly anonymized_at: string | Date | null;
  readonly record_version: number | string;
  readonly created_by: string | null;
  readonly created_at: string | Date;
  readonly updated_at: string | Date;
}

/** Raw `tryout_evaluations` row. */
export interface EvaluationRow {
  readonly id: string;
  readonly team_id: string;
  readonly candidate_id: string;
  readonly evaluator_user_id: string;
  readonly criteria_version: string;
  readonly attended: boolean;
  readonly ratings: unknown;
  readonly observations: string | null;
  readonly private_notes: string | null;
  readonly recommendation: string;
  readonly status: string;
  readonly record_version: number | string;
  readonly submitted_at: string | Date | null;
  readonly created_at: string | Date;
  readonly updated_at: string | Date;
}

/** Raw `tryout_decisions` row. */
export interface DecisionRow {
  readonly id: string;
  readonly team_id: string;
  readonly candidate_id: string;
  readonly decision: string;
  readonly reasons: string;
  readonly criteria_version: string;
  readonly evaluator_count: number | string;
  readonly decided_by: string | null;
  readonly decided_at: string | Date;
}

/** Raw `tryout_offers` row. */
export interface OfferRow {
  readonly id: string;
  readonly team_id: string;
  readonly candidate_id: string;
  readonly status: string;
  readonly candidate_message: string | null;
  readonly expires_at: string | Date;
  readonly sent_at: string | Date | null;
  readonly responded_at: string | Date | null;
  readonly record_version: number | string;
  readonly created_by: string | null;
  readonly created_at: string | Date;
  readonly updated_at: string | Date;
}

/** A per-status candidate count for the privacy-safe funnel report. */
export interface FunnelCountRow {
  readonly status: string;
  readonly count: number | string;
}

/** An evaluator's completion counts for the funnel report. */
export interface EvaluatorCompletionRow {
  readonly evaluator_user_id: string;
  readonly submitted: number | string;
  readonly assigned: number | string;
}

/** A generic count row. */
export interface TryoutCountRow {
  readonly count: number | string;
}

/** A single-column id probe row for existence checks. */
export interface TryoutIdRow {
  readonly id: string;
}
