import type { JsonObject } from './teams.types';

/**
 * Raw persistence row shapes (snake_case) returned by the teams SQL layer.
 * Repositories map these into vendor-free domain types so implementation files
 * stay free of inline declarations. Date-only columns are read as ISO strings
 * (via `to_char`); timestamptz columns arrive as `Date` or ISO string.
 */

export interface TeamRow {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly locale: string;
  readonly timezone: string;
  readonly primary_color: string | null;
  readonly logo_media_key: string | null;
  readonly status: string;
  readonly created_by: string | null;
  readonly updated_by: string | null;
  readonly created_at: string | Date;
  readonly updated_at: string | Date;
  readonly version: number;
}

export interface SeasonRow {
  readonly id: string;
  readonly team_id: string;
  readonly slug: string;
  readonly name: string;
  readonly starts_on: string;
  readonly ends_on: string;
  readonly status: string;
  readonly created_by: string | null;
  readonly updated_by: string | null;
  readonly created_at: string | Date;
  readonly updated_at: string | Date;
  readonly version: number;
}

export interface SeasonRangeRow {
  readonly id: string;
  readonly starts_on: string;
  readonly ends_on: string;
}

export interface VenueRow {
  readonly id: string;
  readonly team_id: string;
  readonly name: string;
  readonly address: string | null;
  readonly timezone: string;
  readonly latitude: string | null;
  readonly longitude: string | null;
  readonly status: string;
  readonly created_by: string | null;
  readonly updated_by: string | null;
  readonly created_at: string | Date;
  readonly updated_at: string | Date;
  readonly version: number;
}

export interface CatalogEntryRow {
  readonly id: string;
  readonly team_id: string;
  readonly catalog: string;
  readonly key: string;
  readonly label: string;
  readonly sort_order: number;
  readonly metadata: JsonObject;
  readonly reference_count: number;
  readonly status: string;
  readonly created_by: string | null;
  readonly updated_by: string | null;
  readonly created_at: string | Date;
  readonly updated_at: string | Date;
  readonly version: number;
}

export interface SettingVersionRow {
  readonly id: string;
  readonly team_id: string;
  readonly setting_key: string;
  readonly effective_from: string | Date;
  readonly value: JsonObject;
  readonly note: string | null;
  readonly created_by: string | null;
  readonly created_at: string | Date;
}

export interface CountRow {
  readonly count: number;
}

export interface IdRow {
  readonly id: string;
}
