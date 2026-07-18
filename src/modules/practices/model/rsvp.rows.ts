/**
 * Raw persistence row shapes (snake_case) returned by the RSVP SQL layer.
 * Repositories map these into vendor-free domain types so implementation files
 * stay free of inline declarations. timestamptz columns arrive as `Date` or ISO
 * string; boolean columns arrive as native booleans from the driver.
 */

export interface RsvpRow {
  readonly id: string;
  readonly session_id: string;
  readonly team_id: string;
  readonly season_id: string | null;
  readonly membership_id: string;
  readonly user_id: string | null;
  readonly status: string;
  readonly reason_category: string | null;
  readonly note: string | null;
  readonly note_visibility: string;
  readonly source: string;
  readonly waitlisted: boolean;
  readonly responded_at: string | Date;
  readonly created_by: string | null;
  readonly updated_by: string | null;
  readonly created_at: string | Date;
  readonly updated_at: string | Date;
  readonly version: number;
}

export interface RsvpRevisionRow {
  readonly id: string;
  readonly rsvp_id: string;
  readonly session_id: string;
  readonly membership_id: string;
  readonly from_status: string | null;
  readonly to_status: string;
  readonly reason_category: string | null;
  readonly note: string | null;
  readonly waitlisted: boolean;
  readonly source: string;
  readonly is_override: boolean;
  readonly override_reason: string | null;
  readonly actor_user_id: string | null;
  readonly occurred_at: string | Date;
}

export interface RsvpParticipantRow {
  readonly membership_id: string;
  readonly status: string;
  readonly waitlisted: boolean;
  readonly source: string;
  readonly responded_at: string | Date;
}

export interface RsvpCountsRow {
  readonly going: number;
  readonly waitlisted: number;
  readonly not_going: number;
  readonly maybe: number;
  readonly no_response: number;
}

export interface RsvpTotalRow {
  readonly count: number;
}

export interface MembershipRefRow {
  readonly id: string;
  readonly user_id: string | null;
}
