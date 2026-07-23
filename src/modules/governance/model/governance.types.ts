import type {
  AppointmentStatus,
  DisciplineAction,
  DisciplineSeverity,
  DisciplineStatus,
  DisciplineTransition,
  GovernancePositionStatus,
  MeetingRecurrence,
  MeetingStatus,
  MeetingTransition,
  MeetingVisibility,
  RuleAudience,
  RuleCategory,
  RuleStatus,
  TaskPriority,
  TaskStatus,
  TaskTransition,
} from './governance.enums';

// --- Pagination --------------------------------------------------------------

export interface PageRequest {
  readonly limit: number;
  readonly offset: number;
}

export interface PagedResult<TItem> {
  readonly items: readonly TItem[];
  readonly total: number;
  readonly limit: number;
  readonly offset: number;
}

// --- Rules -------------------------------------------------------------------

export interface TeamRule {
  readonly ruleId: string;
  readonly teamId: string;
  readonly ruleKey: string;
  readonly version: number;
  readonly category: RuleCategory;
  readonly title: string;
  readonly body: string;
  readonly audience: RuleAudience;
  readonly requiresAcknowledgement: boolean;
  readonly effectiveFrom: Date;
  readonly status: RuleStatus;
  readonly ownerUserId: string | null;
  readonly createdBy: string | null;
  readonly archivedAt: Date | null;
  readonly createdAt: Date;
}

export interface NewTeamRule {
  readonly id: string;
  readonly teamId: string;
  readonly ruleKey: string;
  readonly version: number;
  readonly category: RuleCategory;
  readonly title: string;
  readonly body: string;
  readonly audience: RuleAudience;
  readonly requiresAcknowledgement: boolean;
  readonly effectiveFrom: Date;
  readonly ownerUserId: string | null;
  readonly createdBy: string;
}

export interface RuleContent {
  readonly ruleKey: string;
  readonly category: RuleCategory;
  readonly title: string;
  readonly body: string;
  readonly audience: RuleAudience;
  readonly requiresAcknowledgement: boolean;
  readonly ownerUserId: string | null;
}

export interface RuleContentInput {
  readonly ruleKey: string;
  readonly category?: RuleCategory | null;
  readonly title: string;
  readonly body: string;
  readonly audience?: RuleAudience | null;
  readonly requiresAcknowledgement?: boolean | null;
  readonly ownerUserId?: string | null;
}

export interface PublishRuleCommand {
  readonly content: RuleContent;
}

export interface RuleAcknowledgement {
  readonly acknowledgementId: string;
  readonly teamId: string;
  readonly ruleId: string;
  readonly membershipId: string;
  readonly ruleVersion: number;
  readonly acknowledgedAt: Date;
}

export interface NewRuleAcknowledgement {
  readonly id: string;
  readonly teamId: string;
  readonly ruleId: string;
  readonly membershipId: string;
  readonly ruleVersion: number;
  readonly now: Date;
}

export type TeamRulePage = PagedResult<TeamRule>;

/**
 * The caller's own acknowledgement state of ONE rule version row (BE-2).
 * `myAcknowledgedVersion` is non-null exactly when the caller's active
 * membership acknowledged this version; it then equals the row's version.
 */
export interface RuleAckState {
  readonly myAcknowledgedVersion: number | null;
  readonly myAcknowledgedAt: Date | null;
}

export type TeamRuleWithAckState = TeamRule & RuleAckState;

export type TeamRuleWithAckPage = PagedResult<TeamRuleWithAckState>;

export type RuleAcknowledgementPage = PagedResult<RuleAcknowledgement>;

/** A membership resolved with its owning user, for self-scope enforcement. */
export interface GovernanceMembershipRef {
  readonly membershipId: string;
  readonly userId: string;
}

export interface RuleListFilter {
  readonly category: RuleCategory | null;
  readonly status: RuleStatus | null;
}

export interface RuleListFilterInput {
  readonly category?: RuleCategory | null;
  readonly status?: RuleStatus | null;
}

// --- Discipline --------------------------------------------------------------

