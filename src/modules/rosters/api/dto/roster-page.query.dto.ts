import { ApiPropertyOptional } from '@core/openapi';
import { IsInt, IsOptional, Max, Min, Type } from '@core/validation';

import {
  ENTRY_DEFAULT_LIMIT,
  ENTRY_MAX_LIMIT,
  LIST_MIN_LIMIT,
} from '../../model/rosters.constants';

/** Bounded pagination for entry, availability, and snapshot reads. */
export class RosterPageQueryDto {
  @ApiPropertyOptional({
    minimum: LIST_MIN_LIMIT,
    maximum: ENTRY_MAX_LIMIT,
    default: ENTRY_DEFAULT_LIMIT,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(LIST_MIN_LIMIT)
  @Max(ENTRY_MAX_LIMIT)
  readonly limit?: number;

  @ApiPropertyOptional({ minimum: 0, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  readonly offset?: number;
}
