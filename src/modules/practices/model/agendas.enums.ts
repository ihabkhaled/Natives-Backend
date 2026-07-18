/**
 * Enumerations for practice agendas and the reusable drill catalog (module 203).
 * A drill definition is a reusable library entry; a practice agenda is the ordered,
 * per-session plan (blocks → stations, plus participant groups) and the execution
 * record of what actually happened. Every enum ships a `*_VALUES` array so DTO
 * validation and pure guards reference the canonical set without re-listing
 * literals. Values are the stable strings persisted in the database.
 */

/**
 * Coarse classification of a reusable drill. Free of any hard-coded scoring — the
 * category only organizes the catalog for coaches; points are never derived here.
 */
export enum DrillCategory {
  Warmup = 'warmup',
  Conditioning = 'conditioning',
  Throwing = 'throwing',
  Cutting = 'cutting',
  Defense = 'defense',
  Offense = 'offense',
  Scrimmage = 'scrimmage',
  SetPlay = 'set_play',
  Cooldown = 'cooldown',
  Other = 'other',
}

export const DRILL_CATEGORY_VALUES: readonly DrillCategory[] =
  Object.values(DrillCategory);

/** Planned physical intensity of a drill or block. */
export enum DrillIntensity {
  Low = 'low',
  Moderate = 'moderate',
  High = 'high',
  Max = 'max',
}

export const DRILL_INTENSITY_VALUES: readonly DrillIntensity[] =
  Object.values(DrillIntensity);

/**
 * Archive state of a catalog drill. Archiving retires a drill from new authoring
 * without deleting it, so blocks that already reference it keep a stable historical
 * link (archive-in-use is safe).
 */
export enum DrillStatus {
  Active = 'active',
  Archived = 'archived',
}

export const DRILL_STATUS_VALUES: readonly DrillStatus[] =
  Object.values(DrillStatus);

/**
 * The lifecycle of a session's agenda. A `Draft` agenda is fully editable; once
 * `Published` its structure is locked (edits refuse) and only execution/completion
 * may be recorded; `Completed` is the post-session review state. Structure is never
 * silently mutated after publish.
 */
export enum AgendaStatus {
  Draft = 'draft',
  Published = 'published',
  Completed = 'completed',
}

export const AGENDA_STATUS_VALUES: readonly AgendaStatus[] =
  Object.values(AgendaStatus);

/** The kind of an ordered agenda block. */
export enum AgendaBlockType {
  Warmup = 'warmup',
  Drill = 'drill',
  WaterBreak = 'water_break',
  Scrimmage = 'scrimmage',
  Conditioning = 'conditioning',
  Cooldown = 'cooldown',
  Discussion = 'discussion',
  Other = 'other',
}

export const AGENDA_BLOCK_TYPE_VALUES: readonly AgendaBlockType[] =
  Object.values(AgendaBlockType);

/**
 * Execution/completion state of a block or station. `Planned` is the default (not
 * yet executed — null-not-zero: never conflated with a measured skip); `Completed`
 * and `Skipped` are recorded during or after the session.
 */
export enum CompletionStatus {
  Planned = 'planned',
  Completed = 'completed',
  Skipped = 'skipped',
}

export const COMPLETION_STATUS_VALUES: readonly CompletionStatus[] =
  Object.values(CompletionStatus);
