import { ApiProperty, ApiPropertyOptional } from '@core/openapi';
import {
  ArrayMaxSize,
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  Type,
  ValidateNested,
} from '@core/validation';

import {
  METRIC_VALUES_MAX_ITEMS,
  REASON_MAX_LENGTH,
  REASON_MIN_LENGTH,
  SUMMARY_MAX_LENGTH,
} from '../../model/player-assessments.constants';
import { AssessmentValueDto } from './assessment-value.dto';

/**
 * Request body to correct a PUBLISHED assessment. This never edits the published
 * snapshot — it creates a new superseding REVISED revision carrying the full
 * corrected value set and a mandatory reason.
 */
export class CorrectPlayerAssessmentDto {
  @ApiProperty({ minLength: REASON_MIN_LENGTH, maxLength: REASON_MAX_LENGTH })
  @IsString()
  @MinLength(REASON_MIN_LENGTH)
  @MaxLength(REASON_MAX_LENGTH)
  declare readonly reason: string;

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
