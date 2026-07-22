import { ApiProperty, ApiPropertyOptional } from '@core/openapi';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
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
  ALIAS_MAX_LENGTH,
  COMMENT_MAX_LENGTH,
  DURATION_MIN,
  EXTERNAL_REF_MAX_LENGTH,
  EXTERNAL_REF_MIN_LENGTH,
  IMPORT_MAX_ROWS,
  LIST_DEFAULT_LIMIT,
  LIST_MAX_LIMIT,
  LIST_MIN_LIMIT,
  PLAYERS_MAX_COUNT,
  REASON_MAX_LENGTH,
  REASON_MIN_LENGTH,
  RECORD_VERSION_MIN,
  SECOND_MAX,
  SECOND_MIN,
  SYNC_OFFSET_MAX,
  SYNC_OFFSET_MIN,
  TAG_MAX_LENGTH,
  TAG_MIN_LENGTH,
  TAGS_MAX_COUNT,
  TITLE_MAX_LENGTH,
  TITLE_MIN_LENGTH,
} from '../../model/analysis.constants';
import {
  ClipImportOutcome,
  ClipPlayContext,
  ClipStatus,
  ClipTransition,
  ClipType,
  ClipVisibility,
  VideoAccessPolicy,
  VideoProcessingStatus,
  VideoProvider,
} from '../../model/analysis.enums';

/**
 * The API boundary of match video analysis (UN-505). Every DTO class name is
 * module-qualified (`Video*` / `Clip*` / `Analysis*`) so the generated OpenAPI
 * document can never collapse two different shapes into one schema name.
 *
 * `null` is preserved everywhere it means "not known": an unreported recording
 * duration and an open-ended clip both stay null rather than becoming zero.
 */

/** Bounded pagination shared by every analysis list. */
export class AnalysisPageQueryDto {
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

/** Allow-listed facets of the video-source list. */
export class VideoSourceListQueryDto extends AnalysisPageQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  readonly matchId?: string;

  @ApiPropertyOptional({ enum: VideoProvider })
  @IsOptional()
  @IsEnum(VideoProvider)
  readonly provider?: VideoProvider;
}

/** Allow-listed facets of the analysis clip queue. */
export class VideoClipListQueryDto extends AnalysisPageQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  readonly sourceId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  readonly matchId?: string;

  @ApiPropertyOptional({ enum: ClipType })
  @IsOptional()
  @IsEnum(ClipType)
  readonly clipType?: ClipType;

  @ApiPropertyOptional({ enum: ClipStatus })
  @IsOptional()
  @IsEnum(ClipStatus)
  readonly status?: ClipStatus;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  readonly membershipId?: string;

  @ApiPropertyOptional({ minLength: TAG_MIN_LENGTH, maxLength: TAG_MAX_LENGTH })
  @IsOptional()
  @IsString()
  @MinLength(TAG_MIN_LENGTH)
  @MaxLength(TAG_MAX_LENGTH)
  readonly tag?: string;
}

/** Request body registering one recording of a match. */
export class RegisterVideoSourceDto {
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  readonly matchId?: string | null;

  @ApiProperty({ enum: VideoProvider })
  @IsEnum(VideoProvider)
  declare readonly provider: VideoProvider;

  @ApiProperty({
    minLength: EXTERNAL_REF_MIN_LENGTH,
    maxLength: EXTERNAL_REF_MAX_LENGTH,
  })
  @IsString()
  @MinLength(EXTERNAL_REF_MIN_LENGTH)
  @MaxLength(EXTERNAL_REF_MAX_LENGTH)
  declare readonly externalRef: string;

  @ApiProperty({ minLength: TITLE_MIN_LENGTH, maxLength: TITLE_MAX_LENGTH })
  @IsString()
  @MinLength(TITLE_MIN_LENGTH)
  @MaxLength(TITLE_MAX_LENGTH)
  declare readonly title: string;

  @ApiPropertyOptional({
    minimum: DURATION_MIN,
    maximum: SECOND_MAX,
    nullable: true,
    description: 'Null when the provider has not reported a duration.',
  })
  @IsOptional()
  @IsInt()
  @Min(DURATION_MIN)
  @Max(SECOND_MAX)
  readonly durationSeconds?: number | null;

