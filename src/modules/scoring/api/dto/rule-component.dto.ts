import { ApiProperty, ApiPropertyOptional } from '@core/openapi';
import {
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  Max,
  Min,
} from '@core/validation';

import {
  COMPONENT_MIN_SAMPLE_MAX,
  COMPONENT_MIN_SAMPLE_MIN,
  COMPONENT_WEIGHT_MAX,
  COMPONENT_WEIGHT_MIN,
} from '../../model/scoring.constants';
import { ScoreCategory } from '../../model/scoring.enums';

/** One weighted category component of a calculation rule. */
export class RuleComponentDto {
  @ApiProperty({ enum: ScoreCategory })
  @IsEnum(ScoreCategory)
  declare readonly categoryKey: ScoreCategory;

  @ApiProperty({ minimum: COMPONENT_WEIGHT_MIN, maximum: COMPONENT_WEIGHT_MAX })
  @IsNumber()
  @Min(COMPONENT_WEIGHT_MIN)
  @Max(COMPONENT_WEIGHT_MAX)
  declare readonly weight: number;

  @ApiPropertyOptional({
    minimum: COMPONENT_MIN_SAMPLE_MIN,
    maximum: COMPONENT_MIN_SAMPLE_MAX,
    default: COMPONENT_MIN_SAMPLE_MIN,
  })
  @IsOptional()
  @IsInt()
  @Min(COMPONENT_MIN_SAMPLE_MIN)
  @Max(COMPONENT_MIN_SAMPLE_MAX)
  readonly minSample?: number;
}
