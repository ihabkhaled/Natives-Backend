/** Raw persistence row for an opaque calendar-feed credential. */
export interface CalendarFeedTokenRow {
  readonly id: string;
  readonly token_digest: string;
  readonly user_id: string;
  readonly team_id: string;
  readonly season_id: string | null;
  readonly timezone: string;
  readonly expires_at: string | Date;
  readonly revoked_at: string | Date | null;
  readonly created_at: string | Date;
}

/**
 * Metadata-only projection of a feed credential row. Deliberately excludes
 * `token_digest`: the listing read path never selects credential material.
 */
export interface CalendarFeedMetadataRow {
  readonly id: string;
  readonly season_id: string | null;
  readonly timezone: string;
  readonly expires_at: string | Date;
  readonly created_at: string | Date;
}

export interface CalendarCountRow {
  readonly count: number;
}

export interface CalendarIdRow {
  readonly id: string;
}

export interface ReminderCandidateRow {
  readonly session_id: string;
  readonly session_version: number;
  readonly team_id: string;
  readonly season_id: string | null;
  readonly user_id: string;
  readonly starts_at: string | Date;
  readonly rsvp_cutoff_at: string | Date | null;
  readonly has_responded: boolean;
}
