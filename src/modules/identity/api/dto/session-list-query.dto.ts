import { ApiPropertyOptional } from '@core/openapi';
import { IsInt, IsOptional, Max, Min, Type } from '@core/validation';

import {
  SESSION_LIST_DEFAULT_LIMIT,
  SESSION_LIST_DEFAULT_OFFSET,
  SESSION_LIST_MAX_LIMIT,
  SESSION_LIST_MIN_LIMIT,
} from '../../model/identity.constants';

export class SessionListQueryDto {
  @ApiPropertyOptional({
    default: SESSION_LIST_DEFAULT_LIMIT,
    maximum: SESSION_LIST_MAX_LIMIT,
    minimum: SESSION_LIST_MIN_LIMIT,
  })
  @Type(() => Number)
  @IsInt()
  @Min(SESSION_LIST_MIN_LIMIT)
  @Max(SESSION_LIST_MAX_LIMIT)
  @IsOptional()
  readonly limit: number = SESSION_LIST_DEFAULT_LIMIT;

  @ApiPropertyOptional({
    default: SESSION_LIST_DEFAULT_OFFSET,
    minimum: SESSION_LIST_DEFAULT_OFFSET,
  })
  @Type(() => Number)
  @IsInt()
  @Min(SESSION_LIST_DEFAULT_OFFSET)
  @IsOptional()
  readonly offset: number = SESSION_LIST_DEFAULT_OFFSET;
}
