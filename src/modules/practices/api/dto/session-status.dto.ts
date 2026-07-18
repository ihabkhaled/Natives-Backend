import { ApiProperty, ApiPropertyOptional } from '@core/openapi';
import { IsInt, IsOptional, IsString, MaxLength, Min } from '@core/validation';

import {
  EXPECTED_VERSION_MIN,
  REASON_MAX_LENGTH,
} from '../../model/practices.constants';

/**
 * Body for a session status change (publish / cancel / re-open): an optional
 * human reason (recorded in history, e.g. why a practice was cancelled) and the
 * caller's expected version for optimistic concurrency.
 */
export class SessionStatusDto {
  @ApiPropertyOptional({ maxLength: REASON_MAX_LENGTH })
  @IsOptional()
  @IsString()
  @MaxLength(REASON_MAX_LENGTH)
  declare readonly reason?: string;

  @ApiProperty({ minimum: EXPECTED_VERSION_MIN })
  @IsInt()
  @Min(EXPECTED_VERSION_MIN)
  declare readonly expectedVersion: number;
}
