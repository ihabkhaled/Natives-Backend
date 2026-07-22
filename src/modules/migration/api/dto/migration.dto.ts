import { ApiProperty, ApiPropertyOptional } from '@core/openapi';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsObject,
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
  IMPORT_MAX_ROWS,
  LIST_DEFAULT_LIMIT,
  LIST_MAX_LIMIT,
  LIST_MIN_LIMIT,
  NAME_MAX_LENGTH,
  NAME_MIN_LENGTH,
  RECORD_VERSION_MIN,
  REF_MAX_LENGTH,
} from '../../model/migration.constants';
import {
  AliasResolutionStatus,
  AliasSource,
  DiscrepancyClassification,
  ImportStatus,
  RowAction,
  RowOutcome,
  WorkbookType,
} from '../../model/migration.enums';

/**
 * The API boundary of the migration pipeline (UN-702, UN-703, UN-704). Every DTO
 * class name is module-qualified (`Import*` / `Alias*` / `Comparison*`) so the
 * generated OpenAPI document can never collapse two shapes into one schema name.
 * National IDs and unapproved fields are never accepted here.
 */

export class MigrationPageQueryDto {
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

export class ImportListQueryDto extends MigrationPageQueryDto {
  @ApiPropertyOptional({ enum: WorkbookType })
  @IsOptional()
  @IsEnum(WorkbookType)
  readonly workbookType?: WorkbookType;

  @ApiPropertyOptional({ enum: ImportStatus })
  @IsOptional()
  @IsEnum(ImportStatus)
  readonly status?: ImportStatus;
}

export class AliasListQueryDto extends MigrationPageQueryDto {
  @ApiPropertyOptional({ enum: AliasResolutionStatus })
  @IsOptional()
  @IsEnum(AliasResolutionStatus)
  readonly status?: AliasResolutionStatus;
}

export class ComparisonListQueryDto extends MigrationPageQueryDto {
  @ApiPropertyOptional({ enum: WorkbookType })
  @IsOptional()
  @IsEnum(WorkbookType)
  readonly workbookType?: WorkbookType;

  @ApiPropertyOptional({ enum: DiscrepancyClassification })
  @IsOptional()
  @IsEnum(DiscrepancyClassification)
  readonly classification?: DiscrepancyClassification;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  readonly signedOff?: boolean;
}

// --- Import ------------------------------------------------------------------

export class ImportSourceRowDto {
  @ApiProperty({ maxLength: REF_MAX_LENGTH })
  @IsString()
  @MinLength(1)
  @MaxLength(REF_MAX_LENGTH)
  declare readonly rowRef: string;

  @ApiProperty({ type: Object })
  @IsObject()
  declare readonly cells: Readonly<Record<string, string>>;
}

export class StageImportDto {
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  readonly seasonId?: string | null;

  @ApiProperty({ enum: WorkbookType })
  @IsEnum(WorkbookType)
  declare readonly workbookType: WorkbookType;

  @ApiProperty({ minLength: NAME_MIN_LENGTH, maxLength: NAME_MAX_LENGTH })
  @IsString()
  @MinLength(NAME_MIN_LENGTH)
  @MaxLength(NAME_MAX_LENGTH)
  declare readonly sourceName: string;

  @ApiPropertyOptional({
    default: true,
    description: 'A dry run parses and reconciles but writes nothing.',
  })
  @IsOptional()
  @IsBoolean()
  readonly dryRun?: boolean;

  @ApiProperty({ type: [ImportSourceRowDto], maxItems: IMPORT_MAX_ROWS })
  @IsArray()
  @ArrayMaxSize(IMPORT_MAX_ROWS)
  @ValidateNested({ each: true })
  @Type(() => ImportSourceRowDto)
  declare readonly rows: readonly ImportSourceRowDto[];
}

export class ImportJobResponseDto {
  @ApiProperty({ format: 'uuid' })
  declare readonly jobId: string;

  @ApiProperty({ format: 'uuid' })
  declare readonly teamId: string;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  declare readonly seasonId: string | null;

  @ApiProperty({ enum: WorkbookType })
  declare readonly workbookType: WorkbookType;

