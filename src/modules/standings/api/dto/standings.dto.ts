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
  COUNT_MAX,
  DESCRIPTION_MAX_LENGTH,
  IMPORT_MAX_ROWS,
  LIST_DEFAULT_LIMIT,
  LIST_MAX_LIMIT,
  LIST_MIN_LIMIT,
  NAME_MAX_LENGTH,
  NAME_MIN_LENGTH,
  NOTE_MAX_LENGTH,
  NOTE_MIN_LENGTH,
  PLACE_MAX,
  PLACE_MIN,
  POOL_LABEL_MAX_LENGTH,
  RECORD_VERSION_MIN,
  REFERENCE_MAX_LENGTH,
  RULE_KEY_MAX_LENGTH,
  RULE_KEY_MIN_LENGTH,
  RULE_POINTS_MAX,
  RULE_POINTS_MIN,
  SCORE_MAX,
  SCORE_MIN,
  SPIRIT_MAX,
  SPIRIT_MIN,
} from '../../model/standings.constants';
import {
  AchievementCategory,
  AchievementImportOutcome,
  AchievementSource,
  AchievementStatus,
  AchievementTransition,
  AchievementVisibility,
  StandingEntrantKind,
  StandingQualification,
  StandingRuleStatus,
  StandingSource,
  StandingTieBreak,
} from '../../model/standings.enums';

/**
 * The API boundary of standings, results, achievements, and team history
 * (UN-506). Every DTO class name is module-qualified (`Standing*` /
 * `Achievement*` / `TeamHistory*`) so the generated OpenAPI document can never
 * collapse two shapes into one schema name.
 */

/** Bounded pagination shared by every standings list. */
export class StandingsPageQueryDto {
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

/** Allow-listed facets of the standings table read. */
export class StandingListQueryDto extends StandingsPageQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  readonly competitionId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  readonly stageId?: string;

  @ApiPropertyOptional({ enum: StandingSource })
  @IsOptional()
  @IsEnum(StandingSource)
  readonly source?: StandingSource;
}

/** Allow-listed facets of the achievement and history reads. */
export class AchievementListQueryDto extends StandingsPageQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  readonly seasonId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  readonly competitionId?: string;

  @ApiPropertyOptional({ enum: AchievementCategory })
  @IsOptional()
  @IsEnum(AchievementCategory)
  readonly category?: AchievementCategory;

  @ApiPropertyOptional({ enum: AchievementStatus })
  @IsOptional()
  @IsEnum(AchievementStatus)
  readonly status?: AchievementStatus;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  readonly membershipId?: string;
}

/** Request body publishing the next version of a named standings rule. */
export class CreateStandingsRuleDto {
  @ApiProperty({
    minLength: RULE_KEY_MIN_LENGTH,
    maxLength: RULE_KEY_MAX_LENGTH,
  })
  @IsString()
  @MinLength(RULE_KEY_MIN_LENGTH)
  @MaxLength(RULE_KEY_MAX_LENGTH)
  declare readonly ruleKey: string;

  @ApiProperty({ minLength: NAME_MIN_LENGTH, maxLength: NAME_MAX_LENGTH })
  @IsString()
  @MinLength(NAME_MIN_LENGTH)
  @MaxLength(NAME_MAX_LENGTH)
  declare readonly name: string;

  @ApiPropertyOptional({ minimum: RULE_POINTS_MIN, maximum: RULE_POINTS_MAX })
  @IsOptional()
  @IsInt()
  @Min(RULE_POINTS_MIN)
  @Max(RULE_POINTS_MAX)
  readonly winPoints?: number;

  @ApiPropertyOptional({ minimum: RULE_POINTS_MIN, maximum: RULE_POINTS_MAX })
  @IsOptional()
  @IsInt()
  @Min(RULE_POINTS_MIN)
  @Max(RULE_POINTS_MAX)
  readonly lossPoints?: number;

  @ApiPropertyOptional({ minimum: RULE_POINTS_MIN, maximum: RULE_POINTS_MAX })
  @IsOptional()
  @IsInt()
  @Min(RULE_POINTS_MIN)
  @Max(RULE_POINTS_MAX)
  readonly tiePoints?: number;

