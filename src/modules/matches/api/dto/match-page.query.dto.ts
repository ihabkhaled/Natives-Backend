import { ApiPropertyOptional } from '@core/openapi';
import { IsInt, IsOptional, Max, Min, Type } from '@core/validation';

import {
  EVENT_DEFAULT_LIMIT,
  EVENT_MAX_LIMIT,
  LIST_MIN_LIMIT,
} from '../../model/matches.constants';

/** Bounded pagination for the append-only event feed and revision trail. */
export class MatchPageQueryDto {
  @ApiPropertyOptional({
    minimum: LIST_MIN_LIMIT,
    maximum: EVENT_MAX_LIMIT,
    default: EVENT_DEFAULT_LIMIT,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(LIST_MIN_LIMIT)
  @Max(EVENT_MAX_LIMIT)
  readonly limit?: number;

  @ApiPropertyOptional({ minimum: 0, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  readonly offset?: number;
}
