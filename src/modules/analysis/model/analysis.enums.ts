/**
 * Enumerations for match video analysis (UN-505). Every enum ships a `*_VALUES`
 * tuple so mappers can validate a raw database string against the closed set.
 *
 * The clip lifecycle is deliberately append-only: a `published` clip is the
 * record players were shown and is never edited in place — correcting it creates
 * a successor revision and moves the original to `revised`.
 */

/** Where the recording lives. The application never proxies the bytes. */
export enum VideoProvider {
  YouTube = 'youtube',
  Vimeo = 'vimeo',
  Drive = 'drive',
  ObjectStorage = 'object_storage',
  External = 'external',
}

export const VIDEO_PROVIDER_VALUES: readonly VideoProvider[] =
  Object.values(VideoProvider);

/** Whether the source is usable yet. `pending` is unknown, never "broken". */
export enum VideoProcessingStatus {
  Pending = 'pending',
  Ready = 'ready',
  Failed = 'failed',
}

export const VIDEO_PROCESSING_STATUS_VALUES: readonly VideoProcessingStatus[] =
  Object.values(VideoProcessingStatus);

/**
 * Who may be handed a signed provider URL for the source. `restricted` means
 * nobody but an explicit analysis manager, whatever their team permissions.
 */
export enum VideoAccessPolicy {
  Coaches = 'coaches',
  Team = 'team',
  Restricted = 'restricted',
}

export const VIDEO_ACCESS_POLICY_VALUES: readonly VideoAccessPolicy[] =
  Object.values(VideoAccessPolicy);

/** Which side of the disc the observation is about. */
export enum ClipPlayContext {
  Offense = 'offense',
  Defense = 'defense',
  Unspecified = 'unspecified',
}

export const CLIP_PLAY_CONTEXT_VALUES: readonly ClipPlayContext[] =
  Object.values(ClipPlayContext);

/** The coaching classification of a clip. */
export enum ClipType {
  Do = 'do',
  Dont = 'dont',
  GoodExample = 'good_example',
  BadExample = 'bad_example',
  Note = 'note',
}

export const CLIP_TYPE_VALUES: readonly ClipType[] = Object.values(ClipType);

/**
 * Who may read the clip's comment. `coach_only` never reaches a player, even a
 * player the clip is tagged on — that is the leak the visibility policy exists
 * to prevent.
 */
export enum ClipVisibility {
  CoachOnly = 'coach_only',
  TaggedPlayers = 'tagged_players',
  Team = 'team',
}

export const CLIP_VISIBILITY_VALUES: readonly ClipVisibility[] =
  Object.values(ClipVisibility);

/** Review lifecycle of a clip. */
export enum ClipStatus {
  Draft = 'draft',
  InReview = 'in_review',
  Published = 'published',
  Revised = 'revised',
  Archived = 'archived',
}

export const CLIP_STATUS_VALUES: readonly ClipStatus[] =
  Object.values(ClipStatus);

/** The lifecycle verbs the transition endpoint accepts. */
export enum ClipTransition {
  Submit = 'submit',
  Publish = 'publish',
  Archive = 'archive',
}

export const CLIP_TRANSITION_VALUES: readonly ClipTransition[] =
  Object.values(ClipTransition);

/** Why a timestamp was rejected. `unknown_duration` is never a rejection. */
export enum ClipTimestampIssue {
  NegativeStart = 'negative_start',
  EndBeforeStart = 'end_before_start',
  BeyondDuration = 'beyond_duration',
}

export const CLIP_TIMESTAMP_ISSUE_VALUES: readonly ClipTimestampIssue[] =
  Object.values(ClipTimestampIssue);

/** The outcome recorded for one row of an audited analysis import. */
export enum ClipImportOutcome {
  Imported = 'imported',
  SkippedDuplicate = 'skipped_duplicate',
  RejectedTimestamp = 'rejected_timestamp',
  RejectedAlias = 'rejected_alias',
}

export const CLIP_IMPORT_OUTCOME_VALUES: readonly ClipImportOutcome[] =
  Object.values(ClipImportOutcome);
