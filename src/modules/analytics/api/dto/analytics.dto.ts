import { ApiProperty, ApiPropertyOptional } from '@core/openapi';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  Type,
} from '@core/validation';

import {
  LIST_DEFAULT_LIMIT,
  LIST_MAX_LIMIT,
  LIST_MIN_LIMIT,
  PERIOD_KEY_MAX_LENGTH,
} from '../../model/analytics.constants';
import {
  AnalyticsDimension,
  AnalyticsDirection,
  AnalyticsPeriodType,
  AnalyticsUnit,
} from '../../model/analytics.enums';

/**
 * The API boundary of analytics (UN-700). Every DTO class name is
 * module-qualified (`Analytics*` / `Cohort*`) so the generated OpenAPI document
 * can never collapse two shapes into one schema name.
 */

export class AnalyticsSeriesQueryDto {
  @ApiPropertyOptional({ enum: AnalyticsDimension })
  @IsOptional()
  @IsEnum(AnalyticsDimension)
  readonly dimension?: AnalyticsDimension;

  @ApiPropertyOptional({ enum: AnalyticsPeriodType })
  @IsOptional()
  @IsEnum(AnalyticsPeriodType)
  readonly periodType?: AnalyticsPeriodType;

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

export class CohortComparisonQueryDto {
  @ApiProperty({ enum: AnalyticsDimension })
  @IsEnum(AnalyticsDimension)
  declare readonly dimension: AnalyticsDimension;

  @ApiPropertyOptional({ enum: AnalyticsPeriodType })
  @IsOptional()
  @IsEnum(AnalyticsPeriodType)
  readonly periodType?: AnalyticsPeriodType;

  @ApiProperty({ maxLength: PERIOD_KEY_MAX_LENGTH })
  @IsString()
  @MaxLength(PERIOD_KEY_MAX_LENGTH)
  declare readonly periodKey: string;
}

export class RebuildAnalyticsDto {
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  readonly seasonId?: string | null;

  @ApiPropertyOptional({ enum: AnalyticsPeriodType })
  @IsOptional()
  @IsEnum(AnalyticsPeriodType)
  readonly periodType?: AnalyticsPeriodType;
}

export class AnalyticsSeriesPointDto {
  @ApiProperty()
  @Matches(/^[\w-]+$/u)
  declare readonly periodKey: string;

  @ApiProperty({ type: Number, nullable: true })
  declare readonly value: number | null;

  @ApiProperty()
  declare readonly sampleSize: number;
}

export class AnalyticsSeriesResponseDto {
  @ApiProperty()
  declare readonly seriesId: string;

  @ApiProperty({ enum: AnalyticsDimension })
  declare readonly dimension: AnalyticsDimension;

  @ApiProperty({ enum: AnalyticsUnit })
  declare readonly unit: AnalyticsUnit;

  @ApiProperty({ enum: AnalyticsDirection })
  declare readonly direction: AnalyticsDirection;

  @ApiProperty({ enum: AnalyticsPeriodType })
  declare readonly periodType: AnalyticsPeriodType;

  @ApiProperty()
  declare readonly calculationVersion: string;

  @ApiProperty()
  declare readonly benchmarkLabel: string;

  @ApiProperty()
  declare readonly summary: string;

  @ApiProperty({ type: [AnalyticsSeriesPointDto] })
  declare readonly points: readonly AnalyticsSeriesPointDto[];

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  declare readonly computedAt: Date | null;
}

export class CohortComparisonResponseDto {
  @ApiProperty({ enum: AnalyticsDimension })
  declare readonly dimension: AnalyticsDimension;

  @ApiProperty()
  declare readonly periodKey: string;

  @ApiProperty()
  declare readonly sampleSize: number;

  @ApiProperty()
  declare readonly suppressed: boolean;

  @ApiProperty({ type: Number, nullable: true })
  declare readonly average: number | null;

  @ApiProperty({ type: Number, nullable: true })
  declare readonly minimum: number | null;

  @ApiProperty({ type: Number, nullable: true })
  declare readonly maximum: number | null;
}

export class RebuildAnalyticsReportDto {
  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  declare readonly seasonId: string | null;

  @ApiProperty({ enum: AnalyticsPeriodType })
  declare readonly periodType: AnalyticsPeriodType;

  @ApiProperty()
  declare readonly calculationVersion: string;

  @ApiProperty()
  declare readonly subjectsProjected: number;

  @ApiProperty()
  declare readonly projectionsWritten: number;

  @ApiProperty({ type: String, format: 'date-time' })
  declare readonly computedAt: Date;
}