  @ApiPropertyOptional({ minimum: SYNC_OFFSET_MIN, maximum: SYNC_OFFSET_MAX })
  @IsOptional()
  @IsInt()
  @Min(SYNC_OFFSET_MIN)
  @Max(SYNC_OFFSET_MAX)
  readonly syncOffsetSeconds?: number;

  @ApiPropertyOptional({ enum: VideoProcessingStatus })
  @IsOptional()
  @IsEnum(VideoProcessingStatus)
  readonly processingStatus?: VideoProcessingStatus;

  @ApiPropertyOptional({ enum: VideoAccessPolicy })
  @IsOptional()
  @IsEnum(VideoAccessPolicy)
  readonly accessPolicy?: VideoAccessPolicy;
}

/** A registered recording. Carries the reference, never the bytes. */
export class VideoSourceResponseDto {
  @ApiProperty({ format: 'uuid' })
  declare readonly sourceId: string;

  @ApiProperty({ format: 'uuid' })
  declare readonly teamId: string;

  @ApiProperty({ format: 'uuid' })
  declare readonly seasonId: string;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  declare readonly matchId: string | null;

  @ApiProperty({ enum: VideoProvider })
  declare readonly provider: VideoProvider;

  @ApiProperty()
  declare readonly externalRef: string;

  @ApiProperty()
  declare readonly title: string;

  @ApiProperty({ type: Number, nullable: true })
  declare readonly durationSeconds: number | null;

  @ApiProperty()
  declare readonly syncOffsetSeconds: number;

  @ApiProperty({ enum: VideoProcessingStatus })
  declare readonly processingStatus: VideoProcessingStatus;

  @ApiProperty({ enum: VideoAccessPolicy })
  declare readonly accessPolicy: VideoAccessPolicy;

  @ApiProperty()
  declare readonly recordVersion: number;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  declare readonly registeredBy: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  declare readonly createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  declare readonly updatedAt: Date;
}

/** A bounded page of registered recordings. */
export class ListVideoSourcesResponseDto {
  @ApiProperty({ type: [VideoSourceResponseDto] })
  declare readonly items: readonly VideoSourceResponseDto[];

  @ApiProperty()
  declare readonly total: number;

  @ApiProperty()
  declare readonly limit: number;

  @ApiProperty()
  declare readonly offset: number;
}

/** A short-lived provider handle. The API never streams the recording. */
export class VideoAccessResponseDto {
  @ApiProperty({ format: 'uuid' })
  declare readonly sourceId: string;

  @ApiProperty({ enum: VideoProvider })
  declare readonly provider: VideoProvider;

  @ApiProperty()
  declare readonly url: string;

  @ApiProperty({ type: String, format: 'date-time' })
  declare readonly expiresAt: Date;

  @ApiProperty()
  declare readonly syncOffsetSeconds: number;
}

