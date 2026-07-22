import type { ErrorMessageKey } from '@core/errors/error.types';

// --- Ports -------------------------------------------------------------------

/** The app-owned port a provider access adapter fulfils. */
export const VIDEO_ACCESS_PORT = Symbol('VIDEO_ACCESS_PORT');

// --- API surface -------------------------------------------------------------

export const ANALYSIS_API_TAG = 'analysis';
export const VIDEO_SOURCES_ROUTE = 'teams/:teamId/video-sources';
export const VIDEO_CLIPS_ROUTE = 'teams/:teamId/video-clips';

export const TEAM_ID_PARAM = 'teamId';
export const SOURCE_ID_PARAM = 'sourceId';
export const CLIP_ID_PARAM = 'clipId';

export const SOURCE_ITEM_ROUTE = ':sourceId';
export const SOURCE_ACCESS_ROUTE = ':sourceId/access';
export const CLIP_ITEM_ROUTE = ':clipId';
export const CLIP_TRANSITION_ROUTE = ':clipId/transition';
export const CLIP_REVISION_ROUTE = ':clipId/revision';
export const CLIP_ACKNOWLEDGEMENT_ROUTE = ':clipId/acknowledgement';
export const CLIP_IMPORT_ROUTE = 'import';

// --- Pagination --------------------------------------------------------------

export const LIST_DEFAULT_LIMIT = 20;
export const LIST_MAX_LIMIT = 100;
export const LIST_MIN_LIMIT = 1;
export const LIST_DEFAULT_OFFSET = 0;

// --- Field bounds ------------------------------------------------------------

export const TITLE_MIN_LENGTH = 2;
export const TITLE_MAX_LENGTH = 160;
export const COMMENT_MAX_LENGTH = 4000;
export const EXTERNAL_REF_MIN_LENGTH = 3;
export const EXTERNAL_REF_MAX_LENGTH = 400;
export const TAG_MIN_LENGTH = 2;
export const TAG_MAX_LENGTH = 40;
export const TAGS_MAX_COUNT = 12;
export const PLAYERS_MAX_COUNT = 28;
export const IMPORT_MAX_ROWS = 500;
export const ALIAS_MAX_LENGTH = 200;
export const REASON_MIN_LENGTH = 3;
export const REASON_MAX_LENGTH = 500;
export const RECORD_VERSION_MIN = 1;

export const SECOND_MIN = 0;
export const SECOND_MAX = 86_400;
export const SYNC_OFFSET_MIN = -86_400;
export const SYNC_OFFSET_MAX = 86_400;
export const DURATION_MIN = 1;

/** The revision a brand-new clip starts at. */
export const FIRST_REVISION = 1;

// --- Signed provider access --------------------------------------------------

export const VIDEO_ACCESS_TTL_SECONDS = 900;
export const VIDEO_ACCESS_ALGORITHM = 'sha256';
export const VIDEO_ACCESS_METHOD = 'GET';
export const MILLISECONDS_PER_SECOND = 1000;

// --- Error messages ----------------------------------------------------------

export const VIDEO_SOURCE_NOT_FOUND_MESSAGE =
  'The requested video source was not found';
export const VIDEO_SOURCE_NOT_FOUND_MESSAGE_KEY: ErrorMessageKey =
  'errors.analysis.videoSourceNotFound';
export const VIDEO_CLIP_NOT_FOUND_MESSAGE =
  'The requested analysis clip was not found';
export const VIDEO_CLIP_NOT_FOUND_MESSAGE_KEY: ErrorMessageKey =
  'errors.analysis.videoClipNotFound';
export const ANALYSIS_SCOPE_NOT_FOUND_MESSAGE =
  'The team, season, or match scope was not found';
export const ANALYSIS_SCOPE_NOT_FOUND_MESSAGE_KEY: ErrorMessageKey =
  'errors.analysis.scopeNotFound';
export const CLIP_TIMESTAMP_MESSAGE =
  'The clip timestamps do not fit the recording';
