import { ApiPropertyOptional } from '@core/openapi';
import { IsInt, IsOptional, Max, Min, Type } from '@core/validation';

import {
  ELIGIBILITY_DEFAULT_LIMIT,
  ELIGIBILITY_MAX_LIMIT,
  LIST_MIN_LIMIT,
} from '../../model/squads.constants';

/** Bounded pagination query for the candidate eligibility pool. */
export class EligibilityQueryDto {
  @ApiPropertyOptional({
    minimum: LIST_MIN_LIMIT,
    maximum: ELIGIBILITY_MAX_LIMIT,
    default: ELIGIBILITY_DEFAULT_LIMIT,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(LIST_MIN_LIMIT)
  @Max(ELIGIBILITY_MAX_LIMIT)
  readonly limit?: number;

  @ApiPropertyOptional({ minimum: 0, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  readonly offset?: number;
}
