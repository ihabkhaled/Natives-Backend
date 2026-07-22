/** Raw `video_sources` row as returned by the database driver. */
export interface VideoSourceRow {
  readonly id: string;
  readonly team_id: string;
  readonly season_id: string;
  readonly match_id: string | null;
  readonly provider: string;
  readonly external_ref: string;
  readonly title: string;
  readonly duration_seconds: number | string | null;
  readonly sync_offset_seconds: number | string;
  readonly processing_status: string;
  readonly access_policy: string;
  readonly record_version: number | string;
  readonly registered_by: string | null;
  readonly created_at: string | Date;
  readonly updated_at: string | Date;
}

/** Raw `video_clips` row. */
export interface VideoClipRow {
  readonly id: string;
  readonly team_id: string;
  readonly season_id: string;
  readonly source_id: string;
  readonly match_id: string | null;
  readonly point_id: string | null;
  readonly event_id: string | null;
  readonly start_second: number | string;
  readonly end_second: number | string | null;
  readonly play_context: string;
  readonly clip_type: string;
  readonly title: string;
  readonly comment: string | null;
  readonly visibility: string;
  readonly status: string;
  readonly revision: number | string;
  readonly supersedes_clip_id: string | null;
  readonly import_reference: string | null;
  readonly record_version: number | string;
  readonly author_user_id: string | null;
  readonly reviewed_by: string | null;
  readonly reviewed_at: string | Date | null;
  readonly published_by: string | null;
  readonly published_at: string | Date | null;
  readonly archived_at: string | Date | null;
  readonly created_at: string | Date;
  readonly updated_at: string | Date;
}

/** Raw `video_clip_players` row. */
export interface ClipPlayerRow {
  readonly id: string;
  readonly clip_id: string;
  readonly membership_id: string;
  readonly acknowledged_at: string | Date | null;
  readonly created_at: string | Date;
}

/** Raw tag row of a clip. */
export interface ClipTagRow {
  readonly clip_id: string;
  readonly tag: string;
}

/** The resolved team/season scope of an analysis operation. */
export interface AnalysisScopeRow {
  readonly season_id: string;
}

/** A membership id resolved from an alias or a direct reference. */
export interface AnalysisMembershipRow {
  readonly membership_id: string;
}

/** A generic count row. */
export interface AnalysisCountRow {
  readonly count: number | string;
}

/** A single-column id probe row for existence checks. */
export interface AnalysisIdRow {
  readonly id: string;
}
