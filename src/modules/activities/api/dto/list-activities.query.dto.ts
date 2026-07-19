import { ApiPropertyOptional } from '@core/openapi';
import { IsInt, IsOptional, Max, Min, Type } from '@core/validation';

import {
  LIST_MAX_LIMIT,
  LIST_MIN_LIMIT,
} from '../../model/activities.constants';

/** Bounded pagination query for the module's list endpoints. */
export class ListActivitiesQueryDto {
  @ApiPropertyOptional({ minimum: LIST_MIN_LIMIT, maximum: LIST_MAX_LIMIT })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(LIST_MIN_LIMIT)
  @Max(LIST_MAX_LIMIT)
  readonly limit?: number;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  readonly offset?: number;
}
