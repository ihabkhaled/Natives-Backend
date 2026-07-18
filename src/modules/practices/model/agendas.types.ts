import type {
  AgendaBlockType,
  AgendaStatus,
  CompletionStatus,
  DrillCategory,
  DrillIntensity,
  DrillStatus,
} from './agendas.enums';

// --- Drill catalog -----------------------------------------------------------

/** A reusable catalog drill definition. */
export interface Drill {
  readonly id: string;
  readonly teamId: string;
  readonly seasonId: string | null;
  readonly name: string;
  readonly category: DrillCategory;
  readonly objective: string | null;
  readonly instructions: string | null;
  readonly equipment: readonly string[];
  readonly intensity: DrillIntensity;
  readonly defaultDurationMinutes: number | null;
  readonly skillTags: readonly string[];
  readonly safetyNotes: string | null;
  readonly mediaUrl: string | null;
  readonly status: DrillStatus;
  readonly createdBy: string | null;
  readonly updatedBy: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly version: number;
}

/** Fields common to a drill create/update command (already null-normalized). */
export interface DrillFields {
  readonly name: string;
  readonly category: DrillCategory;
  readonly objective: string | null;
  readonly instructions: string | null;
  readonly equipment: readonly string[];
  readonly intensity: DrillIntensity;
  readonly defaultDurationMinutes: number | null;
  readonly skillTags: readonly string[];
  readonly safetyNotes: string | null;
  readonly mediaUrl: string | null;
}

export interface CreateDrillCommand extends DrillFields {
  readonly seasonId: string | null;
}

export interface UpdateDrillCommand extends DrillFields {
  readonly expectedVersion: number | null;
}

/** A fully-built drill insert row (id + time resolved). */
export interface NewDrill extends CreateDrillCommand {
  readonly id: string;
  readonly teamId: string;
  readonly createdBy: string | null;
  readonly now: Date;
}

/** A version-guarded drill update row. */
export interface DrillUpdate extends DrillFields {
  readonly id: string;
  readonly updatedBy: string | null;
  readonly expectedVersion: number | null;
  readonly now: Date;
}

export interface ListDrillsQuery {
  readonly category: DrillCategory | null;
  readonly status: DrillStatus | null;
  readonly skillTag: string | null;
  readonly limit: number;
  readonly offset: number;
}

/** Structural mirror of the list-drills query DTO (kept free of a DTO import). */
export interface ListDrillsQueryInput {
  readonly category?: DrillCategory;
  readonly status?: DrillStatus;
  readonly skillTag?: string;
  readonly limit?: number;
  readonly offset?: number;
}

export interface ListDrillsResult {
  readonly items: readonly Drill[];
  readonly total: number;
  readonly limit: number;
  readonly offset: number;
}

export interface DrillView {
  readonly id: string;
  readonly seasonId: string | null;
  readonly name: string;
  readonly category: DrillCategory;
  readonly objective: string | null;
  readonly instructions: string | null;
  readonly equipment: readonly string[];
  readonly intensity: DrillIntensity;
  readonly defaultDurationMinutes: number | null;
  readonly skillTags: readonly string[];
  readonly safetyNotes: string | null;
  readonly mediaUrl: string | null;
  readonly status: DrillStatus;
  readonly version: number;
}

export interface ListDrillsView {
  readonly items: readonly DrillView[];
  readonly total: number;
  readonly limit: number;
  readonly offset: number;
}

// --- Agenda aggregate --------------------------------------------------------

export interface Agenda {
  readonly id: string;
  readonly sessionId: string;
  readonly teamId: string;
  readonly seasonId: string | null;
  readonly status: AgendaStatus;
  readonly theme: string | null;
  readonly notes: string | null;
  readonly publishedAt: Date | null;
  readonly publishedBy: string | null;
  readonly completedAt: Date | null;
  readonly completedBy: string | null;
  readonly createdBy: string | null;
  readonly updatedBy: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly version: number;
}

export interface CreateAgendaCommand {
  readonly theme: string | null;
  readonly notes: string | null;
}

export interface CopyAgendaCommand {
  readonly sourceSessionId: string;
}

export interface AgendaVersionCommand {
  readonly expectedVersion: number | null;
}

export interface NewAgenda {
  readonly id: string;
  readonly sessionId: string;
  readonly teamId: string;
  readonly seasonId: string | null;
  readonly theme: string | null;
  readonly notes: string | null;
  readonly createdBy: string | null;
  readonly now: Date;
}

export interface AgendaLifecycleWrite {
  readonly id: string;
  readonly actorUserId: string | null;
  readonly expectedVersion: number | null;
  readonly now: Date;
}

// --- Blocks ------------------------------------------------------------------

export interface AgendaBlock {
  readonly id: string;
  readonly agendaId: string;
  readonly sessionId: string;
  readonly teamId: string;
  readonly drillId: string | null;
  readonly position: number;
  readonly title: string;
  readonly blockType: AgendaBlockType;
  readonly offsetMinutes: number | null;
  readonly durationMinutes: number | null;
  readonly intensity: DrillIntensity | null;
  readonly repetitions: number | null;
  readonly target: string | null;
  readonly completionStatus: CompletionStatus;
  readonly completedAt: Date | null;
  readonly completedBy: string | null;
  readonly notes: string | null;
  readonly coachNotes: string | null;
  readonly version: number;
}

export interface BlockFields {
  readonly drillId: string | null;
  readonly title: string;
  readonly blockType: AgendaBlockType;
  readonly offsetMinutes: number | null;
  readonly durationMinutes: number | null;
  readonly intensity: DrillIntensity | null;
  readonly repetitions: number | null;
  readonly target: string | null;
  readonly notes: string | null;
  readonly coachNotes: string | null;
}

