import { ApiProperty } from '@core/openapi';
import { IsInt, IsUUID, Max, Min } from '@core/validation';

import { WEIGHT_MAX, WEIGHT_MIN } from '../../model/assessments.constants';

/**
 * One category weight in a template: the percentage a category contributes to the
 * overall score. Weights are unique per category and must total exactly 100
 * (validated as a domain rule before any row is written).
 */
export class CategoryWeightDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  declare readonly categoryId: string;

  @ApiProperty({ maximum: WEIGHT_MAX, minimum: WEIGHT_MIN })
  @IsInt()
  @Min(WEIGHT_MIN)
  @Max(WEIGHT_MAX)
  declare readonly weightPercentage: number;
}