  @ApiProperty()
  declare readonly mapperVersion: string;

  @ApiProperty()
  declare readonly sourceHash: string;

  @ApiProperty()
  declare readonly sourceName: string;

  @ApiProperty()
  declare readonly dryRun: boolean;

  @ApiProperty({ enum: ImportStatus })
  declare readonly status: ImportStatus;

  @ApiProperty()
  declare readonly receivedRows: number;

  @ApiProperty()
  declare readonly stagedRows: number;

  @ApiProperty()
  declare readonly committedRows: number;

  @ApiProperty()
  declare readonly skippedRows: number;

  @ApiProperty()
  declare readonly errorRows: number;

  @ApiProperty()
  declare readonly quarantinedRows: number;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  declare readonly reversalOfJobId: string | null;

  @ApiProperty()
  declare readonly recordVersion: number;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  declare readonly committedAt: Date | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  declare readonly reversedAt: Date | null;

  @ApiProperty({ type: String, format: 'date-time' })
  declare readonly createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  declare readonly updatedAt: Date;
}

export class ListImportJobsResponseDto {
  @ApiProperty({ type: [ImportJobResponseDto] })
  declare readonly items: readonly ImportJobResponseDto[];

  @ApiProperty()
  declare readonly total: number;

  @ApiProperty()
  declare readonly limit: number;

  @ApiProperty()
  declare readonly offset: number;
}

export class ImportRowResultResponseDto {
  @ApiProperty({ format: 'uuid' })
  declare readonly resultId: string;

  @ApiProperty({ format: 'uuid' })
  declare readonly jobId: string;

  @ApiProperty()
  declare readonly rowRef: string;

  @ApiProperty({ enum: RowOutcome })
  declare readonly outcome: RowOutcome;

  @ApiProperty({ enum: RowAction })
  declare readonly action: RowAction;

  @ApiProperty({ type: String, nullable: true })
  declare readonly entityRef: string | null;

  @ApiProperty({ type: String, nullable: true })
  declare readonly messageKey: string | null;
}

export class ListImportRowResultsResponseDto {
  @ApiProperty({ type: [ImportRowResultResponseDto] })
  declare readonly items: readonly ImportRowResultResponseDto[];
}

// --- Alias -------------------------------------------------------------------

export class RegisterAliasDto {
  @ApiProperty({ minLength: NAME_MIN_LENGTH, maxLength: NAME_MAX_LENGTH })
  @IsString()
  @MinLength(NAME_MIN_LENGTH)
  @MaxLength(NAME_MAX_LENGTH)
  declare readonly sourceAlias: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  readonly candidateMembershipId?: string | null;
}

export class ReviewAliasDto {
  @ApiProperty({ enum: AliasResolutionStatus })
  @IsEnum(AliasResolutionStatus)
  declare readonly status: AliasResolutionStatus;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  readonly resolvedMembershipId?: string | null;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  readonly override?: boolean;

  @ApiProperty({ minimum: RECORD_VERSION_MIN })
  @IsInt()
  @Min(RECORD_VERSION_MIN)
  declare readonly expectedRecordVersion: number;
}

export class AliasResolutionResponseDto {
  @ApiProperty({ format: 'uuid' })
  declare readonly resolutionId: string;

  @ApiProperty({ format: 'uuid' })
  declare readonly teamId: string;

  @ApiProperty({ enum: AliasSource })
  declare readonly source: AliasSource;

  @ApiProperty()
  declare readonly sourceAlias: string;

  @ApiProperty()
  declare readonly normalizedAlias: string;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  declare readonly candidateMembershipId: string | null;

  @ApiProperty()
  declare readonly confidence: number;

  @ApiProperty({ enum: AliasResolutionStatus })
  declare readonly status: AliasResolutionStatus;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  declare readonly resolvedMembershipId: string | null;

  @ApiProperty()
  declare readonly override: boolean;

  @ApiProperty()
  declare readonly recordVersion: number;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  declare readonly reviewedBy: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  declare readonly reviewedAt: Date | null;

