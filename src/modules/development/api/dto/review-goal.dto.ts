import { ApiProperty, ApiPropertyOptional } from '@core/openapi';
import {
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from '@core/validation';

import {
  GOAL_NUMERIC_MAX,
  GOAL_NUMERIC_MIN,
  GOAL_TEXT_MAX_LENGTH,
  RECORD_VERSION_MIN,
} from '../../model/development.constants';

/** Request body for a coach review of a goal's progress. */
export class ReviewGoalDto {
  @ApiProperty({ minimum: RECORD_VERSION_MIN })
  @IsInt()
  @Min(RECORD_VERSION_MIN)
  declare readonly expectedRecordVersion: number;

  @ApiPropertyOptional({ maxLength: GOAL_TEXT_MAX_LENGTH, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(GOAL_TEXT_MAX_LENGTH)
  readonly reviewNote?: string | null;

  @ApiPropertyOptional({
    minimum: GOAL_NUMERIC_MIN,
    maximum: GOAL_NUMERIC_MAX,
    nullable: true,
  })
  @IsOptional()
  @IsNumber()
  @Min(GOAL_NUMERIC_MIN)
  @Max(GOAL_NUMERIC_MAX)
  readonly progressValue?: number | null;

  @ApiPropertyOptional({ maxLength: GOAL_TEXT_MAX_LENGTH, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(GOAL_TEXT_MAX_LENGTH)
  readonly progressNote?: string | null;

  @ApiPropertyOptional({ maxLength: GOAL_TEXT_MAX_LENGTH, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(GOAL_TEXT_MAX_LENGTH)
  readonly evidence?: string | null;
}