/** Request body creating or revising a timestamped coaching observation. */
export class VideoClipContentDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  declare readonly sourceId: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  readonly pointId?: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  readonly eventId?: string | null;

  @ApiProperty({ minimum: SECOND_MIN, maximum: SECOND_MAX })
  @IsInt()
  @Min(SECOND_MIN)
  @Max(SECOND_MAX)
  declare readonly startSecond: number;

  @ApiPropertyOptional({
    minimum: SECOND_MIN,
    maximum: SECOND_MAX,
    nullable: true,
    description: 'Null for an open-ended mark rather than a range.',
  })
  @IsOptional()
  @IsInt()
  @Min(SECOND_MIN)
  @Max(SECOND_MAX)
  readonly endSecond?: number | null;

  @ApiPropertyOptional({ enum: ClipPlayContext })
  @IsOptional()
  @IsEnum(ClipPlayContext)
  readonly playContext?: ClipPlayContext;

  @ApiProperty({ enum: ClipType })
  @IsEnum(ClipType)
  declare readonly clipType: ClipType;

  @ApiProperty({ minLength: TITLE_MIN_LENGTH, maxLength: TITLE_MAX_LENGTH })
  @IsString()
  @MinLength(TITLE_MIN_LENGTH)
  @MaxLength(TITLE_MAX_LENGTH)
  declare readonly title: string;

  @ApiPropertyOptional({ maxLength: COMMENT_MAX_LENGTH, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(COMMENT_MAX_LENGTH)
  readonly comment?: string | null;

  @ApiPropertyOptional({ enum: ClipVisibility })
  @IsOptional()
  @IsEnum(ClipVisibility)
  readonly visibility?: ClipVisibility;

  @ApiPropertyOptional({ type: [String], maxItems: PLAYERS_MAX_COUNT })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(PLAYERS_MAX_COUNT)
  @IsUUID(undefined, { each: true })
  readonly membershipIds?: readonly string[];

  @ApiPropertyOptional({ type: [String], maxItems: TAGS_MAX_COUNT })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(TAGS_MAX_COUNT)
  @IsString({ each: true })
  @MaxLength(TAG_MAX_LENGTH, { each: true })
  readonly tags?: readonly string[];
}

/** Request body moving a clip through its review workflow. */
export class TransitionVideoClipDto {
  @ApiProperty({ enum: ClipTransition })
  @IsEnum(ClipTransition)
  declare readonly transition: ClipTransition;

  @ApiProperty({ minimum: RECORD_VERSION_MIN })
  @IsInt()
  @Min(RECORD_VERSION_MIN)
  declare readonly expectedRecordVersion: number;
}

/** Request body superseding a published clip with a corrected revision. */
export class ReviseVideoClipDto {
  @ApiProperty({ type: VideoClipContentDto })
  @ValidateNested()
  @Type(() => VideoClipContentDto)
  declare readonly content: VideoClipContentDto;

  @ApiProperty({ minLength: REASON_MIN_LENGTH, maxLength: REASON_MAX_LENGTH })
  @IsString()
  @MinLength(REASON_MIN_LENGTH)
  @MaxLength(REASON_MAX_LENGTH)
  declare readonly reason: string;

  @ApiProperty({ minimum: RECORD_VERSION_MIN })
  @IsInt()
  @Min(RECORD_VERSION_MIN)
  declare readonly expectedRecordVersion: number;
}

/** One audited legacy analysis row. Aliases keep the source spelling. */
export class ClipImportRowDto {
  @ApiProperty({ minLength: TITLE_MIN_LENGTH, maxLength: TITLE_MAX_LENGTH })
  @IsString()
  @MinLength(TITLE_MIN_LENGTH)
  @MaxLength(TITLE_MAX_LENGTH)
  declare readonly reference: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  declare readonly sourceId: string;

  @ApiProperty({ minimum: SECOND_MIN, maximum: SECOND_MAX })
  @IsInt()
  @Min(SECOND_MIN)
  @Max(SECOND_MAX)
  declare readonly startSecond: number;

  @ApiPropertyOptional({
    minimum: SECOND_MIN,
    maximum: SECOND_MAX,
    nullable: true,
  })
  @IsOptional()
  @IsInt()
  @Min(SECOND_MIN)
  @Max(SECOND_MAX)
  readonly endSecond?: number | null;

  @ApiProperty({ enum: ClipType })
  @IsEnum(ClipType)
  declare readonly clipType: ClipType;

  @ApiPropertyOptional({ enum: ClipPlayContext })
  @IsOptional()
  @IsEnum(ClipPlayContext)
  readonly playContext?: ClipPlayContext;

  @ApiProperty({ minLength: TITLE_MIN_LENGTH, maxLength: TITLE_MAX_LENGTH })
  @IsString()
  @MinLength(TITLE_MIN_LENGTH)
  @MaxLength(TITLE_MAX_LENGTH)
  declare readonly title: string;

  @ApiPropertyOptional({ maxLength: COMMENT_MAX_LENGTH, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(COMMENT_MAX_LENGTH)
  readonly comment?: string | null;

  @ApiPropertyOptional({ type: [String], maxItems: PLAYERS_MAX_COUNT })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(PLAYERS_MAX_COUNT)
  @IsString({ each: true })
  @MaxLength(ALIAS_MAX_LENGTH, { each: true })
  readonly playerAliases?: readonly string[];

  @ApiPropertyOptional({ type: [String], maxItems: TAGS_MAX_COUNT })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(TAGS_MAX_COUNT)
  @IsString({ each: true })
  @MaxLength(TAG_MAX_LENGTH, { each: true })
  readonly tags?: readonly string[];
}

/** Request body of an audited analysis import run. */
export class ImportVideoClipsDto {
  @ApiPropertyOptional({
    default: true,
    description: 'A dry run performs every check and writes nothing.',
  })
  @IsOptional()
  @IsBoolean()
  readonly dryRun?: boolean;

  @ApiProperty({ type: [ClipImportRowDto], maxItems: IMPORT_MAX_ROWS })
  @IsArray()
  @ArrayMaxSize(IMPORT_MAX_ROWS)
  @ValidateNested({ each: true })
  @Type(() => ClipImportRowDto)
  declare readonly rows: readonly ClipImportRowDto[];
}

/** The redacted per-row outcome of an import. Reference and verdict only. */
export class ClipImportRowResultDto {
  @ApiProperty()
  declare readonly reference: string;

  @ApiProperty({ enum: ClipImportOutcome })
  declare readonly outcome: ClipImportOutcome;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  declare readonly clipId: string | null;
}

/** The reconciliation totals of one import run. */
export class ClipImportReportDto {
  @ApiProperty()
  declare readonly dryRun: boolean;

  @ApiProperty()
  declare readonly received: number;

  @ApiProperty()
  declare readonly imported: number;

  @ApiProperty()
  declare readonly skippedDuplicate: number;

  @ApiProperty()
  declare readonly rejectedTimestamp: number;

  @ApiProperty()
  declare readonly rejectedAlias: number;

  @ApiProperty({ type: [ClipImportRowResultDto] })
  declare readonly rows: readonly ClipImportRowResultDto[];
}

/** The clip record itself. `comment` is null when the viewer may not read it. */
export class VideoClipRecordDto {
  @ApiProperty({ format: 'uuid' })
  declare readonly clipId: string;

  @ApiProperty({ format: 'uuid' })
  declare readonly teamId: string;

  @ApiProperty({ format: 'uuid' })
  declare readonly seasonId: string;

  @ApiProperty({ format: 'uuid' })
  declare readonly sourceId: string;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  declare readonly matchId: string | null;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  declare readonly pointId: string | null;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  declare readonly eventId: string | null;

  @ApiProperty()
  declare readonly startSecond: number;

  @ApiProperty({ type: Number, nullable: true })
  declare readonly endSecond: number | null;

  @ApiProperty({ enum: ClipPlayContext })
  declare readonly playContext: ClipPlayContext;

  @ApiProperty({ enum: ClipType })
  declare readonly clipType: ClipType;

  @ApiProperty()
  declare readonly title: string;

  @ApiProperty({ type: String, nullable: true })
  declare readonly comment: string | null;

  @ApiProperty({ enum: ClipVisibility })
  declare readonly visibility: ClipVisibility;

  @ApiProperty({ enum: ClipStatus })
  declare readonly status: ClipStatus;

  @ApiProperty()
  declare readonly revision: number;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  declare readonly supersedesClipId: string | null;

  @ApiProperty({ type: String, nullable: true })
  declare readonly importReference: string | null;

  @ApiProperty()
  declare readonly recordVersion: number;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  declare readonly authorUserId: string | null;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  declare readonly reviewedBy: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  declare readonly reviewedAt: Date | null;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  declare readonly publishedBy: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  declare readonly publishedAt: Date | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  declare readonly archivedAt: Date | null;

  @ApiProperty({ type: String, format: 'date-time' })
  declare readonly createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  declare readonly updatedAt: Date;
}

/** A clip with its tags, the players it is about, and their acknowledgements. */
export class VideoClipResponseDto {
  @ApiProperty({ type: VideoClipRecordDto })
  declare readonly clip: VideoClipRecordDto;

  @ApiProperty({ type: [String] })
  declare readonly tags: readonly string[];

  @ApiProperty({ type: [String] })
  declare readonly membershipIds: readonly string[];

  @ApiProperty({ type: [String] })
  declare readonly acknowledgedMembershipIds: readonly string[];
}

/** A bounded page of analysis clips the caller is allowed to see. */
export class ListVideoClipsResponseDto {
  @ApiProperty({ type: [VideoClipResponseDto] })
  declare readonly items: readonly VideoClipResponseDto[];

  @ApiProperty()
  declare readonly total: number;

  @ApiProperty()
  declare readonly limit: number;

  @ApiProperty()
  declare readonly offset: number;
}
