import { ApiProperty, ApiPropertyOptional } from '@core/openapi';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  Type,
  ValidateNested,
} from '@core/validation';

import {
  BODY_MAX_LENGTH,
  BODY_MIN_LENGTH,
  DECISION_TEXT_MAX_LENGTH,
  DECISIONS_MAX,
  KEY_MAX_LENGTH,
  KEY_MIN_LENGTH,
  LIST_DEFAULT_LIMIT,
  LIST_MAX_LIMIT,
  LIST_MIN_LIMIT,
  REASON_MAX_LENGTH,
  REASON_MIN_LENGTH,
  RECORD_VERSION_MIN,
  REFERENCE_MAX_LENGTH,
  TEXT_MAX_LENGTH,
  TITLE_MAX_LENGTH,
  TITLE_MIN_LENGTH,
} from '../../model/governance.constants';
import {
  DisciplineAction,
  DisciplineSeverity,
  DisciplineStatus,
  DisciplineTransition,
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
} from '../../model/governance.enums';

/**
 * The API boundary of governance (UN-602, UN-603). Every DTO class name is
 * module-qualified (`Rule*` / `Discipline*` / `Governance*`) so the generated
 * OpenAPI document can never collapse two shapes into one schema name.
 */

export class GovernancePageQueryDto {
  @ApiPropertyOptional({
    minimum: LIST_MIN_LIMIT,
    maximum: LIST_MAX_LIMIT,
    default: LIST_DEFAULT_LIMIT,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(LIST_MIN_LIMIT)
  @Max(LIST_MAX_LIMIT)
  readonly limit?: number;

  @ApiPropertyOptional({ minimum: 0, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  readonly offset?: number;
}

export class RuleListQueryDto extends GovernancePageQueryDto {
  @ApiPropertyOptional({ enum: RuleCategory })
  @IsOptional()
  @IsEnum(RuleCategory)
  readonly category?: RuleCategory;

  @ApiPropertyOptional({ enum: RuleStatus })
  @IsOptional()
  @IsEnum(RuleStatus)
  readonly status?: RuleStatus;
}

export class DisciplineListQueryDto extends GovernancePageQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  readonly membershipId?: string;

  @ApiPropertyOptional({ enum: DisciplineStatus })
  @IsOptional()
  @IsEnum(DisciplineStatus)
  readonly status?: DisciplineStatus;

  @ApiPropertyOptional({ enum: DisciplineSeverity })
  @IsOptional()
  @IsEnum(DisciplineSeverity)
  readonly severity?: DisciplineSeverity;
}

export class MeetingListQueryDto extends GovernancePageQueryDto {
  @ApiPropertyOptional({ enum: MeetingStatus })
  @IsOptional()
  @IsEnum(MeetingStatus)
  readonly status?: MeetingStatus;

  @ApiPropertyOptional({ enum: MeetingVisibility })
  @IsOptional()
  @IsEnum(MeetingVisibility)
  readonly visibility?: MeetingVisibility;
}

export class TaskListQueryDto extends GovernancePageQueryDto {
  @ApiPropertyOptional({ enum: TaskStatus })
  @IsOptional()
  @IsEnum(TaskStatus)
  readonly status?: TaskStatus;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  readonly ownerMembershipId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  readonly meetingId?: string;
}

// --- Rules -------------------------------------------------------------------

export class PublishRuleDto {
  @ApiProperty({ minLength: KEY_MIN_LENGTH, maxLength: KEY_MAX_LENGTH })
  @IsString()
  @MinLength(KEY_MIN_LENGTH)
  @MaxLength(KEY_MAX_LENGTH)
  declare readonly ruleKey: string;

  @ApiPropertyOptional({ enum: RuleCategory })
  @IsOptional()
  @IsEnum(RuleCategory)
  readonly category?: RuleCategory;

  @ApiProperty({ minLength: TITLE_MIN_LENGTH, maxLength: TITLE_MAX_LENGTH })
  @IsString()
  @MinLength(TITLE_MIN_LENGTH)
  @MaxLength(TITLE_MAX_LENGTH)
  declare readonly title: string;

  @ApiProperty({ minLength: BODY_MIN_LENGTH, maxLength: BODY_MAX_LENGTH })
  @IsString()
  @MinLength(BODY_MIN_LENGTH)
  @MaxLength(BODY_MAX_LENGTH)
  declare readonly body: string;

  @ApiPropertyOptional({ enum: RuleAudience })
  @IsOptional()
  @IsEnum(RuleAudience)
  readonly audience?: RuleAudience;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  readonly requiresAcknowledgement?: boolean;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  readonly ownerUserId?: string | null;
}

export class AcknowledgeRuleDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  declare readonly membershipId: string;
}

export class TeamRuleResponseDto {
  @ApiProperty({ format: 'uuid' })
  declare readonly ruleId: string;

  @ApiProperty({ format: 'uuid' })
  declare readonly teamId: string;

  @ApiProperty()
  declare readonly ruleKey: string;

  @ApiProperty()
  declare readonly version: number;

  @ApiProperty({ enum: RuleCategory })
  declare readonly category: RuleCategory;

  @ApiProperty()
  declare readonly title: string;

  @ApiProperty()
  declare readonly body: string;

  @ApiProperty({ enum: RuleAudience })
  declare readonly audience: RuleAudience;

  @ApiProperty()
  declare readonly requiresAcknowledgement: boolean;

  @ApiProperty({ type: String, format: 'date-time' })
  declare readonly effectiveFrom: Date;

  @ApiProperty({ enum: RuleStatus })
  declare readonly status: RuleStatus;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  declare readonly ownerUserId: string | null;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  declare readonly createdBy: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  declare readonly archivedAt: Date | null;

  @ApiProperty({ type: String, format: 'date-time' })
  declare readonly createdAt: Date;
}

export class ListTeamRulesResponseDto {
  @ApiProperty({ type: [TeamRuleResponseDto] })
  declare readonly items: readonly TeamRuleResponseDto[];

  @ApiProperty()
  declare readonly total: number;

  @ApiProperty()
  declare readonly limit: number;

  @ApiProperty()
  declare readonly offset: number;
}

export class RuleAcknowledgementResponseDto {
  @ApiProperty({ format: 'uuid' })
  declare readonly acknowledgementId: string;

  @ApiProperty({ format: 'uuid' })
  declare readonly ruleId: string;

  @ApiProperty({ format: 'uuid' })
  declare readonly membershipId: string;

  @ApiProperty()
  declare readonly ruleVersion: number;

  @ApiProperty({ type: String, format: 'date-time' })
  declare readonly acknowledgedAt: Date;
}

// --- Discipline --------------------------------------------------------------

export class OpenDisciplineCaseDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  declare readonly membershipId: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  readonly ruleId?: string | null;

  @ApiPropertyOptional({ enum: DisciplineSeverity })
  @IsOptional()
  @IsEnum(DisciplineSeverity)
  readonly severity?: DisciplineSeverity;

  @ApiProperty({ minLength: REASON_MIN_LENGTH, maxLength: REASON_MAX_LENGTH })
  @IsString()
  @MinLength(REASON_MIN_LENGTH)
  @MaxLength(REASON_MAX_LENGTH)
  declare readonly factSummary: string;

  @ApiPropertyOptional({ maxLength: REFERENCE_MAX_LENGTH, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(REFERENCE_MAX_LENGTH)
  readonly evidenceReference?: string | null;

  @ApiPropertyOptional({ maxLength: TEXT_MAX_LENGTH, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(TEXT_MAX_LENGTH)
  readonly privateNotes?: string | null;

  @ApiPropertyOptional({ enum: DisciplineAction })
  @IsOptional()
  @IsEnum(DisciplineAction)
  readonly action?: DisciplineAction;

  @ApiPropertyOptional({ format: 'date', nullable: true })
  @IsOptional()
  @IsDateString()
  readonly dueDate?: string | null;
}

export class TransitionDisciplineCaseDto {
  @ApiProperty({ enum: DisciplineTransition })
  @IsEnum(DisciplineTransition)
  declare readonly transition: DisciplineTransition;

  @ApiPropertyOptional({ maxLength: REASON_MAX_LENGTH, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(REASON_MAX_LENGTH)
  readonly note?: string | null;

  @ApiPropertyOptional({ enum: DisciplineAction, nullable: true })
  @IsOptional()
  @IsEnum(DisciplineAction)
  readonly action?: DisciplineAction | null;

  @ApiProperty({ minimum: RECORD_VERSION_MIN })
  @IsInt()
  @Min(RECORD_VERSION_MIN)
  declare readonly expectedRecordVersion: number;
}

export class DisciplineCaseResponseDto {
  @ApiProperty({ format: 'uuid' })
  declare readonly caseId: string;

  @ApiProperty({ format: 'uuid' })
  declare readonly teamId: string;

  @ApiProperty({ format: 'uuid' })
  declare readonly membershipId: string;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  declare readonly ruleId: string | null;

  @ApiProperty({ enum: DisciplineSeverity })
  declare readonly severity: DisciplineSeverity;

  @ApiProperty()
  declare readonly factSummary: string;

  @ApiProperty({ type: String, nullable: true })
  declare readonly evidenceReference: string | null;

  @ApiProperty({ type: String, nullable: true })
  declare readonly privateNotes: string | null;

  @ApiProperty({ enum: DisciplineStatus })
  declare readonly status: DisciplineStatus;

  @ApiProperty({ enum: DisciplineAction })
  declare readonly action: DisciplineAction;

  @ApiProperty({ type: String, format: 'date', nullable: true })
  declare readonly dueDate: string | null;

  @ApiProperty({ type: String, nullable: true })
  declare readonly memberResponse: string | null;

  @ApiProperty({ type: String, nullable: true })
  declare readonly appealReason: string | null;

  @ApiProperty({ type: String, nullable: true })
  declare readonly resolution: string | null;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  declare readonly openedBy: string | null;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  declare readonly reviewedBy: string | null;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  declare readonly resolvedBy: string | null;

  @ApiProperty()
  declare readonly recordVersion: number;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  declare readonly resolvedAt: Date | null;

  @ApiProperty({ type: String, format: 'date-time' })
  declare readonly retentionExpiresAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  declare readonly createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  declare readonly updatedAt: Date;
}

export class ListDisciplineCasesResponseDto {
  @ApiProperty({ type: [DisciplineCaseResponseDto] })
  declare readonly items: readonly DisciplineCaseResponseDto[];

  @ApiProperty()
  declare readonly total: number;

  @ApiProperty()
  declare readonly limit: number;

  @ApiProperty()
  declare readonly offset: number;
}

// --- Positions / appointments ------------------------------------------------

export class CreatePositionDto {
  @ApiProperty({ minLength: KEY_MIN_LENGTH, maxLength: KEY_MAX_LENGTH })
  @IsString()
  @MinLength(KEY_MIN_LENGTH)
  @MaxLength(KEY_MAX_LENGTH)
  declare readonly positionKey: string;

  @ApiProperty({ minLength: TITLE_MIN_LENGTH, maxLength: TITLE_MAX_LENGTH })
  @IsString()
  @MinLength(TITLE_MIN_LENGTH)
  @MaxLength(TITLE_MAX_LENGTH)
  declare readonly title: string;

  @ApiPropertyOptional({ maxLength: TEXT_MAX_LENGTH, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(TEXT_MAX_LENGTH)
  readonly responsibilities?: string | null;
}

export class RecordAppointmentDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  declare readonly membershipId: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  readonly acting?: boolean;

  @ApiProperty({ format: 'date' })
  @IsDateString()
  declare readonly startsOn: string;

  @ApiPropertyOptional({ format: 'date', nullable: true })
  @IsOptional()
  @IsDateString()
  readonly endsOn?: string | null;
}

export class GovernancePositionResponseDto {
  @ApiProperty({ format: 'uuid' })
  declare readonly positionId: string;

  @ApiProperty({ format: 'uuid' })
  declare readonly teamId: string;

  @ApiProperty()
  declare readonly positionKey: string;

  @ApiProperty()
  declare readonly title: string;

  @ApiProperty({ type: String, nullable: true })
  declare readonly responsibilities: string | null;

  @ApiProperty({ enum: ['active', 'archived'] })
  declare readonly status: string;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  declare readonly createdBy: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  declare readonly createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  declare readonly updatedAt: Date;
}

export class ListGovernancePositionsResponseDto {
  @ApiProperty({ type: [GovernancePositionResponseDto] })
  declare readonly items: readonly GovernancePositionResponseDto[];

  @ApiProperty()
  declare readonly total: number;

  @ApiProperty()
  declare readonly limit: number;

  @ApiProperty()
  declare readonly offset: number;
}

export class GovernanceAppointmentResponseDto {
  @ApiProperty({ format: 'uuid' })
  declare readonly appointmentId: string;

  @ApiProperty({ format: 'uuid' })
  declare readonly positionId: string;

  @ApiProperty({ format: 'uuid' })
  declare readonly membershipId: string;

  @ApiProperty()
  declare readonly acting: boolean;

  @ApiProperty({ format: 'date' })
  declare readonly startsOn: string;

  @ApiProperty({ type: String, format: 'date', nullable: true })
  declare readonly endsOn: string | null;

  @ApiProperty({ enum: ['active', 'ended'] })
  declare readonly status: string;

  @ApiProperty({ type: String, format: 'date-time' })
  declare readonly createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  declare readonly updatedAt: Date;
}

export class ListGovernanceAppointmentsResponseDto {
  @ApiProperty({ type: [GovernanceAppointmentResponseDto] })
  declare readonly items: readonly GovernanceAppointmentResponseDto[];
}

// --- Meetings ----------------------------------------------------------------

export class MeetingDecisionDto {
  @ApiProperty({ maxLength: DECISION_TEXT_MAX_LENGTH })
  @IsString()
  @MinLength(1)
  @MaxLength(DECISION_TEXT_MAX_LENGTH)
  declare readonly ref: string;

  @ApiProperty({ maxLength: DECISION_TEXT_MAX_LENGTH })
  @IsString()
  @MinLength(1)
  @MaxLength(DECISION_TEXT_MAX_LENGTH)
  declare readonly text: string;
}

export class CreateMeetingDto {
  @ApiProperty({ minLength: TITLE_MIN_LENGTH, maxLength: TITLE_MAX_LENGTH })
  @IsString()
  @MinLength(TITLE_MIN_LENGTH)
  @MaxLength(TITLE_MAX_LENGTH)
  declare readonly title: string;

  @ApiProperty({ format: 'date-time' })
  @IsDateString()
  declare readonly scheduledAt: string;

  @ApiPropertyOptional({ maxLength: BODY_MAX_LENGTH, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(BODY_MAX_LENGTH)
  readonly agenda?: string | null;

  @ApiPropertyOptional({ enum: MeetingVisibility })
  @IsOptional()
  @IsEnum(MeetingVisibility)
  readonly visibility?: MeetingVisibility;

  @ApiPropertyOptional({ enum: MeetingRecurrence })
  @IsOptional()
  @IsEnum(MeetingRecurrence)
  readonly recurrence?: MeetingRecurrence;
}

export class TransitionMeetingDto {
  @ApiProperty({ enum: MeetingTransition })
  @IsEnum(MeetingTransition)
  declare readonly transition: MeetingTransition;

  @ApiPropertyOptional({ maxLength: BODY_MAX_LENGTH, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(BODY_MAX_LENGTH)
  readonly minutes?: string | null;

  @ApiPropertyOptional({ type: [MeetingDecisionDto], maxItems: DECISIONS_MAX })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(DECISIONS_MAX)
  @ValidateNested({ each: true })
  @Type(() => MeetingDecisionDto)
  readonly decisions?: readonly MeetingDecisionDto[];

  @ApiProperty({ minimum: RECORD_VERSION_MIN })
  @IsInt()
  @Min(RECORD_VERSION_MIN)
  declare readonly expectedRecordVersion: number;
}

export class GovernanceMeetingResponseDto {
  @ApiProperty({ format: 'uuid' })
  declare readonly meetingId: string;

  @ApiProperty({ format: 'uuid' })
  declare readonly teamId: string;

  @ApiProperty()
  declare readonly title: string;

  @ApiProperty({ type: String, format: 'date-time' })
  declare readonly scheduledAt: Date;

  @ApiProperty({ type: String, nullable: true })
  declare readonly agenda: string | null;

  @ApiProperty({ type: String, nullable: true })
  declare readonly minutes: string | null;

  @ApiProperty({ type: [MeetingDecisionDto] })
  declare readonly decisions: readonly MeetingDecisionDto[];

  @ApiProperty({ enum: MeetingVisibility })
  declare readonly visibility: MeetingVisibility;

  @ApiProperty({ enum: MeetingStatus })
  declare readonly status: MeetingStatus;

  @ApiProperty({ enum: MeetingRecurrence })
  declare readonly recurrence: MeetingRecurrence;

  @ApiProperty()
  declare readonly recordVersion: number;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  declare readonly minutesApprovedBy: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  declare readonly minutesApprovedAt: Date | null;

  @ApiProperty({ type: String, format: 'date-time' })
  declare readonly createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  declare readonly updatedAt: Date;
}

export class ListGovernanceMeetingsResponseDto {
  @ApiProperty({ type: [GovernanceMeetingResponseDto] })
  declare readonly items: readonly GovernanceMeetingResponseDto[];

  @ApiProperty()
  declare readonly total: number;

  @ApiProperty()
  declare readonly limit: number;

  @ApiProperty()
  declare readonly offset: number;
}

// --- Tasks -------------------------------------------------------------------

export class CreateTaskDto {
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  readonly meetingId?: string | null;

  @ApiProperty({ minLength: TITLE_MIN_LENGTH, maxLength: TITLE_MAX_LENGTH })
  @IsString()
  @MinLength(TITLE_MIN_LENGTH)
  @MaxLength(TITLE_MAX_LENGTH)
  declare readonly title: string;

  @ApiPropertyOptional({ maxLength: TEXT_MAX_LENGTH, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(TEXT_MAX_LENGTH)
  readonly description?: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  readonly ownerMembershipId?: string | null;

  @ApiPropertyOptional({ format: 'date', nullable: true })
  @IsOptional()
  @IsDateString()
  readonly dueDate?: string | null;

  @ApiPropertyOptional({ enum: TaskPriority })
  @IsOptional()
  @IsEnum(TaskPriority)
  readonly priority?: TaskPriority;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  readonly dependsOnTaskId?: string | null;
}

export class TransitionTaskDto {
  @ApiProperty({ enum: TaskTransition })
  @IsEnum(TaskTransition)
  declare readonly transition: TaskTransition;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  readonly ownerMembershipId?: string | null;

  @ApiProperty({ minimum: RECORD_VERSION_MIN })
  @IsInt()
  @Min(RECORD_VERSION_MIN)
  declare readonly expectedRecordVersion: number;
}

export class GovernanceTaskResponseDto {
  @ApiProperty({ format: 'uuid' })
  declare readonly taskId: string;

  @ApiProperty({ format: 'uuid' })
  declare readonly teamId: string;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  declare readonly meetingId: string | null;

  @ApiProperty()
  declare readonly title: string;

  @ApiProperty({ type: String, nullable: true })
  declare readonly description: string | null;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  declare readonly ownerMembershipId: string | null;

  @ApiProperty({ type: String, format: 'date', nullable: true })
  declare readonly dueDate: string | null;

  @ApiProperty({ enum: TaskPriority })
  declare readonly priority: TaskPriority;

  @ApiProperty({ enum: TaskStatus })
  declare readonly status: TaskStatus;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  declare readonly dependsOnTaskId: string | null;

  @ApiProperty()
  declare readonly recordVersion: number;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  declare readonly completedAt: Date | null;

  @ApiProperty({ type: String, format: 'date-time' })
  declare readonly createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  declare readonly updatedAt: Date;
}

export class ListGovernanceTasksResponseDto {
  @ApiProperty({ type: [GovernanceTaskResponseDto] })
  declare readonly items: readonly GovernanceTaskResponseDto[];

  @ApiProperty()
  declare readonly total: number;

  @ApiProperty()
  declare readonly limit: number;

  @ApiProperty()
  declare readonly offset: number;
}
