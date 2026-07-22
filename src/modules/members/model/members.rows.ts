/**
 * Raw persistence row shapes (snake_case) returned by the members SQL layer.
 * Repositories map these into vendor-free domain types so implementation files
 * stay free of inline declarations. numeric columns arrive as strings from the
 * pg driver; date-only columns are read as ISO strings via `to_char`.
 */

export interface MembershipRow {
  readonly id: string;
  readonly team_id: string;
  readonly season_id: string | null;
  readonly user_id: string | null;
  readonly status: string;
  readonly status_reason: string | null;
  readonly status_effective_at: string | Date;
  readonly joined_at: string | Date | null;
  readonly left_at: string | Date | null;
  readonly anonymized_at: string | Date | null;
  readonly created_by: string | null;
  readonly updated_by: string | null;
  readonly created_at: string | Date;
  readonly updated_at: string | Date;
  readonly deleted_at: string | Date | null;
  readonly version: number;
}

export interface MemberProfileRow {
  readonly id: string;
  readonly membership_id: string;
  readonly team_id: string;
  readonly full_name: string;
  readonly preferred_name: string | null;
  readonly full_name_ar: string | null;
  readonly nickname: string | null;
  readonly email: string | null;
  readonly phone: string | null;
  readonly gender: string | null;
  readonly division: string | null;
  readonly positions: readonly string[];
  readonly jersey_number: number | null;
  readonly jersey_size: string | null;
  readonly height_cm: string | null;
  readonly weight_kg: string | null;
  readonly date_of_birth: string | null;
  readonly avatar_media_id: string | null;
  readonly created_by: string | null;
  readonly updated_by: string | null;
  readonly created_at: string | Date;
  readonly updated_at: string | Date;
  readonly version: number;
}

export interface StatusEventRow {
  readonly id: string;
  readonly membership_id: string;
  readonly from_status: string | null;
  readonly to_status: string;
  readonly reason: string | null;
  readonly actor_user_id: string | null;
  readonly effective_at: string | Date;
  readonly occurred_at: string | Date;
}

export interface AliasRow {
  readonly id: string;
  readonly membership_id: string;
  readonly team_id: string;
  readonly alias: string;
  readonly normalized_alias: string;
  readonly source: string;
  readonly created_by: string | null;
  readonly created_at: string | Date;
  readonly deleted_at: string | Date | null;
}

export interface MediaAssetRow {
  readonly id: string;
  readonly team_id: string;
  readonly membership_id: string;
  readonly purpose: string;
  readonly storage_key: string;
  readonly content_type: string;
  readonly byte_size: string | number;
  readonly width: number | null;
  readonly height: number | null;
  readonly scan_status: string;
  readonly created_by: string | null;
  readonly created_at: string | Date;
  readonly deleted_at: string | Date | null;
}

export interface JerseyRow {
  readonly membership_id: string;
  readonly jersey_number: number;
}

/**
 * One coarse directory row. The profile join is a LEFT JOIN so account-only
 * memberships (no player profile yet) still appear: profile fields are null and
 * `display_name` falls back to the linked account's display name or email.
 */
export interface DirectoryRow {
  readonly membership_id: string;
  readonly team_id: string;
  readonly status: string;
  readonly display_name: string | null;
  readonly nickname: string | null;
  readonly jersey_number: number | null;
  readonly positions: readonly string[] | null;
  readonly has_avatar: boolean;
}

export interface CountRow {
  readonly count: number;
}

export interface IdRow {
  readonly id: string;
}

/**
 * One membership of the calling user joined to its team and (when resolvable)
 * season labels. Season columns are nullable: a team-level membership in a team
 * with no season carries no season context.
 */
export interface MembershipContextRow {
  readonly membership_id: string;
  readonly team_id: string;
  readonly team_slug: string;
  readonly team_name: string;
  readonly season_id: string | null;
  readonly season_slug: string | null;
  readonly season_name: string | null;
  readonly status: string;
  readonly joined_at: string | Date | null;
}

/** The profile fields the completeness projection scores, plus its freshness. */
export interface ProfileCompletenessRow {
  readonly preferred_name: string | null;
  readonly email: string | null;
  readonly phone: string | null;
  readonly gender: string | null;
  readonly date_of_birth: string | null;
  readonly jersey_number: number | null;
  readonly positions: readonly string[];
  readonly avatar_media_id: string | null;
  readonly updated_at: string | Date;
}

/** A bounded roster aggregate: how many rows, and the boundary instant. */
export interface MemberSignalCountRow {
  readonly count: number;
  readonly boundary_at: string | Date | null;
}
