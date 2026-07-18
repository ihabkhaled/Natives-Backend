import type { ErrorMessageKey } from '@core/errors/error.types';

// --- Routes (team + session scoped, mounted under PRACTICES_ROUTE = 'teams') ---
export const DRILLS_ROUTE = ':teamId/drills';
export const DRILL_BY_ID_ROUTE = ':teamId/drills/:drillId';
export const DRILL_ARCHIVE_ROUTE = ':teamId/drills/:drillId/archive';

export const AGENDA_ROUTE = ':teamId/practice-sessions/:sessionId/agenda';
export const AGENDA_PLAN_ROUTE =
  ':teamId/practice-sessions/:sessionId/agenda/plan';
export const AGENDA_COPY_ROUTE =
  ':teamId/practice-sessions/:sessionId/agenda/copy';
export const AGENDA_PUBLISH_ROUTE =
  ':teamId/practice-sessions/:sessionId/agenda/publish';
export const AGENDA_COMPLETE_ROUTE =
  ':teamId/practice-sessions/:sessionId/agenda/complete';

export const AGENDA_BLOCKS_ROUTE =
  ':teamId/practice-sessions/:sessionId/agenda/blocks';
export const AGENDA_BLOCK_REORDER_ROUTE =
  ':teamId/practice-sessions/:sessionId/agenda/blocks/reorder';
export const AGENDA_BLOCK_BY_ID_ROUTE =
  ':teamId/practice-sessions/:sessionId/agenda/blocks/:blockId';
export const AGENDA_BLOCK_COMPLETE_ROUTE =
  ':teamId/practice-sessions/:sessionId/agenda/blocks/:blockId/complete';
export const AGENDA_STATIONS_ROUTE =
  ':teamId/practice-sessions/:sessionId/agenda/blocks/:blockId/stations';
export const AGENDA_STATION_BY_ID_ROUTE =
  ':teamId/practice-sessions/:sessionId/agenda/blocks/:blockId/stations/:stationId';

export const AGENDA_GROUPS_ROUTE =
  ':teamId/practice-sessions/:sessionId/agenda/groups';
export const AGENDA_GROUP_BY_ID_ROUTE =
  ':teamId/practice-sessions/:sessionId/agenda/groups/:groupId';
export const AGENDA_GROUP_MEMBERS_ROUTE =
  ':teamId/practice-sessions/:sessionId/agenda/groups/:groupId/members';
export const AGENDA_GROUP_MEMBER_BY_ID_ROUTE =
  ':teamId/practice-sessions/:sessionId/agenda/groups/:groupId/members/:membershipId';

// --- Route param names -------------------------------------------------------
export const DRILL_ID_PARAM = 'drillId';
export const BLOCK_ID_PARAM = 'blockId';
export const STATION_ID_PARAM = 'stationId';
export const GROUP_ID_PARAM = 'groupId';

// --- Field bounds ------------------------------------------------------------
export const DRILL_NAME_MIN_LENGTH = 1;
export const DRILL_NAME_MAX_LENGTH = 120;
export const OBJECTIVE_MAX_LENGTH = 500;
export const INSTRUCTIONS_MAX_LENGTH = 4000;
export const SAFETY_MAX_LENGTH = 1000;
export const MEDIA_URL_MAX_LENGTH = 1000;
export const EQUIPMENT_MAX_COUNT = 30;
export const EQUIPMENT_ITEM_MAX_LENGTH = 80;
export const SKILL_TAGS_MAX_COUNT = 30;
export const SKILL_TAG_MAX_LENGTH = 60;

export const BLOCK_TITLE_MIN_LENGTH = 1;
export const BLOCK_TITLE_MAX_LENGTH = 120;
export const STATION_NAME_MIN_LENGTH = 1;
export const STATION_NAME_MAX_LENGTH = 120;
export const GROUP_NAME_MIN_LENGTH = 1;
export const GROUP_NAME_MAX_LENGTH = 80;
export const GROUP_COLOR_MAX_LENGTH = 32;
export const THEME_MAX_LENGTH = 200;
export const TARGET_MAX_LENGTH = 200;
export const AGENDA_NOTES_MAX_LENGTH = 2000;
export const COACH_NOTES_MAX_LENGTH = 2000;

export const DURATION_MINUTES_MIN = 1;
export const DURATION_MINUTES_MAX = 600;
export const OFFSET_MINUTES_MIN = 0;
export const OFFSET_MINUTES_MAX = 1440;
export const REPETITIONS_MIN = 1;
export const REPETITIONS_MAX = 1000;

export const REORDER_BLOCKS_MIN_COUNT = 1;
export const REORDER_BLOCKS_MAX_COUNT = 100;
export const ASSIGN_MEMBERS_MIN_COUNT = 1;
export const ASSIGN_MEMBERS_MAX_COUNT = 100;

// --- Bounded read/scan limits ------------------------------------------------
export const AGENDA_BLOCK_SCAN_LIMIT = 100;
export const AGENDA_STATION_SCAN_LIMIT = 400;
export const AGENDA_GROUP_SCAN_LIMIT = 50;
export const AGENDA_GROUP_MEMBER_SCAN_LIMIT = 500;

// --- Domain event envelope ---------------------------------------------------
export const AGENDA_AGGREGATE_TYPE = 'practice_agenda';
export const AGENDA_EVENT_VERSION = 1;
export const AGENDA_PUBLISHED_EVENT = 'practice.agenda.published';
export const AGENDA_COMPLETED_EVENT = 'practice.agenda.completed';