export interface DisciplineCase {
  readonly caseId: string;
  readonly teamId: string;
  readonly membershipId: string;
  readonly ruleId: string | null;
  readonly severity: DisciplineSeverity;
  readonly factSummary: string;
  readonly evidenceReference: string | null;
  readonly privateNotes: string | null;
  readonly status: DisciplineStatus;
  readonly action: DisciplineAction;
  readonly dueDate: string | null;
  readonly memberResponse: string | null;
  readonly appealReason: string | null;
  readonly resolution: string | null;
  readonly openedBy: string | null;
  readonly reviewedBy: string | null;
  readonly resolvedBy: string | null;
  readonly recordVersion: number;
  readonly respondedAt: Date | null;
  readonly reviewedAt: Date | null;
  readonly appealedAt: Date | null;
  readonly resolvedAt: Date | null;
  readonly expungedAt: Date | null;
  readonly retentionExpiresAt: Date;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface NewDisciplineCase {
  readonly id: string;
  readonly teamId: string;
  readonly membershipId: string;
  readonly ruleId: string | null;
  readonly severity: DisciplineSeverity;
  readonly factSummary: string;
  readonly evidenceReference: string | null;
  readonly privateNotes: string | null;
  readonly action: DisciplineAction;
  readonly dueDate: string | null;
  readonly openedBy: string;
  readonly retentionExpiresAt: Date;
  readonly now: Date;
}

export interface DisciplineContent {
  readonly membershipId: string;
  readonly ruleId: string | null;
  readonly severity: DisciplineSeverity;
  readonly factSummary: string;
  readonly evidenceReference: string | null;
  readonly privateNotes: string | null;
  readonly action: DisciplineAction;
  readonly dueDate: string | null;
}

export interface DisciplineContentInput {
  readonly membershipId: string;
  readonly ruleId?: string | null;
  readonly severity?: DisciplineSeverity | null;
  readonly factSummary: string;
  readonly evidenceReference?: string | null;
  readonly privateNotes?: string | null;
  readonly action?: DisciplineAction | null;
  readonly dueDate?: string | null;
}

export interface OpenDisciplineCommand {
  readonly content: DisciplineContent;
}

export interface DisciplineTransitionCommand {
  readonly transition: DisciplineTransition;
  readonly note: string | null;
  readonly action: DisciplineAction | null;
  readonly expectedRecordVersion: number;
}

export interface DisciplineStatusChange {
  readonly id: string;
  readonly teamId: string;
  readonly expectedRecordVersion: number;
  readonly toStatus: DisciplineStatus;
  readonly action: DisciplineAction;
  readonly memberResponse: string | null;
  readonly appealReason: string | null;
  readonly resolution: string | null;
  readonly reviewedBy: string | null;
  readonly resolvedBy: string | null;
  readonly respondedAt: Date | null;
  readonly reviewedAt: Date | null;
  readonly appealedAt: Date | null;
  readonly resolvedAt: Date | null;
  readonly expungedAt: Date | null;
  readonly now: Date;
}

export type DisciplineCasePage = PagedResult<DisciplineCase>;

export interface DisciplineListFilter {
  readonly membershipId: string | null;
  readonly status: DisciplineStatus | null;
  readonly severity: DisciplineSeverity | null;
}

export interface DisciplineListFilterInput {
  readonly membershipId?: string | null;
  readonly status?: DisciplineStatus | null;
  readonly severity?: DisciplineSeverity | null;
}

/** Whether the caller may act as a reviewer, for separation-of-duties. */
export interface DisciplineActor {
  readonly userId: string;
  readonly canReview: boolean;
}

// --- Governance positions, appointments --------------------------------------

export interface GovernancePosition {
  readonly positionId: string;
  readonly teamId: string;
  readonly positionKey: string;
  readonly title: string;
  readonly responsibilities: string | null;
  readonly status: GovernancePositionStatus;
  readonly createdBy: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface NewGovernancePosition {
  readonly id: string;
  readonly teamId: string;
  readonly positionKey: string;
  readonly title: string;
  readonly responsibilities: string | null;
  readonly createdBy: string;
  readonly now: Date;
}

export interface PositionContent {
  readonly positionKey: string;
  readonly title: string;
  readonly responsibilities: string | null;
}

export interface PositionContentInput {
  readonly positionKey: string;
  readonly title: string;
  readonly responsibilities?: string | null;
}

export interface CreatePositionCommand {
  readonly content: PositionContent;
}

export interface GovernanceAppointment {
  readonly appointmentId: string;
  readonly teamId: string;
  readonly positionId: string;
  readonly membershipId: string;
  readonly acting: boolean;
  readonly startsOn: string;
  readonly endsOn: string | null;
  readonly status: AppointmentStatus;
  readonly createdBy: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface NewGovernanceAppointment {
  readonly id: string;
  readonly teamId: string;
  readonly positionId: string;
  readonly membershipId: string;
  readonly acting: boolean;
  readonly startsOn: string;
  readonly endsOn: string | null;
  readonly createdBy: string;
  readonly now: Date;
}

export interface AppointmentContent {
  readonly membershipId: string;
  readonly acting: boolean;
  readonly startsOn: string;
  readonly endsOn: string | null;
}

export interface AppointmentContentInput {
  readonly membershipId: string;
  readonly acting?: boolean | null;
  readonly startsOn: string;
  readonly endsOn?: string | null;
}

export interface RecordAppointmentCommand {
  readonly content: AppointmentContent;
}

export type GovernancePositionPage = PagedResult<GovernancePosition>;

/** A position's appointment history (already bounded by the repository). */
export interface GovernanceAppointmentList {
  readonly items: readonly GovernanceAppointment[];
}

// --- Meetings ----------------------------------------------------------------

export interface MeetingDecision {
  readonly ref: string;
  readonly text: string;
}

export interface GovernanceMeeting {
  readonly meetingId: string;
  readonly teamId: string;
  readonly title: string;
  readonly scheduledAt: Date;
  readonly agenda: string | null;
  readonly minutes: string | null;
  readonly decisions: readonly MeetingDecision[];
  readonly visibility: MeetingVisibility;
  readonly status: MeetingStatus;
  readonly recurrence: MeetingRecurrence;
  readonly recordVersion: number;
  readonly createdBy: string | null;
  readonly minutesApprovedBy: string | null;
  readonly minutesApprovedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface NewGovernanceMeeting {
  readonly id: string;
  readonly teamId: string;
  readonly title: string;
  readonly scheduledAt: string;
  readonly agenda: string | null;
  readonly visibility: MeetingVisibility;
  readonly recurrence: MeetingRecurrence;
  readonly createdBy: string;
  readonly now: Date;
}

export interface MeetingContent {
  readonly title: string;
  readonly scheduledAt: string;
  readonly agenda: string | null;
  readonly visibility: MeetingVisibility;
  readonly recurrence: MeetingRecurrence;
}

export interface MeetingContentInput {
  readonly title: string;
  readonly scheduledAt: string;
  readonly agenda?: string | null;
  readonly visibility?: MeetingVisibility | null;
  readonly recurrence?: MeetingRecurrence | null;
}

export interface CreateMeetingCommand {
  readonly content: MeetingContent;
}

export interface MeetingTransitionCommand {
  readonly transition: MeetingTransition;
  readonly minutes: string | null;
  readonly decisions: readonly MeetingDecision[];
  readonly expectedRecordVersion: number;
}

export interface MeetingStatusChange {
  readonly id: string;
  readonly teamId: string;
  readonly expectedRecordVersion: number;
  readonly toStatus: MeetingStatus;
  readonly minutes: string | null;
  readonly decisions: readonly MeetingDecision[];
  readonly minutesApprovedBy: string | null;
  readonly minutesApprovedAt: Date | null;
  readonly now: Date;
}

export type GovernanceMeetingPage = PagedResult<GovernanceMeeting>;

export interface MeetingListFilter {
  readonly status: MeetingStatus | null;
  readonly visibility: MeetingVisibility | null;
}

export interface MeetingListFilterInput {
  readonly status?: MeetingStatus | null;
  readonly visibility?: MeetingVisibility | null;
}

// --- Tasks -------------------------------------------------------------------

export interface GovernanceTask {
  readonly taskId: string;
  readonly teamId: string;
  readonly meetingId: string | null;
  readonly title: string;
  readonly description: string | null;
  readonly ownerMembershipId: string | null;
  readonly dueDate: string | null;
  readonly priority: TaskPriority;
  readonly status: TaskStatus;
  readonly dependsOnTaskId: string | null;
  readonly recordVersion: number;
  readonly createdBy: string | null;
  readonly completedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface NewGovernanceTask {
  readonly id: string;
  readonly teamId: string;
  readonly meetingId: string | null;
  readonly title: string;
  readonly description: string | null;
  readonly ownerMembershipId: string | null;
  readonly dueDate: string | null;
  readonly priority: TaskPriority;
  readonly dependsOnTaskId: string | null;
  readonly createdBy: string;
  readonly now: Date;
}

export interface TaskContent {
  readonly meetingId: string | null;
  readonly title: string;
  readonly description: string | null;
  readonly ownerMembershipId: string | null;
  readonly dueDate: string | null;
  readonly priority: TaskPriority;
  readonly dependsOnTaskId: string | null;
}

export interface TaskContentInput {
  readonly meetingId?: string | null;
  readonly title: string;
  readonly description?: string | null;
  readonly ownerMembershipId?: string | null;
  readonly dueDate?: string | null;
  readonly priority?: TaskPriority | null;
  readonly dependsOnTaskId?: string | null;
}

export interface CreateTaskCommand {
  readonly content: TaskContent;
}

export interface TaskTransitionCommand {
  readonly transition: TaskTransition;
  readonly ownerMembershipId: string | null;
  readonly expectedRecordVersion: number;
}

export interface TaskStatusChange {
  readonly id: string;
  readonly teamId: string;
  readonly expectedRecordVersion: number;
  readonly toStatus: TaskStatus;
  readonly ownerMembershipId: string | null;
  readonly completedAt: Date | null;
  readonly now: Date;
}

export type GovernanceTaskPage = PagedResult<GovernanceTask>;

export interface TaskListFilter {
  readonly status: TaskStatus | null;
  readonly ownerMembershipId: string | null;
  readonly meetingId: string | null;
}

export interface TaskListFilterInput {
  readonly status?: TaskStatus | null;
  readonly ownerMembershipId?: string | null;
  readonly meetingId?: string | null;
}

/** The viewer facts the meeting visibility policy decides on. */
export interface GovernanceViewer {
  readonly canReadBoard: boolean;
  readonly canManage: boolean;
}