export type CreateBlockCommand = BlockFields;

export interface UpdateBlockCommand extends BlockFields {
  readonly expectedVersion: number | null;
}

export interface CompleteBlockCommand {
  readonly completionStatus: CompletionStatus;
  readonly expectedVersion: number | null;
}

export interface ReorderBlocksCommand {
  readonly blockIds: readonly string[];
  readonly expectedVersion: number | null;
}

export interface NewAgendaBlock extends BlockFields {
  readonly id: string;
  readonly agendaId: string;
  readonly sessionId: string;
  readonly teamId: string;
  readonly position: number;
  readonly createdBy: string | null;
  readonly now: Date;
}

export interface AgendaBlockUpdate extends BlockFields {
  readonly id: string;
  readonly updatedBy: string | null;
  readonly expectedVersion: number | null;
  readonly now: Date;
}

export interface BlockCompletionWrite {
  readonly id: string;
  readonly completionStatus: CompletionStatus;
  readonly completedBy: string | null;
  readonly completedAt: Date | null;
  readonly updatedBy: string | null;
  readonly expectedVersion: number | null;
  readonly now: Date;
}

export interface BlockPositionWrite {
  readonly id: string;
  readonly position: number;
}

export interface BlockView {
  readonly id: string;
  readonly drillId: string | null;
  readonly position: number;
  readonly title: string;
  readonly blockType: AgendaBlockType;
  readonly offsetMinutes: number | null;
  readonly durationMinutes: number | null;
  readonly intensity: DrillIntensity | null;
  readonly repetitions: number | null;
  readonly target: string | null;
  readonly completionStatus: CompletionStatus;
  readonly completedAt: Date | null;
  readonly notes: string | null;
  readonly coachNotes: string | null;
  readonly stations: readonly StationView[];
}

// --- Stations ----------------------------------------------------------------

export interface AgendaStation {
  readonly id: string;
  readonly blockId: string;
  readonly agendaId: string;
  readonly teamId: string;
  readonly drillId: string | null;
  readonly groupId: string | null;
  readonly coachMembershipId: string | null;
  readonly position: number;
  readonly name: string;
  readonly repetitions: number | null;
  readonly target: string | null;
  readonly notes: string | null;
  readonly completionStatus: CompletionStatus;
  readonly version: number;
}

export interface CreateStationCommand {
  readonly drillId: string | null;
  readonly groupId: string | null;
  readonly coachMembershipId: string | null;
  readonly name: string;
  readonly repetitions: number | null;
  readonly target: string | null;
  readonly notes: string | null;
}

export interface NewAgendaStation extends CreateStationCommand {
  readonly id: string;
  readonly blockId: string;
  readonly agendaId: string;
  readonly teamId: string;
  readonly position: number;
  readonly now: Date;
}

export interface StationView {
  readonly id: string;
  readonly blockId: string;
  readonly drillId: string | null;
  readonly groupId: string | null;
  readonly coachMembershipId: string | null;
  readonly position: number;
  readonly name: string;
  readonly repetitions: number | null;
  readonly target: string | null;
  readonly notes: string | null;
  readonly completionStatus: CompletionStatus;
}

// --- Groups ------------------------------------------------------------------

export interface AgendaGroup {
  readonly id: string;
  readonly agendaId: string;
  readonly teamId: string;
  readonly name: string;
  readonly color: string | null;
  readonly coachMembershipId: string | null;
  readonly position: number;
  readonly notes: string | null;
  readonly version: number;
}

export interface CreateGroupCommand {
  readonly name: string;
  readonly color: string | null;
  readonly coachMembershipId: string | null;
  readonly notes: string | null;
}

export interface NewAgendaGroup extends CreateGroupCommand {
  readonly id: string;
  readonly agendaId: string;
  readonly teamId: string;
  readonly position: number;
  readonly now: Date;
}

export interface AgendaGroupMember {
  readonly id: string;
  readonly groupId: string;
  readonly agendaId: string;
  readonly membershipId: string;
}

export interface NewAgendaGroupMember {
  readonly id: string;
  readonly groupId: string;
  readonly agendaId: string;
  readonly membershipId: string;
  readonly now: Date;
}

export interface AssignMembersCommand {
  readonly membershipIds: readonly string[];
}

export interface GroupMemberView {
  readonly membershipId: string;
}

export interface GroupView {
  readonly id: string;
  readonly name: string;
  readonly color: string | null;
  readonly coachMembershipId: string | null;
  readonly position: number;
  readonly notes: string | null;
  readonly members: readonly GroupMemberView[];
}

// --- Agenda tree views -------------------------------------------------------

export interface AgendaSummaryView {
  readonly sessionId: string;
  readonly agendaId: string;
  readonly status: AgendaStatus;
  readonly theme: string | null;
  readonly notes: string | null;
  readonly publishedAt: Date | null;
  readonly completedAt: Date | null;
  readonly version: number;
}

export interface AgendaView {
  readonly sessionId: string;
  readonly agendaId: string | null;
  readonly status: AgendaStatus | null;
  readonly theme: string | null;
  readonly notes: string | null;
  readonly publishedAt: Date | null;
  readonly completedAt: Date | null;
  readonly version: number | null;
  readonly blocks: readonly BlockView[];
  readonly groups: readonly GroupView[];
}

export interface AgendaTreeParts {
  readonly blocks: readonly AgendaBlock[];
  readonly stations: readonly AgendaStation[];
  readonly groups: readonly AgendaGroup[];
  readonly members: readonly AgendaGroupMember[];
}