  @ApiPropertyOptional({ enum: StandingTieBreak, isArray: true })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(LIST_MIN_LIMIT + 9)
  @IsEnum(StandingTieBreak, { each: true })
  readonly tieBreakOrder?: readonly StandingTieBreak[];
}

/** A named, versioned standings rule. Immutable once published. */
export class StandingsRuleResponseDto {
  @ApiProperty({ format: 'uuid' })
  declare readonly ruleVersionId: string;

  @ApiProperty({ format: 'uuid' })
  declare readonly teamId: string;

  @ApiProperty()
  declare readonly ruleKey: string;

  @ApiProperty()
  declare readonly version: number;

  @ApiProperty()
  declare readonly name: string;

  @ApiProperty()
  declare readonly winPoints: number;

  @ApiProperty()
  declare readonly lossPoints: number;

  @ApiProperty()
  declare readonly tiePoints: number;

  @ApiProperty({ enum: StandingTieBreak, isArray: true })
  declare readonly tieBreakOrder: readonly StandingTieBreak[];

  @ApiProperty({ type: String, format: 'date-time' })
  declare readonly effectiveFrom: Date;

  @ApiProperty({ enum: StandingRuleStatus })
  declare readonly status: StandingRuleStatus;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  declare readonly createdBy: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  declare readonly createdAt: Date;
}

/** A bounded page of standings rule versions. */
export class ListStandingsRulesResponseDto {
  @ApiProperty({ type: [StandingsRuleResponseDto] })
  declare readonly items: readonly StandingsRuleResponseDto[];

  @ApiProperty()
  declare readonly total: number;

  @ApiProperty()
  declare readonly limit: number;

  @ApiProperty()
  declare readonly offset: number;
}

/** Request body deriving a competition's standings from finalized matches. */
export class RecomputeStandingsDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  declare readonly competitionId: string;

  @ApiProperty({
    minLength: RULE_KEY_MIN_LENGTH,
    maxLength: RULE_KEY_MAX_LENGTH,
  })
  @IsString()
  @MinLength(RULE_KEY_MIN_LENGTH)
  @MaxLength(RULE_KEY_MAX_LENGTH)
  declare readonly ruleKey: string;
}

