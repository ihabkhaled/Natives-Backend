import { ApiProperty, ApiPropertyOptional } from '@core/openapi';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  Type,
  ValidateNested,
} from '@core/validation';

import {
  METRIC_VALUES_MAX_ITEMS,
  RECORD_VERSION_MIN,
  SUMMARY_MAX_LENGTH,
} from '../../model/player-assessments.constants';
import { AssessmentValueDto } from './assessment-value.dto';

/**
 * Autosave upsert of a DRAFT: replaces the summary and the full set of per-metric
 * values under optimistic concurrency (`expectedRecordVersion`).
 */
export class UpdatePlayerAssessmentDto {
  @ApiProperty({ minimum: RECORD_VERSION_MIN })
  @IsInt()
  @Min(RECORD_VERSION_MIN)
  declare readonly expectedRecordVersion: number;

  @ApiPropertyOptional({ maxLength: SUMMARY_MAX_LENGTH, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(SUMMARY_MAX_LENGTH)
  readonly summary?: string | null;

  @ApiProperty({ type: [AssessmentValueDto] })
  @IsArray()
  @ArrayMaxSize(METRIC_VALUES_MAX_ITEMS)
  @ValidateNested({ each: true })
  @Type(() => AssessmentValueDto)
  declare readonly values: readonly AssessmentValueDto[];
}