// --- Audit action names ------------------------------------------------------
export const DRILL_CREATED_ACTION = 'practice.drillCreated';
export const DRILL_UPDATED_ACTION = 'practice.drillUpdated';
export const DRILL_ARCHIVED_ACTION = 'practice.drillArchived';
export const AGENDA_CREATED_ACTION = 'practice.agendaCreated';
export const AGENDA_COPIED_ACTION = 'practice.agendaCopied';
export const AGENDA_PUBLISHED_ACTION = 'practice.agendaPublished';
export const AGENDA_COMPLETED_ACTION = 'practice.agendaCompleted';
export const BLOCK_ADDED_ACTION = 'practice.agendaBlockAdded';
export const BLOCK_UPDATED_ACTION = 'practice.agendaBlockUpdated';
export const BLOCK_REORDERED_ACTION = 'practice.agendaBlocksReordered';
export const BLOCK_COMPLETED_ACTION = 'practice.agendaBlockCompleted';
export const BLOCK_REMOVED_ACTION = 'practice.agendaBlockRemoved';
export const STATION_ADDED_ACTION = 'practice.agendaStationAdded';
export const STATION_REMOVED_ACTION = 'practice.agendaStationRemoved';
export const GROUP_CREATED_ACTION = 'practice.agendaGroupCreated';
export const GROUP_MEMBER_ASSIGNED_ACTION =
  'practice.agendaGroupMemberAssigned';
export const GROUP_MEMBER_REMOVED_ACTION = 'practice.agendaGroupMemberRemoved';
export const GROUP_REMOVED_ACTION = 'practice.agendaGroupRemoved';

export const DRILL_RESOURCE_TYPE = 'drill_definition';
export const AGENDA_RESOURCE_TYPE = 'practice_agenda';
export const BLOCK_RESOURCE_TYPE = 'practice_agenda_block';
export const STATION_RESOURCE_TYPE = 'practice_agenda_station';
export const GROUP_RESOURCE_TYPE = 'practice_agenda_group';

// --- Static read-column lists (never interpolate caller input) ----------------
export const DRILL_COLUMNS = `"id", "team_id", "season_id", "name", "category",
  "objective", "instructions", "equipment", "intensity",
  "default_duration_minutes", "skill_tags", "safety_notes", "media_url",
  "status", "created_by", "updated_by", "created_at", "updated_at", "version"`;

export const AGENDA_COLUMNS = `"id", "session_id", "team_id", "season_id",
  "status", "theme", "notes", "published_at", "published_by", "completed_at",
  "completed_by", "created_by", "updated_by", "created_at", "updated_at",
  "version"`;

export const BLOCK_COLUMNS = `"id", "agenda_id", "session_id", "team_id",
  "drill_id", "position", "title", "block_type", "offset_minutes",
  "duration_minutes", "intensity", "repetitions", "target", "completion_status",
  "completed_at", "completed_by", "notes", "coach_notes", "created_by",
  "updated_by", "created_at", "updated_at", "version"`;

export const STATION_COLUMNS = `"id", "block_id", "agenda_id", "team_id",
  "drill_id", "group_id", "coach_membership_id", "position", "name",
  "repetitions", "target", "notes", "completion_status", "created_at",
  "updated_at", "version"`;

export const GROUP_COLUMNS = `"id", "agenda_id", "team_id", "name", "color",
  "coach_membership_id", "position", "notes", "created_at", "updated_at",
  "version"`;

export const GROUP_MEMBER_COLUMNS = `"id", "group_id", "agenda_id",
  "membership_id", "created_at"`;

// --- Error messages & keys ---------------------------------------------------
export const DRILL_NOT_FOUND_MESSAGE =
  'The drill was not found in this team scope';
export const DRILL_NOT_FOUND_MESSAGE_KEY: ErrorMessageKey =
  'errors.practices.drillNotFound';

export const DRILL_NAME_CONFLICT_MESSAGE =
  'An active drill with this name already exists in the team';
export const DRILL_NAME_CONFLICT_MESSAGE_KEY: ErrorMessageKey =
  'errors.practices.drillNameConflict';

export const AGENDA_NOT_FOUND_MESSAGE =
  'No agenda has been created for this session yet';
export const AGENDA_NOT_FOUND_MESSAGE_KEY: ErrorMessageKey =
  'errors.practices.agendaNotFound';

export const AGENDA_BLOCK_NOT_FOUND_MESSAGE =
  'The agenda block was not found in this session';
export const AGENDA_BLOCK_NOT_FOUND_MESSAGE_KEY: ErrorMessageKey =
  'errors.practices.agendaBlockNotFound';

export const AGENDA_GROUP_NOT_FOUND_MESSAGE =
  'The agenda group was not found in this session';
export const AGENDA_GROUP_NOT_FOUND_MESSAGE_KEY: ErrorMessageKey =
  'errors.practices.agendaGroupNotFound';

export const AGENDA_LOCKED_MESSAGE =
  'The agenda is published; its structure can no longer be edited';
export const AGENDA_LOCKED_MESSAGE_KEY: ErrorMessageKey =
  'errors.practices.agendaLocked';

export const INVALID_AGENDA_TRANSITION_MESSAGE =
  'The agenda publish/complete action is not allowed from its current state';
export const INVALID_AGENDA_TRANSITION_MESSAGE_KEY: ErrorMessageKey =
  'errors.practices.invalidAgendaTransition';

export const INVALID_REORDER_MESSAGE =
  'The reorder request must list exactly the current agenda blocks once each';
export const INVALID_REORDER_MESSAGE_KEY: ErrorMessageKey =
  'errors.practices.invalidReorder';