  @ApiProperty({ type: String, format: 'date-time' })
  declare readonly createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  declare readonly updatedAt: Date;
}

export class ListAliasResolutionsResponseDto {
  @ApiProperty({ type: [AliasResolutionResponseDto] })
  declare readonly items: readonly AliasResolutionResponseDto[];

  @ApiProperty()
  declare readonly total: number;

  @ApiProperty()
  declare readonly limit: number;

  @ApiProperty()
  declare readonly offset: number;
}

// --- Comparison --------------------------------------------------------------

export class RecordComparisonDto {
  @ApiProperty({ enum: WorkbookType })
  @IsEnum(WorkbookType)
  declare readonly workbookType: WorkbookType;

  @ApiProperty({ maxLength: NAME_MAX_LENGTH })
  @IsString()
  @MinLength(1)
  @MaxLength(NAME_MAX_LENGTH)
  declare readonly metric: string;

  @ApiProperty({ maxLength: REF_MAX_LENGTH })
  @IsString()
  @MinLength(1)
  @MaxLength(REF_MAX_LENGTH)
  declare readonly subjectRef: string;

  @ApiPropertyOptional({ type: Number, nullable: true })
  @IsOptional()
  @IsNumber()
  readonly legacyValue?: number | null;

  @ApiPropertyOptional({ type: Number, nullable: true })
  @IsOptional()
  @IsNumber()
  readonly targetValue?: number | null;

  @ApiPropertyOptional({ maxLength: NAME_MAX_LENGTH, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(NAME_MAX_LENGTH)
  readonly legacyRuleVersion?: string | null;

  @ApiPropertyOptional({ maxLength: NAME_MAX_LENGTH, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(NAME_MAX_LENGTH)
  readonly targetRuleVersion?: string | null;
}

export class SignOffComparisonDto {
  @ApiProperty({ minLength: NAME_MIN_LENGTH, maxLength: NAME_MAX_LENGTH })
  @IsString()
  @MinLength(NAME_MIN_LENGTH)
  @MaxLength(NAME_MAX_LENGTH)
  declare readonly signedOffByName: string;

  @ApiProperty({ minimum: RECORD_VERSION_MIN })
  @IsInt()
  @Min(RECORD_VERSION_MIN)
  declare readonly expectedRecordVersion: number;
}

export class FormulaComparisonResponseDto {
  @ApiProperty({ format: 'uuid' })
  declare readonly comparisonId: string;

  @ApiProperty({ format: 'uuid' })
  declare readonly teamId: string;

  @ApiProperty({ enum: WorkbookType })
  declare readonly workbookType: WorkbookType;

  @ApiProperty()
  declare readonly metric: string;

  @ApiProperty()
  declare readonly subjectRef: string;

  @ApiProperty({ type: Number, nullable: true })
  declare readonly legacyValue: number | null;

  @ApiProperty({ type: Number, nullable: true })
  declare readonly targetValue: number | null;

  @ApiProperty({ type: Number, nullable: true })
  declare readonly difference: number | null;

  @ApiProperty({ enum: DiscrepancyClassification })
  declare readonly classification: DiscrepancyClassification;

  @ApiProperty({ type: String, nullable: true })
  declare readonly legacyRuleVersion: string | null;

  @ApiProperty({ type: String, nullable: true })
  declare readonly targetRuleVersion: string | null;

  @ApiProperty()
  declare readonly artifactChecksum: string;

  @ApiProperty()
  declare readonly signedOff: boolean;

  @ApiProperty({ type: String, nullable: true })
  declare readonly signedOffByName: string | null;

  @ApiProperty()
  declare readonly recordVersion: number;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  declare readonly signedOffAt: Date | null;

  @ApiProperty({ type: String, format: 'date-time' })
  declare readonly createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  declare readonly updatedAt: Date;
}

export class ListFormulaComparisonsResponseDto {
  @ApiProperty({ type: [FormulaComparisonResponseDto] })
  declare readonly items: readonly FormulaComparisonResponseDto[];

  @ApiProperty()
  declare readonly total: number;

  @ApiProperty()
  declare readonly limit: number;

  @ApiProperty()
  declare readonly offset: number;
}
