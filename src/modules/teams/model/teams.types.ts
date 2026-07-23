import type { SettingValueState } from './setting-values.enums';
import type { TypedSettingValue } from './setting-values.types';
import type {
  CatalogName,
  ResourceStatus,
  SeasonStatus,
  SettingKey,
  TeamStatus,
} from './teams.enums';

/** A JSON document persisted in a jsonb column (settings value, catalog metadata). */
export type JsonObject = Readonly<Record<string, unknown>>;

// --- Aggregates (domain view types returned to the transport layer) ----------

export interface Team {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly locale: string;
  readonly timezone: string;
  readonly primaryColor: string | null;
  readonly logoMediaKey: string | null;
  readonly status: TeamStatus;
  /** Soft-removal instant; null while the team is present. Never hard-deleted. */
  readonly deletedAt: Date | null;
  readonly createdBy: string | null;
  readonly updatedBy: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly version: number;
}

export interface Season {
  readonly id: string;
  readonly teamId: string;
  readonly slug: string;
  readonly name: string;
  /** Date-only, ISO `YYYY-MM-DD` (inclusive lower bound). */
  readonly startsOn: string;
  /** Date-only, ISO `YYYY-MM-DD` (inclusive upper bound). */
  readonly endsOn: string;
  readonly status: SeasonStatus;
  readonly createdBy: string | null;
  readonly updatedBy: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly version: number;
}

export interface Venue {
  readonly id: string;
  readonly teamId: string;
  readonly name: string;
  readonly address: string | null;
  readonly timezone: string;
  readonly latitude: number | null;
  readonly longitude: number | null;
  readonly status: ResourceStatus;
  readonly createdBy: string | null;
  readonly updatedBy: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly version: number;
}

export interface CatalogEntry {
  readonly id: string;
  readonly teamId: string;
  readonly catalog: CatalogName;
  readonly key: string;
  readonly label: string;
  readonly sortOrder: number;
  readonly metadata: JsonObject;
  readonly referenceCount: number;
  readonly status: ResourceStatus;
  readonly createdBy: string | null;
  readonly updatedBy: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly version: number;
}

export interface SettingVersion {
  readonly id: string;
  readonly teamId: string;
  readonly settingKey: SettingKey;
  readonly effectiveFrom: Date;
  /** New writes persist normalized typed values; legacy rows keep raw jsonb. */
  readonly value: TypedSettingValue | JsonObject;
  readonly note: string | null;
  readonly createdBy: string | null;
  readonly createdAt: Date;
}

/** A stored version plus its read-time classification (P2, D4). */
export interface ClassifiedSettingVersion extends SettingVersion {
  readonly valueState: SettingValueState;
}

/**
 * One resolved setting in an effective snapshot. `value` is null when the key
 * is not configured OR when the in-effect row is legacy (D4 — the snapshot
 * never serves an unvalidated document); `valueState` is null only for
 * not-configured keys. `issues` surfaces cross-setting gaps (D3).
 */
export interface EffectiveSetting {
  readonly settingKey: SettingKey;
  readonly effectiveFrom: Date | null;
  readonly value: TypedSettingValue | null;
  readonly valueState: SettingValueState | null;
  readonly issues: readonly string[];
}

export interface SettingsSnapshot {
  readonly teamId: string;
  readonly asOf: Date;
  readonly settings: readonly EffectiveSetting[];
}

// --- Paginated list results --------------------------------------------------

export interface PageRequest {
  readonly limit: number;
  readonly offset: number;
}

export interface ListTeamsResult {
  readonly items: readonly Team[];
  readonly total: number;
  readonly limit: number;
  readonly offset: number;
}

export interface ListSeasonsResult {
  readonly items: readonly Season[];
  readonly total: number;
  readonly limit: number;
  readonly offset: number;
}

export interface ListVenuesResult {
  readonly items: readonly Venue[];
  readonly total: number;
  readonly limit: number;
  readonly offset: number;
}

export interface ListCatalogEntriesResult {
  readonly items: readonly CatalogEntry[];
  readonly total: number;
  readonly limit: number;
  readonly offset: number;
}

export interface ListSettingVersionsResult {
  readonly items: readonly SettingVersion[];
  readonly total: number;
  readonly limit: number;
  readonly offset: number;
}

/** The versions page served to clients: every row carries its `valueState`. */
export interface ListClassifiedSettingVersionsResult {
  readonly items: readonly ClassifiedSettingVersion[];
  readonly total: number;
  readonly limit: number;
  readonly offset: number;
}

// --- Application command models (built by the controller from DTOs) ----------

export interface CreateTeamCommand {
  readonly slug: string;
  readonly name: string;
  readonly locale: string | null;
  readonly timezone: string | null;
  readonly primaryColor: string | null;
  readonly logoMediaKey: string | null;
}

export interface UpdateTeamCommand {
  readonly name: string;
  readonly locale: string | null;
  readonly timezone: string | null;
  readonly primaryColor: string | null;
  readonly logoMediaKey: string | null;
  readonly expectedVersion: number;
}

export interface CreateSeasonCommand {
  readonly slug: string;
  readonly name: string;
  readonly startsOn: string;
  readonly endsOn: string;
  readonly status: SeasonStatus | null;
}

export interface UpdateSeasonCommand {
  readonly slug: string;
  readonly name: string;
  readonly startsOn: string;
  readonly endsOn: string;
  readonly status: SeasonStatus;
  readonly expectedVersion: number;
}