/** Request body recording an external or historical standings row. */
export class RecordManualStandingDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  declare readonly competitionId: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  readonly stageId?: string | null;

  @ApiPropertyOptional({ maxLength: POOL_LABEL_MAX_LENGTH, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(POOL_LABEL_MAX_LENGTH)
  readonly poolLabel?: string | null;

  @ApiProperty({ enum: StandingEntrantKind })
  @IsEnum(StandingEntrantKind)
  declare readonly entrantKind: StandingEntrantKind;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  readonly opponentId?: string | null;

  @ApiProperty({ minimum: 0, maximum: COUNT_MAX })
  @IsInt()
  @Min(0)
  @Max(COUNT_MAX)
  declare readonly played: number;

  @ApiProperty({ minimum: 0, maximum: COUNT_MAX })
  @IsInt()
  @Min(0)
  @Max(COUNT_MAX)
  declare readonly wins: number;

  @ApiProperty({ minimum: 0, maximum: COUNT_MAX })
  @IsInt()
  @Min(0)
  @Max(COUNT_MAX)
  declare readonly losses: number;

  @ApiProperty({ minimum: 0, maximum: COUNT_MAX })
  @IsInt()
  @Min(0)
  @Max(COUNT_MAX)
  declare readonly ties: number;

  @ApiProperty({ minimum: SCORE_MIN, maximum: SCORE_MAX })
  @IsInt()
  @Min(SCORE_MIN)
  @Max(SCORE_MAX)
  declare readonly pointsFor: number;

  @ApiProperty({ minimum: SCORE_MIN, maximum: SCORE_MAX })
  @IsInt()
  @Min(SCORE_MIN)
  @Max(SCORE_MAX)
  declare readonly pointsAgainst: number;

  @ApiPropertyOptional({
    minimum: SPIRIT_MIN,
    maximum: SPIRIT_MAX,
    nullable: true,
    description: 'Null when spirit was not scored — never zero.',
  })
  @IsOptional()
  @Type(() => Number)
  @Min(SPIRIT_MIN)
  @Max(SPIRIT_MAX)
  readonly spiritScore?: number | null;

  @ApiPropertyOptional({
    minimum: PLACE_MIN,
    maximum: PLACE_MAX,
    nullable: true,
  })
  @IsOptional()
  @IsInt()
  @Min(PLACE_MIN)
  @Max(PLACE_MAX)
  readonly finalPlace?: number | null;

  @ApiPropertyOptional({ enum: StandingQualification })
  @IsOptional()
  @IsEnum(StandingQualification)
  readonly qualification?: StandingQualification;

  @ApiPropertyOptional({ maxLength: REFERENCE_MAX_LENGTH, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(REFERENCE_MAX_LENGTH)
  readonly sourceReference?: string | null;

  @ApiProperty({ minLength: NOTE_MIN_LENGTH, maxLength: NOTE_MAX_LENGTH })
  @IsString()
  @MinLength(NOTE_MIN_LENGTH)
  @MaxLength(NOTE_MAX_LENGTH)
  declare readonly reconciliationNote: string;

  @ApiProperty({
    minLength: RULE_KEY_MIN_LENGTH,
    maxLength: RULE_KEY_MAX_LENGTH,
  })
  @IsString()
  @MinLength(RULE_KEY_MIN_LENGTH)
  @MaxLength(RULE_KEY_MAX_LENGTH)
  declare readonly ruleKey: string;
}

/** One entrant's row in a competition standings table. */
export class StandingResponseDto {
  @ApiProperty({ format: 'uuid' })
  declare readonly standingId: string;

  @ApiProperty({ format: 'uuid' })
  declare readonly teamId: string;

  @ApiProperty({ format: 'uuid' })
  declare readonly seasonId: string;

  @ApiProperty({ format: 'uuid' })
  declare readonly competitionId: string;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  declare readonly stageId: string | null;

  @ApiProperty({ format: 'uuid' })
  declare readonly ruleVersionId: string;

  @ApiProperty({ type: String, nullable: true })
  declare readonly poolLabel: string | null;

  @ApiProperty({ enum: StandingEntrantKind })
  declare readonly entrantKind: StandingEntrantKind;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  declare readonly opponentId: string | null;

  @ApiProperty()
  declare readonly played: number;

  @ApiProperty()
  declare readonly wins: number;

  @ApiProperty()
  declare readonly losses: number;

  @ApiProperty()
  declare readonly ties: number;

  @ApiProperty()
  declare readonly pointsFor: number;

  @ApiProperty()
  declare readonly pointsAgainst: number;

  @ApiProperty()
  declare readonly standingPoints: number;

  @ApiProperty({ type: Number, nullable: true })
  declare readonly spiritScore: number | null;

  @ApiProperty({ type: Number, nullable: true })
  declare readonly finalPlace: number | null;

  @ApiProperty({ enum: StandingQualification })
  declare readonly qualification: StandingQualification;

  @ApiProperty({ enum: StandingSource })
  declare readonly source: StandingSource;

  @ApiProperty({ type: String, nullable: true })
  declare readonly sourceReference: string | null;

  @ApiProperty({ type: String, nullable: true })
  declare readonly reconciliationNote: string | null;

  @ApiProperty()
  declare readonly recordVersion: number;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  declare readonly recordedBy: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  declare readonly computedAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  declare readonly createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  declare readonly updatedAt: Date;
}

/** A bounded, rule-version-ordered page of standings rows. */
export class ListStandingsResponseDto {
  @ApiProperty({ type: [StandingResponseDto] })
  declare readonly items: readonly StandingResponseDto[];

  @ApiProperty()
  declare readonly total: number;

  @ApiProperty()
  declare readonly limit: number;

  @ApiProperty()
  declare readonly offset: number;
}

/** The reconciliation of one recompute run. */
export class StandingsRecomputeReportDto {
  @ApiProperty({ format: 'uuid' })
  declare readonly competitionId: string;

  @ApiProperty({ format: 'uuid' })
  declare readonly ruleVersionId: string;

  @ApiProperty()
  declare readonly finalizedMatches: number;

  @ApiProperty()
  declare readonly entrants: number;

  @ApiProperty({ type: [StandingResponseDto] })
  declare readonly rows: readonly StandingResponseDto[];
}

/** Request body creating a draft achievement claim. */
export class CreateAchievementDto {
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  readonly seasonId?: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  readonly competitionId?: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  readonly membershipId?: string | null;

  @ApiProperty({ enum: AchievementCategory })
  @IsEnum(AchievementCategory)
  declare readonly category: AchievementCategory;

  @ApiProperty({ minLength: NAME_MIN_LENGTH, maxLength: NAME_MAX_LENGTH })
  @IsString()
  @MinLength(NAME_MIN_LENGTH)
  @MaxLength(NAME_MAX_LENGTH)
  declare readonly title: string;

  @ApiPropertyOptional({ maxLength: DESCRIPTION_MAX_LENGTH, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(DESCRIPTION_MAX_LENGTH)
  readonly description?: string | null;

  @ApiProperty({ format: 'date' })
  @IsDateString()
  declare readonly achievedOn: string;

  @ApiPropertyOptional({ maxLength: REFERENCE_MAX_LENGTH, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(REFERENCE_MAX_LENGTH)
  readonly evidenceReference?: string | null;

  @ApiPropertyOptional({ enum: AchievementVisibility })
  @IsOptional()
  @IsEnum(AchievementVisibility)
  readonly visibility?: AchievementVisibility;
}

/** Request body moving an achievement through its approval workflow. */
export class TransitionAchievementDto {
  @ApiProperty({ enum: AchievementTransition })
  @IsEnum(AchievementTransition)
  declare readonly transition: AchievementTransition;

  @ApiProperty({ minimum: RECORD_VERSION_MIN })
  @IsInt()
  @Min(RECORD_VERSION_MIN)
  declare readonly expectedRecordVersion: number;
}

/** One audited historical achievement row. */
export class AchievementImportRowDto {
  @ApiProperty({ minLength: NAME_MIN_LENGTH, maxLength: NAME_MAX_LENGTH })
  @IsString()
  @MinLength(NAME_MIN_LENGTH)
  @MaxLength(NAME_MAX_LENGTH)
  declare readonly reference: string;

  @ApiProperty({ enum: AchievementCategory })
  @IsEnum(AchievementCategory)
  declare readonly category: AchievementCategory;

  @ApiProperty({ minLength: NAME_MIN_LENGTH, maxLength: NAME_MAX_LENGTH })
  @IsString()
  @MinLength(NAME_MIN_LENGTH)
  @MaxLength(NAME_MAX_LENGTH)
  declare readonly title: string;

  @ApiPropertyOptional({ maxLength: DESCRIPTION_MAX_LENGTH, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(DESCRIPTION_MAX_LENGTH)
  readonly description?: string | null;

  @ApiProperty({ maxLength: NAME_MAX_LENGTH })
  @IsString()
  @MaxLength(NAME_MAX_LENGTH)
  declare readonly achievedOn: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  readonly seasonId?: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  readonly competitionId?: string | null;

  @ApiPropertyOptional({ maxLength: REFERENCE_MAX_LENGTH, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(REFERENCE_MAX_LENGTH)
  readonly evidenceReference?: string | null;

  @ApiPropertyOptional({ enum: AchievementVisibility })
  @IsOptional()
  @IsEnum(AchievementVisibility)
  readonly visibility?: AchievementVisibility;
}

/** Request body of an audited historical achievement import run. */
export class ImportAchievementsDto {
  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  readonly dryRun?: boolean;

  @ApiProperty({ type: [AchievementImportRowDto], maxItems: IMPORT_MAX_ROWS })
  @IsArray()
  @ArrayMaxSize(IMPORT_MAX_ROWS)
  @ValidateNested({ each: true })
  @Type(() => AchievementImportRowDto)
  declare readonly rows: readonly AchievementImportRowDto[];
}

/** The redacted per-row outcome of an achievement import. */
export class AchievementImportRowResultDto {
  @ApiProperty()
  declare readonly reference: string;

  @ApiProperty({ enum: AchievementImportOutcome })
  declare readonly outcome: AchievementImportOutcome;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  declare readonly achievementId: string | null;
}

/** The reconciliation totals of one achievement import run. */
export class AchievementImportReportDto {
  @ApiProperty()
  declare readonly dryRun: boolean;

  @ApiProperty()
  declare readonly received: number;

  @ApiProperty()
  declare readonly imported: number;

  @ApiProperty()
  declare readonly skippedDuplicate: number;

  @ApiProperty()
  declare readonly rejectedInvalid: number;

  @ApiProperty({ type: [AchievementImportRowResultDto] })
  declare readonly rows: readonly AchievementImportRowResultDto[];
}

/** A team or player achievement with its provenance and approval state. */
export class AchievementResponseDto {
  @ApiProperty({ format: 'uuid' })
  declare readonly achievementId: string;

  @ApiProperty({ format: 'uuid' })
  declare readonly teamId: string;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  declare readonly seasonId: string | null;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  declare readonly competitionId: string | null;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  declare readonly membershipId: string | null;

  @ApiProperty({ enum: AchievementCategory })
  declare readonly category: AchievementCategory;

  @ApiProperty()
  declare readonly title: string;

  @ApiProperty({ type: String, nullable: true })
  declare readonly description: string | null;

  @ApiProperty({ format: 'date' })
  declare readonly achievedOn: string;

  @ApiProperty({ type: String, nullable: true })
  declare readonly evidenceReference: string | null;

  @ApiProperty({ enum: AchievementVisibility })
  declare readonly visibility: AchievementVisibility;

  @ApiProperty({ enum: AchievementStatus })
  declare readonly status: AchievementStatus;

  @ApiProperty({ enum: AchievementSource })
  declare readonly source: AchievementSource;

  @ApiProperty({ type: String, nullable: true })
  declare readonly importReference: string | null;

  @ApiProperty()
  declare readonly recordVersion: number;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  declare readonly createdBy: string | null;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  declare readonly approvedBy: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  declare readonly approvedAt: Date | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  declare readonly rejectedAt: Date | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  declare readonly archivedAt: Date | null;

  @ApiProperty({ type: String, format: 'date-time' })
  declare readonly createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  declare readonly updatedAt: Date;
}

/** A bounded page of achievements. */
export class ListAchievementsResponseDto {
  @ApiProperty({ type: [AchievementResponseDto] })
  declare readonly items: readonly AchievementResponseDto[];

  @ApiProperty()
  declare readonly total: number;

  @ApiProperty()
  declare readonly limit: number;

  @ApiProperty()
  declare readonly offset: number;
}

/** One privacy-safe entry of the trophy cabinet. */
export class TeamHistoryEntryDto {
  @ApiProperty({ format: 'uuid' })
  declare readonly achievementId: string;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  declare readonly seasonId: string | null;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  declare readonly competitionId: string | null;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  declare readonly membershipId: string | null;

  @ApiProperty({ enum: AchievementCategory })
  declare readonly category: AchievementCategory;

  @ApiProperty()
  declare readonly title: string;

  @ApiProperty({ format: 'date' })
  declare readonly achievedOn: string;

  @ApiProperty({ enum: AchievementVisibility })
  declare readonly visibility: AchievementVisibility;
}

/** A bounded page of the team's approved history. */
export class TeamHistoryResponseDto {
  @ApiProperty({ type: [TeamHistoryEntryDto] })
  declare readonly items: readonly TeamHistoryEntryDto[];

  @ApiProperty()
  declare readonly total: number;

  @ApiProperty()
  declare readonly limit: number;

  @ApiProperty()
  declare readonly offset: number;
}