export const CLIP_TIMESTAMP_MESSAGE_KEY: ErrorMessageKey =
  'errors.analysis.clipTimestamp';
export const CLIP_INVALID_TRANSITION_MESSAGE =
  'The clip cannot make this review transition';
export const CLIP_INVALID_TRANSITION_MESSAGE_KEY: ErrorMessageKey =
  'errors.analysis.clipInvalidTransition';
export const CLIP_VERSION_CONFLICT_MESSAGE =
  'The clip was modified concurrently';
export const CLIP_VERSION_CONFLICT_MESSAGE_KEY: ErrorMessageKey =
  'errors.analysis.clipVersionConflict';
export const CLIP_IMMUTABLE_MESSAGE =
  'A published clip is immutable; create a revision instead';
export const CLIP_IMMUTABLE_MESSAGE_KEY: ErrorMessageKey =
  'errors.analysis.clipImmutable';
export const VIDEO_ACCESS_DENIED_MESSAGE =
  'The video source access policy does not permit this request';
export const VIDEO_ACCESS_DENIED_MESSAGE_KEY: ErrorMessageKey =
  'errors.analysis.videoAccessDenied';
export const CLIP_NOT_VISIBLE_MESSAGE =
  'The analysis clip is not visible to you';
export const CLIP_NOT_VISIBLE_MESSAGE_KEY: ErrorMessageKey =
  'errors.analysis.clipNotVisible';
export const ANALYSIS_VALIDATION_MESSAGE =
  'The analysis request failed a domain validation rule';
export const ANALYSIS_VALIDATION_MESSAGE_KEY: ErrorMessageKey =
  'errors.analysis.validation';

// --- Audit actions / resources ----------------------------------------------

export const VIDEO_SOURCE_RESOURCE_TYPE = 'video_source';
export const VIDEO_CLIP_RESOURCE_TYPE = 'video_clip';
export const ANALYSIS_AGGREGATE = 'video_clip';

export const VIDEO_SOURCE_REGISTERED_ACTION = 'analysis.source.registered';
export const VIDEO_ACCESS_GRANTED_ACTION = 'analysis.source.access_granted';
export const VIDEO_CLIP_CREATED_ACTION = 'analysis.clip.created';
export const VIDEO_CLIP_TRANSITIONED_ACTION = 'analysis.clip.transitioned';
export const VIDEO_CLIP_REVISED_ACTION = 'analysis.clip.revised';
export const VIDEO_CLIP_ACKNOWLEDGED_ACTION = 'analysis.clip.acknowledged';
export const VIDEO_CLIP_IMPORTED_ACTION = 'analysis.clip.imported';

// --- Domain events -----------------------------------------------------------

export const ANALYSIS_EVENT_VERSION = 1;
export const VIDEO_CLIP_PUBLISHED_EVENT = 'analysis.clip.published.v1';
export const VIDEO_CLIP_REVISED_EVENT = 'analysis.clip.revised.v1';

// --- Static column lists (never SELECT *) ------------------------------------

export const VIDEO_SOURCE_COLUMNS = `"id", "team_id", "season_id", "match_id",
  "provider", "external_ref", "title", "duration_seconds",
  "sync_offset_seconds", "processing_status", "access_policy",
  "record_version", "registered_by", "created_at", "updated_at"`;

export const VIDEO_CLIP_COLUMNS = `"id", "team_id", "season_id", "source_id",
  "match_id", "point_id", "event_id", "start_second", "end_second",
  "play_context", "clip_type", "title", "comment", "visibility", "status",
  "revision", "supersedes_clip_id", "import_reference", "record_version",
  "author_user_id", "reviewed_by", "reviewed_at", "published_by",
  "published_at", "archived_at", "created_at", "updated_at"`;

export const CLIP_PLAYER_COLUMNS = `"id", "clip_id", "membership_id",
  "acknowledged_at", "created_at"`;