export interface CreateVenueCommand {
  readonly name: string;
  readonly address: string | null;
  readonly timezone: string | null;
  readonly latitude: number | null;
  readonly longitude: number | null;
}

export interface UpdateVenueCommand {
  readonly name: string;
  readonly address: string | null;
  readonly timezone: string | null;
  readonly latitude: number | null;
  readonly longitude: number | null;
  readonly status: ResourceStatus;
  readonly expectedVersion: number;
}

export interface CreateCatalogEntryCommand {
  readonly catalog: CatalogName;
  readonly key: string;
  readonly label: string;
  readonly sortOrder: number | null;
  readonly metadata: JsonObject | null;
}

export interface CreateSettingVersionCommand {
  readonly settingKey: SettingKey;
  readonly effectiveFrom: string;
  readonly value: JsonObject;
  /** Mandatory change reason (P2, D6). */
  readonly note: string;
  /**
   * Optimistic head guard (P2, D8): the id of the newest version the caller saw
   * for this key, `null` for "no versions yet", `undefined` to skip the check.
   */
  readonly expectedHeadVersionId?: string | null | undefined;
}

export interface CatalogListQuery {
  readonly catalog: CatalogName;
  readonly limit: number;
  readonly offset: number;
}

export interface SettingVersionsQuery {
  readonly settingKey: SettingKey;
  readonly limit: number;
  readonly offset: number;
}

// --- Persistence write models ------------------------------------------------

export interface NewTeam {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly locale: string;
  readonly timezone: string;
  readonly primaryColor: string | null;
  readonly logoMediaKey: string | null;
  readonly createdBy: string | null;
  readonly now: Date;
}

export interface TeamUpdate {
  readonly id: string;
  readonly name: string;
  readonly locale: string;
  readonly timezone: string;
  readonly primaryColor: string | null;
  readonly logoMediaKey: string | null;
  readonly updatedBy: string | null;
  readonly expectedVersion: number;
  readonly now: Date;
}

export interface NewSeason {
  readonly id: string;
  readonly teamId: string;
  readonly slug: string;
  readonly name: string;
  readonly startsOn: string;
  readonly endsOn: string;
  readonly status: SeasonStatus;
  readonly createdBy: string | null;
  readonly now: Date;
}

export interface SeasonUpdate {
  readonly id: string;
  readonly teamId: string;
  readonly slug: string;
  readonly name: string;
  readonly startsOn: string;
  readonly endsOn: string;
  readonly status: SeasonStatus;
  readonly updatedBy: string | null;
  readonly expectedVersion: number;
  readonly now: Date;
}

export interface NewVenue {
  readonly id: string;
  readonly teamId: string;
  readonly name: string;
  readonly address: string | null;
  readonly timezone: string;
  readonly latitude: number | null;
  readonly longitude: number | null;
  readonly createdBy: string | null;
  readonly now: Date;
}

export interface VenueUpdate {
  readonly id: string;
  readonly teamId: string;
  readonly name: string;
  readonly address: string | null;
  readonly timezone: string;
  readonly latitude: number | null;
  readonly longitude: number | null;
  readonly status: ResourceStatus;
  readonly updatedBy: string | null;
  readonly expectedVersion: number;
  readonly now: Date;
}

export interface NewCatalogEntry {
  readonly id: string;
  readonly teamId: string;
  readonly catalog: CatalogName;
  readonly key: string;
  readonly label: string;
  readonly sortOrder: number;
  readonly metadata: JsonObject;
  readonly createdBy: string | null;
  readonly now: Date;
}

export interface NewSettingVersion {
  readonly id: string;
  readonly teamId: string;
  readonly settingKey: SettingKey;
  readonly effectiveFrom: Date;
  /** The policy's normalized typed output, never the raw request body (P2). */
  readonly value: TypedSettingValue | JsonObject;
  readonly note: string | null;
  readonly createdBy: string | null;
  readonly now: Date;
}

/**
 * A lifecycle move requested against a team or season aggregate. A null
 * `expectedVersion` means the caller did not supply one (the DELETE shortcut),
 * so no optimistic check is applied; the state machine still gates the move.
 */
export interface TransitionCommand {
  readonly expectedVersion: number | null;
}

/** The write applied by a team lifecycle transition. */
export interface TeamStatusChange {
  readonly id: string;
  readonly status: TeamStatus;
  readonly updatedBy: string | null;
  readonly expectedVersion: number | null;
  readonly now: Date;
}

/** The write applied by a season lifecycle transition. */
export interface SeasonStatusChange {
  readonly id: string;
  readonly teamId: string;
  readonly status: SeasonStatus;
  readonly updatedBy: string | null;
  readonly expectedVersion: number | null;
  readonly now: Date;
}

/** The write applied by a soft removal (never a hard delete). */
export interface TeamRemoval {
  readonly id: string;
  readonly updatedBy: string | null;
  readonly expectedVersion: number | null;
  readonly now: Date;
}

export interface NewAuditEvent {
  readonly id: string;
  readonly eventType: string;
  readonly actorUserId: string | null;
  readonly context: Readonly<Record<string, string | number | boolean | null>>;
  readonly occurredAt: Date;
}

/** A season's identity + date range used by the pure overlap policy. */
export interface SeasonDateRange {
  readonly id: string;
  readonly startsOn: string;
  readonly endsOn: string;
}
