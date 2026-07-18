import { ApiPropertyOptional } from '@core/openapi';
import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from '@core/validation';

import {
  CALENDAR_TOKEN_TTL_DAYS_MAX,
  CALENDAR_TOKEN_TTL_DAYS_MIN,
} from '../../model/calendar.constants';
import { TIMEZONE_MAX_LENGTH } from '../../model/practices.constants';

/** Owner-selected scope and lifetime for a revocable practice calendar feed. */
export class CreateCalendarFeedDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  declare readonly seasonId?: string;

  @ApiPropertyOptional({ maxLength: TIMEZONE_MAX_LENGTH })
  @IsOptional()
  @IsString()
  @MaxLength(TIMEZONE_MAX_LENGTH)
  declare readonly timezone?: string;

  @ApiPropertyOptional({
    minimum: CALENDAR_TOKEN_TTL_DAYS_MIN,
    maximum: CALENDAR_TOKEN_TTL_DAYS_MAX,
  })
  @IsOptional()
  @IsInt()
  @Min(CALENDAR_TOKEN_TTL_DAYS_MIN)
  @Max(CALENDAR_TOKEN_TTL_DAYS_MAX)
  declare readonly expiresInDays?: number;
}
