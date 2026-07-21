import { ApiPropertyOptional } from '@core/openapi';
import { IsInt, IsOptional, Max, Min, Type } from '@core/validation';

import {
  LIST_MIN_LIMIT,
  PLAY_DEFAULT_LIMIT,
  PLAY_MAX_LIMIT,
} from '../../model/matches.constants';

/** Bounded pagination for the append-only point/possession feed. */
export class MatchPlayPageQueryDto {
  @ApiPropertyOptional({
    minimum: LIST_MIN_LIMIT,
    maximum: PLAY_MAX_LIMIT,
    default: PLAY_DEFAULT_LIMIT,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(LIST_MIN_LIMIT)
  @Max(PLAY_MAX_LIMIT)
  readonly limit?: number;

  @ApiPropertyOptional({ minimum: 0, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  readonly offset?: number;
}
