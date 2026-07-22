import { ApiProperty, ApiPropertyOptional } from '@core/openapi';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  Type,
} from '@core/validation';

import {
  LIST_DEFAULT_LIMIT,
  LIST_MAX_LIMIT,
  LIST_MIN_LIMIT,
  REASON_MAX_LENGTH,
  REASON_MIN_LENGTH,
  RECORD_VERSION_MIN,
} from '../../model/dataquality.constants';
import {
  AnomalyResourceType,
  AnomalySeverity,
  AnomalyStatus,
  AnomalyTransition,
  DATA_QUALITY_RULE_VALUES,
  DataQualityRule,
  RepairKind,
  RepairStatus,
} from '../../model/dataquality.enums';

/**
 * The API boundary of data quality (UN-705). Every DTO class name is
 * module-qualified (`Anomaly*` / `Repair*` / `Scan*`) so the generated OpenAPI
 * document can never collapse two shapes into one schema name. Responses carry
 * resource REFERENCES only — never a private payload.
 */

export class AnomalyListQueryDto {
  @ApiPropertyOptional({ enum: DataQualityRule })
  @IsOptional()
  @IsEnum(DataQualityRule)
  readonly ruleKey?: DataQualityRule;

  @ApiPropertyOptional({ enum: AnomalySeverity })
  @IsOptional()
  @IsEnum(AnomalySeverity)
  readonly severity?: AnomalySeverity;

  @ApiPropertyOptional({ enum: AnomalyStatus })
  @IsOptional()
  @IsEnum(AnomalyStatus)
  readonly status?: AnomalyStatus;

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

export class ScanDataQualityDto {
  @ApiPropertyOptional({ enum: DataQualityRule, isArray: true })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(DATA_QUALITY_RULE_VALUES.length)
  @IsEnum(DataQualityRule, { each: true })
  readonly rules?: readonly DataQualityRule[];
}

export class TransitionAnomalyDto {
  @ApiProperty({ enum: AnomalyTransition })
  @IsEnum(AnomalyTransition)
  declare readonly transition: AnomalyTransition;

  @ApiPropertyOptional({ maxLength: REASON_MAX_LENGTH, nullable: true })
  @IsOptional()
  @IsString()
  @MinLength(REASON_MIN_LENGTH)
  @MaxLength(REASON_MAX_LENGTH)
  readonly resolution?: string | null;

  @ApiProperty({ minimum: RECORD_VERSION_MIN })
  @IsInt()
  @Min(RECORD_VERSION_MIN)
  declare readonly expectedRecordVersion: number;
}

export class AnomalyResponseDto {
  @ApiProperty({ format: 'uuid' })
  declare readonly anomalyId: string;

  @ApiProperty({ format: 'uuid' })
  declare readonly teamId: string;

  @ApiProperty({ enum: DataQualityRule })
  declare readonly ruleKey: DataQualityRule;

  @ApiProperty()
  declare readonly ruleVersion: string;

  @ApiProperty({ enum: AnomalySeverity })
  declare readonly severity: AnomalySeverity;

  @ApiProperty({ enum: AnomalyResourceType })
  declare readonly resourceType: AnomalyResourceType;

  @ApiProperty()
  declare readonly resourceRef: string;

  @ApiProperty()
  declare readonly occurrenceCount: number;

  @ApiProperty({ enum: AnomalyStatus })
  declare readonly status: AnomalyStatus;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  declare readonly ownerUserId: string | null;

  @ApiProperty({ type: String, nullable: true })
  declare readonly resolution: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  declare readonly suppressedUntil: Date | null;

  @ApiProperty()
  declare readonly recordVersion: number;

  @ApiProperty({ type: String, format: 'date-time' })
  declare readonly firstSeenAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  declare readonly lastSeenAt: Date;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  declare readonly resolvedAt: Date | null;

  @ApiProperty({ type: String, format: 'date-time' })
  declare readonly createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  declare readonly updatedAt: Date;
}

export class ListAnomaliesResponseDto {
  @ApiProperty({ type: [AnomalyResponseDto] })
  declare readonly items: readonly AnomalyResponseDto[];

  @ApiProperty()
  declare readonly total: number;

  @ApiProperty()
  declare readonly limit: number;

  @ApiProperty()
  declare readonly offset: number;
}

export class ScanReportResponseDto {
  @ApiProperty()
  declare readonly ruleVersion: string;

  @ApiProperty()
  declare readonly rulesRun: number;

  @ApiProperty()
  declare readonly detected: number;

  @ApiProperty()
  declare readonly opened: number;

  @ApiProperty()
  declare readonly reopened: number;

  @ApiProperty()
  declare readonly alertable: number;
}

export class RepairPreviewResponseDto {
  @ApiProperty({ format: 'uuid' })
  declare readonly anomalyId: string;

  @ApiProperty({ enum: RepairKind })
  declare readonly repairKind: RepairKind;

  @ApiProperty()
  declare readonly impactCount: number;

  @ApiProperty()
  declare readonly impactSummary: string;

  @ApiProperty()
  declare readonly reversible: boolean;
}

export class RepairResponseDto {
  @ApiProperty({ format: 'uuid' })
  declare readonly repairId: string;

  @ApiProperty({ format: 'uuid' })
  declare readonly anomalyId: string;

  @ApiProperty({ enum: RepairKind })
  declare readonly repairKind: RepairKind;

  @ApiProperty({ enum: RepairStatus })
  declare readonly status: RepairStatus;

  @ApiProperty()
  declare readonly impactCount: number;

  @ApiProperty({ type: String, nullable: true })
  declare readonly impactSummary: string | null;

  @ApiProperty({ type: String, nullable: true })
  declare readonly rollbackRef: string | null;

  @ApiProperty()
  declare readonly recordVersion: number;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  declare readonly appliedAt: Date | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  declare readonly rolledBackAt: Date | null;

  @ApiProperty({ type: String, format: 'date-time' })
  declare readonly createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  declare readonly updatedAt: Date;
}
